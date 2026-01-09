import { asc, eq } from "drizzle-orm";
import { Database } from "@/main/database";
import type { Turn, TurnInsert, TurnPrompt } from "@/main/database/types";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { Model } from "@/main/llm/model";
import { ConversationContextBuilder } from "@/main/services/conversation-context-builder";
import { ProvidersManager } from "@/main/services/providers-manager";

import GenerateResultChunk = Model.GenerateResultChunk;

import { asError } from "catch-unknown";

export class ConversationOrchestrator extends Stateful<ConversationOrchestrator.State> {
  #contextBuilder = Container.inject(ConversationContextBuilder);
  #database = Container.inject(Database);
  #providersManager = Container.inject(ProvidersManager);

  #combineReply(turn: Turn, chunk: GenerateResultChunk) {
    switch (chunk.type) {
      case "text": {
        const last = turn.reply.at(-1);

        if (last && last.type === "text") {
          last.text += chunk.text;
        } else {
          turn.reply.push({
            type: "text",
            text: chunk.text,
          });
        }

        break;
      }
      case "resource": {
        // TODO: Cache to blob storage

        turn.reply.push({
          type: "resource",
          content: chunk.content,
          mimetype: chunk.mimetype,
          url: chunk.url,
        });
        break;
      }
      case "reference":
        turn.reply.push({
          type: "reference",
          url: chunk.url,
          mimetype: chunk.mimetype,
          description: chunk.description,
          title: chunk.title,
        });
        break;
      case "reasoning": {
        const last = turn.reply.at(-1);

        if (last && last.type === "reasoning") {
          last.text += chunk.text;
        } else {
          turn.reply.push({
            type: "reasoning",
            text: chunk.text,
          });
        }

        break;
      }
      case "tool-call": {
        turn.reply.push({
          type: "tool-call",
          id: chunk.id,
          arguments: chunk.arguments,
          tool: chunk.tool,
        });
        break;
      }
      case "source": {
        turn.reply.push({
          type: "source",
          title: chunk.title,
          url: chunk.url,
        });
        break;
      }
      case "finish": {
        turn.finishReason = chunk.reason;
        turn.usage = chunk.usage || {};
      }
    }
  }

  async start(options: ConversationOrchestrator.StartOptions) {
    const controller = new AbortController();

    const schema = this.#database.schema;
    const client = this.#database.client;

    const record = await client.query.conversation.findFirst({
      where: eq(schema.conversation.id, options.id),
      with: {
        project: true,
        turns: {
          orderBy: asc(schema.turn.createTime),
        },
      },
    });

    if (!record) {
      throw new Error("Conversation not found");
    }

    const { project, turns, ...conversation } = record;

    if (!conversation.providerId || !conversation.model) {
      throw new Error("Conversation is not ready");
    }

    const provider = this.#providersManager.getProviderInstance(conversation.providerId);

    if (!provider) {
      throw new Error("Provider not found");
    }

    if (provider.instance.status.type !== "ready") {
      throw new Error("Provider is not ready");
    }

    const model = provider.instance.models.find((model) => model.name === conversation.model);

    if (!model) {
      throw new Error("Model not found");
    }

    const currentTurnInsert: TurnInsert = {
      prompt: options.prompt,
      conversationId: conversation.id,
      usage: {},
      metadata: {
        provider: {
          id: conversation.providerId,
          kind: provider.data.kind,
        },
        model: model.name,
      },
      reply: [],
    };

    const currentTurn = await client
      .insert(schema.turn)
      .values(currentTurnInsert)
      .returning()
      .execute()
      .then((result) => result[0]);

    try {
      const context = await this.#contextBuilder.build({
        id: options.id,
        prompt: options.prompt,
        conversation: conversation,
        turns: [],
        project: project || undefined,
      });

      const stream = await model
        .generate({
          prompt: context,
          maxOutputTokens: conversation.config.maxOutputTokens,
          temperature: conversation.config.temperature,
          tools: [],
          signal: controller.signal,
        })
        .then((stream) => {
          return stream.getReader();
        });

      while (true) {
        const chunk = await stream.read();

        if (chunk.done) {
          break;
        }

        this.#combineReply(currentTurn, chunk.value);

        await client
          .update(schema.turn)
          .set({
            reply: currentTurn.reply,
            finishReason: currentTurn.finishReason,
            metadata: currentTurn.metadata,
            usage: currentTurn.usage,
            error: currentTurn.error,
          })
          .where(eq(schema.turn.id, currentTurn.id))
          .execute();
      }
    } catch (e) {
      await client
        .update(schema.turn)
        .set({
          finishReason: "error",
          error: asError(e).message,
        })
        .where(eq(schema.turn.id, currentTurn.id))
        .execute();
    }
  }

  constructor() {
    super(() => {
      return {
        runningConversations: new Map(),
      };
    });
  }
}

export namespace ConversationOrchestrator {
  export type StartOptions = {
    id: string;
    prompt: TurnPrompt;
  };

  export type State = {
    runningConversations: Map<
      string,
      {
        controller: AbortController;
      }
    >;
  };
}
