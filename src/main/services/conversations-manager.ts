import { eq, isNull } from "drizzle-orm";
import { default as memoize } from "memoizee";
import { Database } from "@/main/database";
import type { ConversationInsert, ProjectStageConversation, TurnPrompt } from "@/main/database/types";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { ConversationOrchestrator } from "@/main/services/conversation-orchestrator";
import { ProvidersManager } from "@/main/services/providers-manager";

export class ConversationsManager extends Stateful.Persistable<ConversationsManager.State> {
  #database = Container.inject(Database);
  #providersManager = Container.inject(ProvidersManager);
  #orchestrator = Container.inject(ConversationOrchestrator);

  constructor() {
    super({
      name: "conversations",
      directory: Container.inject(Environment).storiesFolder,
      defaults: {},
    });

    this.liveConversations = memoize(this.liveConversations.bind(this), {
      promise: true,
      normalizer: ([options]) => options.project || "",
    });

    this.liveTurns = memoize(this.liveTurns.bind(this), {
      promise: true,
      normalizer: ([options]) => options.id,
    });
  }

  async createConversation(options: ConversationsManager.CreateConversationOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      if (options.projectId) {
        await tx
          .$count(schema.project, eq(schema.project.id, options.projectId))
          .then((count) => count > 0)
          .then((exists) => {
            if (!exists) {
              throw new Error("Project not exists.");
            }
          });
      }

      if (options.providerId) {
        await tx
          .$count(schema.provider, eq(schema.provider.id, options.providerId))
          .then((count) => count > 0)
          .then((exists) => {
            if (!exists) {
              throw new Error("Provider not exists.");
            }
          });
      }

      return tx
        .insert(schema.conversation)
        .values({
          projectId: options.projectId,
          summary: options.summary,
          systemPrompt: options.systemPrompt,
          config: options.config,
          providerId: options.providerId,
          model: options.model,
        })
        .returning()
        .execute()
        .then((result) => {
          return result[0];
        });
    });
  }

  async updateConversation(options: ConversationsManager.UpdateConversationOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      await tx
        .$count(schema.conversation, eq(schema.conversation.id, options.id))
        .then((count) => count > 0)
        .then((exists) => {
          if (!exists) {
            throw new Error("Conversation not exists.");
          }
        });

      if (options.providerId) {
        await tx
          .$count(schema.provider, eq(schema.provider.id, options.providerId))
          .then((count) => count > 0)
          .then((exists) => {
            if (!exists) {
              throw new Error("Provider not exists.");
            }
          });
      }

      return tx
        .update(schema.conversation)
        .set({
          summary: options.summary,
          systemPrompt: options.systemPrompt,
          config: options.config,
          model: options.model,
          providerId: options.providerId,
        })
        .where(eq(schema.conversation.id, options.id))
        .execute();
    });
  }

  async deleteConversation(options: ConversationsManager.DeleteConversationOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      await tx
        .$count(schema.conversation, eq(schema.conversation.id, options.id))
        .then((count) => count > 0)
        .then((exists) => {
          if (!exists) {
            throw new Error("Conversation not exists.");
          }
        });

      return tx.delete(schema.conversation).where(eq(schema.conversation.id, options.id)).returning().execute();
    });
  }

  async liveConversations(options: ConversationsManager.LiveConversationsOptions) {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;

    const query = client
      .select(
        Database.utils.aliasedColumns({
          id: schema.conversation.id,
          createTime: schema.conversation.createTime,
          updateTime: schema.conversation.updateTime,
          summary: schema.conversation.summary,
          config: schema.conversation.config,
          providerId: schema.conversation.providerId,
          model: schema.conversation.model,
          projectId: schema.conversation.projectId,
          systemPrompt: schema.conversation.systemPrompt,
        }),
      )
      .from(schema.conversation)
      .where(
        options.project ? eq(schema.conversation.projectId, options.project) : isNull(schema.conversation.projectId),
      )
      .orderBy(schema.conversation.createTime);

    const sql = query.toSQL();
    const subscribers = new Set<(results: typeof live.initialResults) => void>();

    const live = await driver.live.query<Awaited<ReturnType<(typeof query)["execute"]>>[number]>({
      query: sql.sql,
      params: sql.params,
      callback: (results) => {
        for (const subscriber of subscribers) {
          subscriber(results);
        }
      },
    });

    return {
      subscribe: (subscriber: (results: typeof live.initialResults) => void) => {
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      },
      refresh: live.refresh,
      initialResults: live.initialResults,
    };
  }

  async liveTurns(options: ConversationsManager.LiveTurnsOptions) {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;

    const query = client
      .select(
        Database.utils.aliasedColumns({
          id: schema.turn.id,
          createTime: schema.turn.createTime,
          updateTime: schema.turn.updateTime,
          summary: schema.turn.prompt,
          finishReason: schema.turn.finishReason,
          reply: schema.turn.reply,
          metadata: schema.turn.metadata,
          usage: schema.turn.usage,
          error: schema.turn.error,
          prompt: schema.turn.prompt,
        }),
      )
      .from(schema.turn)
      .where(eq(schema.turn.conversationId, options.id))
      .orderBy(schema.turn.createTime);

    const sql = query.toSQL();
    const subscribers = new Set<(results: typeof live.initialResults) => void>();

    const live = await driver.live.query<Awaited<ReturnType<(typeof query)["execute"]>>[number]>({
      query: sql.sql,
      params: sql.params,
      callback: (results) => {
        for (const subscriber of subscribers) {
          subscriber(results);
        }
      },
    });

    return {
      subscribe: (subscriber: (results: typeof live.initialResults) => void) => {
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      },
      refresh: live.refresh,
      initialResults: live.initialResults,
    };
  }

  async getStageConversation(options: ConversationsManager.GetStageConversationOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    let config: ProjectStageConversation | undefined;

    if (options.project) {
      config = await client
        .select()
        .from(schema.project)
        .where(eq(schema.project.id, options.project))
        .execute()
        .then(([row]) => {
          if (row) {
            return row.config.stageConversation;
          }
        });
    } else {
      config = this.state.globalStageConversation;
    }

    if (config?.model) {
      const model = config.model;
      const instance = this.#providersManager.getProviderInstance(model.provider)?.instance.models.find(({ name }) => {
        return name === model.name;
      });

      if (!instance) {
        config = { config: config.config };
      }
    }

    return config;
  }

  async setStageConversation(options: ConversationsManager.SetStageConversationOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    if (options.project) {
      await client
        .update(schema.project)
        .set({
          config: {
            stageConversation: options.config,
          },
        })
        .where(eq(schema.project.id, options.project))
        .execute();
    }

    return this.update((draft) => {
      draft.globalStageConversation = options.config;
    });
  }

  async startTurn(options: ConversationsManager.StartTurnOptions) {
    return this.#orchestrator.start(options);
  }

  async abortTurn() {}

  // TODO:
  async liveConversationTurnsUpdate(options: ConversationsManager.LiveConversationTurnsUpdateOptions) {
    throw new Error("Unimplemented");
  }

  async getConversation(options: ConversationsManager.GetConversationOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.query.conversation.findFirst({
      where: eq(schema.conversation.id, options.id),
    });
  }
}

export namespace ConversationsManager {
  export type State = {
    globalStageConversation?: ProjectStageConversation;
  };

  export type CreateConversationOptions = Pick<
    ConversationInsert,
    "projectId" | "config" | "systemPrompt" | "summary"
  > & {
    providerId: string;
    model: string;
  };

  export type UpdateConversationOptions = Omit<CreateConversationOptions, "projectId"> & {
    id: string;
  };

  export type DeleteConversationOptions = {
    id: string;
  };

  export type LiveConversationsOptions = {
    project?: string;
  };

  export type LiveTurnsOptions = {
    id: string;
  };

  export type LiveConversationTurnsUpdateOptions = {
    id: string;
  };

  export type GetStageConversationOptions = {
    project?: string;
  };

  export type SetStageConversationOptions = {
    project?: string;
    config: ProjectStageConversation;
  };

  export type StartTurnOptions = {
    prompt: TurnPrompt;
    id: string;
  };

  export type GetConversationOptions = {
    id: string;
  };
}
