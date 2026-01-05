import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { asError } from "catch-unknown";
import { EventSourceParserStream } from "eventsource-parser/stream";
import { z } from "zod/v4";
import type { TurnFinishReason, TurnUsage } from "@/main/database/types";
import { Model } from "@/main/llm/model";
import { Provider } from "@/main/llm/provider";
import { JSONEventSourceParserStream } from "@/main/llm/utils/stream-transformers";
import type { Message } from "@/main/model/content-specification";
import { JSONUtils } from "@/utils";

const KNOWN_MODELS = ["deepseek-chat", "deepseek-reasoner"] as const;

const DEFAULT_API_ENDPOINT = "https://api.deepseek.com";

const MAP_FINISH_REASON: Record<string, TurnFinishReason> = {
  stop: "stop",
  length: "length",
  content_filter: "content-filter",
  tool_calls: "tool-calls",
  insufficient_system_resource: "error",
};

const TEMPERATURE_RANGE = [0, 2] as const;

export class Deepseek extends Provider {
  #parameters: Deepseek.Parameters;
  #models: Model[];
  #status: Provider.Status;
  #context: Provider.Context;

  get #apiEndpoint() {
    return this.#parameters.API_ENDPOINT || DEFAULT_API_ENDPOINT;
  }

  get #apiKey() {
    return this.#parameters.API_KEY;
  }

  get #apiURL() {
    return new URL(this.#apiEndpoint, "/chat/completions");
  }

  #convertUsage(usage: Exclude<Deepseek.CompletionChunkUsage, null | undefined>) {
    return {
      input: usage.prompt_tokens ?? undefined,
      output: usage.completion_tokens ?? undefined,
      reasoning: usage.completion_tokens_details?.reasoning_tokens ?? undefined,
      inputCacheHit: usage.prompt_cache_hit_tokens ?? undefined,
      inputCacheMiss: usage.prompt_cache_miss_tokens ?? undefined,
    } satisfies TurnUsage;
  }

  #convertEventSourceResponse(response: Response) {
    if (response.body === null) {
      throw new Error("Missing response body.");
    }

    const self = this;

    let finishReason: TurnFinishReason = "unrecognized";
    let usage: Deepseek.CompletionChunkUsage | null = null;

    const toolCalls: {
      id: string;
      functionName: string;
      functionArguments: string;
      finished: boolean;
    }[] = [];

    return response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream())
      .pipeThrough(new JSONEventSourceParserStream(Deepseek.CompletionChunkSchema))
      .pipeThrough(
        new TransformStream({
          transform(chunk, controller: TransformStreamDefaultController<Model.GenerateResultChunk>) {
            if (!chunk.success) {
              throw new Error("");
            }

            const data = chunk.data;
            const choice = data.choices[0];
            const delta = choice?.delta;

            if (choice?.finish_reason) {
              finishReason = MAP_FINISH_REASON[choice.finish_reason] || "unrecognized";
            }

            if (data.usage) {
              usage = data.usage;
            }

            if (delta?.reasoning_content) {
              controller.enqueue({ type: "reasoning", text: delta.reasoning_content });
            }

            if (delta?.content) {
              controller.enqueue({ type: "text", text: delta.content });
            }

            if (delta?.tool_calls?.length) {
              for (const item of delta.tool_calls) {
                let call = toolCalls[item.index];

                if (!call) {
                  if (!item.id || !item.function.name) {
                    call = {
                      id: "",
                      functionName: "",
                      functionArguments: "",
                      finished: true,
                    };
                  } else {
                    call = {
                      id: item.id,
                      functionName: item.function.name,
                      functionArguments: item.function.arguments || "",
                      finished: false,
                    };
                  }
                } else {
                  if (call.finished) {
                    continue;
                  }

                  call.functionArguments += item.function?.arguments || "";

                  if (JSONUtils.isParseable(call.functionArguments)) {
                    call.finished = true;
                    controller.enqueue({
                      type: "tool-call",
                      id: call.id,
                      tool: call.functionName,
                      arguments: call.functionArguments,
                    });
                  }
                }

                toolCalls[item.index] = call;
              }
            }
          },

          flush(controller: TransformStreamDefaultController<Model.GenerateResultChunk>) {
            for (const item of toolCalls) {
              if (!item) {
                continue;
              }

              if (!item.finished) {
                controller.enqueue({
                  type: "tool-call",
                  id: item.id,
                  tool: item.functionName,
                  arguments: item.functionArguments,
                });
              }
            }

            controller.enqueue({
              type: "finish",
              reason: finishReason,
              usage: usage ? self.#convertUsage(usage) : undefined,
            });
          },
        }),
      );
  }

  #convertTool(tool: Tool) {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required,
        },
      },
    } satisfies Deepseek.FunctionTool;
  }

  #convertTemperature(value: number) {
    return (TEMPERATURE_RANGE[1] - TEMPERATURE_RANGE[0]) * value;
  }

  async #convertUserMessage(message: Extract<Message, { role: "user" }>) {
    const content = await Promise.all(
      message.content.map(async (part) => {
        if (part.type === "reference") {
          return Model.stringifyReference(part);
        }

        if (part.type === "resource") {
          return Model.stringifyResource(part);
        }

        return part.text;
      }),
    );

    return {
      role: "user",
      content: content.join("\n"),
    } satisfies Deepseek.Message;
  }

  async #convertAssistantMessage(message: Extract<Message, { role: "assistant" }>) {
    const content = await Promise.all(
      message.content
        .filter((part) => {
          return part.type === "text" || part.type === "resource" || part.type === "reference";
        })
        .map((part) => {
          if (part.type === "reference") {
            return Model.stringifyReference(part);
          }

          if (part.type === "resource") {
            return Model.stringifyResource(part);
          }

          return part.text;
        }),
    );

    const reasoning = message.content.filter((part) => part.type === "reasoning").map((part) => part.text);
    const toolCalls = message.content
      .filter((part) => part.type === "tool-call")
      .map((part) => {
        return {
          type: "function",
          id: part.id,
          function: {
            name: part.tool,
            arguments: part.arguments,
          },
        } satisfies Deepseek.MessageToolCall;
      });

    return {
      role: "assistant",
      content: content.join("\n"),
      reasoning_content: reasoning.join("\n"),
      tool_calls: toolCalls,
    } satisfies Deepseek.Message;
  }

  async #convertToolMessage(message: Extract<Message, { role: "tool" }>) {
    const messages: Deepseek.Message[] = await Promise.all(
      message.content.map(async (result) => {
        return {
          role: "tool",
          content: await Promise.all(
            result.result.map(async (item) => {
              if (item.type === "text") {
                return item.text;
              } else if (item.type === "reference") {
                return Model.stringifyReference(item);
              }

              return Model.stringifyResource(item);
            }),
          ).then((result) => {
            return result.join("\n");
          }),
          tool_call_id: result.id,
        };
      }),
    );

    return messages;
  }

  async #convertSystemMessage(message: Extract<Message, { role: "system" }>) {
    const content: string[] = [];

    for (const part of message.content) {
      if (part.type === "text") {
        content.push(part.text);
      }

      if (part.type === "reference") {
        content.push(Model.stringifyReference(part));
      }
    }

    return {
      role: "system",
      content: content.join("\n"),
    } satisfies Deepseek.Message;
  }

  async #convertPrompt(prompt: Message[]) {
    const messages = await Promise.all(
      prompt.map(async (message) => {
        switch (message.role) {
          case "system":
            return this.#convertSystemMessage(message);
          case "user":
            return this.#convertUserMessage(message);
          case "assistant":
            return this.#convertAssistantMessage(message);
          case "tool":
            return this.#convertToolMessage(message);
          default:
            throw new Error(`Unknown message role`);
        }
      }),
    );

    return messages.flat();
  }

  async #createRequestBody(model: (typeof KNOWN_MODELS)[number], options: Model.GenerateOptions) {
    return JSON.stringify({
      model,
      max_tokens: options.maxOutputTokens,
      tools: options.tools.map((tool) => this.#convertTool(tool)),
      tool_choice: "auto",
      temperature: options.temperature ? this.#convertTemperature(options.temperature) : undefined,
      messages: await this.#convertPrompt(options.prompt),
      stream: true,
    });
  }

  async #createRequestInit(model: (typeof KNOWN_MODELS)[number], options: Model.GenerateOptions) {
    const init: RequestInit = {
      headers: [
        ["Content-Type", "application/json"],
        ["Authorization", `Bearer ${this.#apiKey}`],
      ],
      method: "POST",
      body: await this.#createRequestBody(model, options),
    };

    return init;
  }

  async #call(model: (typeof KNOWN_MODELS)[number], options: Model.GenerateOptions) {
    return this.#createRequestInit(model, options)
      .catch((error) => {
        throw new Error(`Failed to create request: ${asError(error).message}`);
      })
      .then((init) => {
        return this.#context.fetch(this.#apiURL, init);
      })
      .catch((error) => {
        throw new Error(`Failed to send request: ${asError(error).message}`);
      })
      .then(async (response) => {
        if (!response.ok) {
          let message = `Failed to send request: ${response.statusText}`;

          try {
            const json = await response.json();
            const error = Deepseek.ErrorSchema.parse(json);

            message = error.error.message;
          } catch {}

          throw new Error(message);
        }

        return this.#convertEventSourceResponse(response);
      });
  }

  #createModel(model: (typeof KNOWN_MODELS)[number]) {
    const provider = this;

    return new (class M extends Model {
      async generate(options: Model.GenerateOptions): Promise<ReadableStream<Model.GenerateResultChunk>> {
        return provider.#call(model, options);
      }

      get maxOutput() {
        if (model === "deepseek-reasoner") {
          return 64 * 1000;
        }

        return 8 * 1000;
      }

      get maxContextLength() {
        return 128 * 1000;
      }

      get name() {
        return model;
      }

      get title() {
        return model;
      }

      get description() {
        return "";
      }

      get capabilities() {
        return {
          reasoning: model === "deepseek-reasoner",
          functionCalling: true,
        };
      }

      get pricing() {
        return {
          input: 0,
          output: 0,
        };
      }
    })();
  }

  constructor(context: Provider.Context) {
    super();

    this.#status = {
      type: "loading",
    };
    this.#context = context;

    const parameters = Deepseek.ParametersSchema.safeParse(context.config.parameters);

    if (parameters.success) {
      this.#parameters = parameters.data;
      this.#status = {
        type: "ready",
      };
    } else {
      this.#parameters = {
        API_KEY: "",
      };
      this.#status = {
        type: "error",
        message: "",
      };
    }

    this.#models = KNOWN_MODELS.map((model) => this.#createModel(model));
  }

  get models() {
    return this.#models;
  }

  get capabilities() {
    return {
      customModel: false,
      customApiBaseURL: false,
    };
  }

  get status() {
    return this.#status;
  }

  static readonly parameters: Provider.Parameter[] = [
    {
      key: "API_KEY",
      label: "API Key",
      description: "Your Deepseek API key",
      secret: true,
      required: true,
    },
    {
      key: "API_ENDPOINT",
      label: "API Endpoint",
      description: "The endpoint to use for Deepseek API requests",
      default: DEFAULT_API_ENDPOINT,
    },
  ];
}

const _: Provider.Constructor = Deepseek;

export namespace Deepseek {
  export const ParametersSchema = z.object({
    API_KEY: z.string().nonempty(),
    API_ENDPOINT: z.url().optional(),
  });

  export type Parameters = z.infer<typeof ParametersSchema>;

  export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

  export type SystemMessage = {
    role: "system";
    content: string;
  };

  export type UserMessage = {
    role: "user";
    content: string;
  };

  export type AssistantMessage = {
    role: "assistant";
    content?: string | null;
    reasoning_content?: string;
    tool_calls?: Array<MessageToolCall>;
  };

  export type MessageToolCall = {
    type: "function";
    id: string;
    function: {
      arguments: string;
      name: string;
    };
  };

  export type ToolMessage = {
    role: "tool";
    content: string;
    tool_call_id: string;
  };

  export type FunctionTool = {
    type: "function";
    function: {
      name: string;
      description: string | undefined;
      parameters: unknown;
      strict?: boolean;
    };
  };

  export const CompletionChunkUsageSchema = z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
      prompt_cache_hit_tokens: z.number().nullish(),
      prompt_cache_miss_tokens: z.number().nullish(),
      total_tokens: z.number().nullish(),
      completion_tokens_details: z
        .object({
          reasoning_tokens: z.number().nullish(),
        })
        .nullish(),
    })
    .nullish();

  export const CompletionChunkToolCallSchema = z.object({
    index: z.number(),
    id: z.string().nullish(),
    function: z.object({
      name: z.string().nullish(),
      arguments: z.string().nullish(),
    }),
  });

  export const CompletionChunkDeltaSchema = z.object({
    role: z.enum(["assistant"]).nullish(),
    content: z.string().nullish(),
    reasoning_content: z.string().nullish(),
    tool_calls: CompletionChunkToolCallSchema.array().nullish(),
  });

  export const CompletionChunkChoiceSchema = z.object({
    delta: CompletionChunkDeltaSchema.nullish(),
    finish_reason: z.string().nullish(),
  });

  export const CompletionChunkSchema = z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: CompletionChunkChoiceSchema.array(),
    usage: CompletionChunkUsageSchema,
  });

  export type CompletionChunkUsage = z.infer<typeof CompletionChunkUsageSchema>;
  export type CompletionChunkToolCall = z.infer<typeof CompletionChunkToolCallSchema>;
  export type CompletionChunkDelta = z.infer<typeof CompletionChunkDeltaSchema>;
  export type CompletionChunkChoice = z.infer<typeof CompletionChunkChoiceSchema>;
  export type CompletionChunk = z.infer<typeof CompletionChunkSchema>;

  export const ErrorSchema = z.object({
    error: z.object({
      message: z.string(),
      type: z.string().nullish(),
      param: z.any().nullish(),
      code: z.union([z.string(), z.number()]).nullish(),
    }),
  });
}
