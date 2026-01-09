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

const KNOWN_MODELS = [
  "o1",
  "o3-mini",
  "o3",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4",
  "gpt-4-0613",
  "gpt-4.5-preview",
  "gpt-3.5-turbo",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-5.1",
  "gpt-5.2",
  "gpt-5.2-pro",
] as const;

const DEFAULT_API_ENDPOINT = "https://api.openai.com/v1";

const MAP_FINISH_REASON: Record<string, TurnFinishReason> = {
  stop: "stop",
  length: "length",
  content_filter: "content-filter",
  function_call: "tool-calls",
  tool_calls: "tool-calls",
  insufficient_system_resource: "error",
};

const TEMPERATURE_RANGE = [0, 2] as const;

export class Openai extends Provider {
  #parameters: Openai.Parameters;
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
    return new URL("/chat/completions", this.#apiEndpoint);
  }

  #isReasoningModel(model: (typeof KNOWN_MODELS)[number]) {
    return (
      model.startsWith("gpt-3") ||
      model.startsWith("gpt-4") ||
      model.startsWith("chatgpt-4o") ||
      model.startsWith("gpt-5-chat")
    );
  }

  #convertUsage(usage: Exclude<Openai.StreamChunkUsage, null | undefined>) {
    let inputCacheHit: number | undefined;
    let inputCacheMiss: number | undefined;

    if (typeof usage.prompt_tokens === "number" && typeof usage.prompt_tokens_details?.cached_tokens === "number") {
      inputCacheHit = usage.prompt_tokens_details.cached_tokens;
      inputCacheMiss = usage.prompt_tokens - usage.prompt_tokens_details.cached_tokens;
    }

    return {
      input: usage.prompt_tokens ?? undefined,
      output: usage.completion_tokens ?? undefined,
      reasoning: usage.completion_tokens_details?.reasoning_tokens ?? undefined,
      inputCacheHit,
      inputCacheMiss,
    } satisfies TurnUsage;
  }

  #convertEventSourceResponse(response: Response) {
    if (response.body === null) {
      throw new Error("Missing response body.");
    }

    const self = this;

    let finishReason: TurnFinishReason = "unrecognized";
    let usage: Openai.StreamChunkUsage | null = null;

    const toolCalls: {
      id: string;
      functionName: string;
      functionArguments: string;
      finished: boolean;
    }[] = [];

    return response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream())
      .pipeThrough(new JSONEventSourceParserStream(Openai.StreamChunkSchema))
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

            if (delta?.content) {
              controller.enqueue({ type: "text", text: delta.content });
            }

            if (delta?.annotations) {
              for (const annotation of delta.annotations) {
                controller.enqueue({
                  type: "source",
                  url: annotation.url,
                  title: annotation.title,
                });
              }
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
    } satisfies Openai.FunctionTool;
  }

  #convertTemperature(value: number) {
    return (TEMPERATURE_RANGE[1] - TEMPERATURE_RANGE[0]) * value;
  }

  #convertUserMessage(message: Extract<Message, { role: "user" }>) {
    const content: Openai.UserMessage["content"] = [];

    for (const part of message.content) {
      if (part.type === "reference") {
        if (part.mimetype?.startsWith("image/")) {
          content.push({
            type: "image_url",
            image_url: {
              url: part.url,
            },
          });
        }
        content.push({
          type: "text",
          text: Model.stringifyReference(part),
        });
      }

      if (part.type === "resource") {
        if (typeof part.content === "string") {
          return {
            type: "file",
            file: {
              name: part.url,
              content: `data:${part.mimetype || "text/plain"};base64,${Buffer.from(part.content).toString("base64")}`,
            },
          };
        } else {
          if (part.mimetype?.startsWith("image/")) {
            content.push({
              type: "image_url",
              image_url: {
                url: `data:${part.mimetype},base64;${Buffer.from(part.content).toString("base64")}`,
              },
            });
          }

          if (part.mimetype?.startsWith("audio/mp3")) {
            content.push({
              type: "input_audio",
              input_audio: {
                data: `data:${part.mimetype},base64;${Buffer.from(part.content).toString("base64")}`,
                format: "mp3",
              },
            });
          }

          if (part.mimetype?.startsWith("audio/wav")) {
            content.push({
              type: "input_audio",
              input_audio: {
                data: `data:${part.mimetype},base64;${Buffer.from(part.content).toString("base64")}`,
                format: "wav",
              },
            });
          }

          content.push({
            type: "text",
            text: Model.stringifyResource(part),
          });
        }
      }

      if (part.type === "text") {
        content.push({
          type: "text",
          text: part.text,
        });
      }
    }

    return {
      role: "user",
      content,
    } satisfies Openai.UserMessage;
  }

  #convertAssistantMessage(message: Extract<Message, { role: "assistant" }>) {
    const content = message.content
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
      });

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
        } satisfies Openai.MessageToolCall;
      });

    return {
      role: "assistant",
      content: content.join("\n"),
      tool_calls: toolCalls.length ? toolCalls : undefined,
    } satisfies Openai.Message;
  }

  #convertToolMessage(message: Extract<Message, { role: "tool" }>) {
    const messages: Openai.Message[] = message.content.map((result) => {
      return {
        role: "tool",
        content: result.result
          .map(async (item) => {
            if (item.type === "text") {
              return item.text;
            } else if (item.type === "reference") {
              return Model.stringifyReference(item);
            }

            return Model.stringifyResource(item);
          })
          .join("\n"),
        tool_call_id: result.id,
      };
    });

    return messages;
  }

  #convertSystemMessage(message: Extract<Message, { role: "system" }>, model: (typeof KNOWN_MODELS)[number]) {
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
      role: this.#isReasoningModel(model) ? "developer" : "system",
      content: content.join("\n"),
    } satisfies Openai.Message;
  }

  #convertPrompt(prompt: Message[], model: (typeof KNOWN_MODELS)[number]) {
    const messages = prompt.map((message) => {
      switch (message.role) {
        case "system":
          return this.#convertSystemMessage(message, model);
        case "user":
          return this.#convertUserMessage(message);
        case "assistant":
          return this.#convertAssistantMessage(message);
        case "tool":
          return this.#convertToolMessage(message);
        default:
          throw new Error(`Unknown message role`);
      }
    });

    return messages.flat();
  }

  async #createRequestBody(model: (typeof KNOWN_MODELS)[number], options: Model.GenerateOptions) {
    const reasoningEffort = this.#isReasoningModel(model) ? "medium" : undefined;

    const init: Record<string, unknown> = {
      model,
      max_completion_tokens: options.maxOutputTokens,
      tools: options.tools.map((tool) => this.#convertTool(tool)),
      tool_choice: "auto",
      temperature: options.temperature ? this.#convertTemperature(options.temperature) : undefined,
      messages: this.#convertPrompt(options.prompt, model),
      stream: true,
      reasoning_effort: reasoningEffort,
      stream_options: {
        include_usage: true,
      },
    };

    if (reasoningEffort) {
      if (!model.startsWith("gpt-5.1")) {
        delete init.temperature;
      }
    }

    return JSON.stringify(init);
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
        console.log(error);
        throw new Error(`Failed to send request: ${asError(error).message}`);
      })
      .then(async (response) => {
        if (!response.ok) {
          let message = `Failed to send request: ${response.statusText}`;

          try {
            const json = await response.json();
            const error = Openai.ErrorSchema.parse(json);

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
        return 0;
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
          reasoning: provider.#isReasoningModel(model),
          functionCalling: true,
          vision: true,
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

    const parameters = Openai.ParametersSchema.safeParse(context.config.parameters);

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
      description: "Your OpenAI API key",
      secret: true,
      required: true,
    },
    {
      key: "API_ENDPOINT",
      label: "API Endpoint",
      description: "The endpoint to use for OpenAI API requests",
      default: DEFAULT_API_ENDPOINT,
    },
  ];
}

const _: Provider.Constructor = Openai;

export namespace Openai {
  export const ParametersSchema = z.object({
    API_KEY: z.string().nonempty(),
    API_ENDPOINT: z.url().optional(),
  });

  export type Parameters = z.infer<typeof ParametersSchema>;

  export type Message = SystemMessage | DeveloperMessage | UserMessage | AssistantMessage | ToolMessage;

  export type SystemMessage = {
    role: "system";
    content: string;
  };

  export type DeveloperMessage = {
    role: "developer";
    content: string;
  };

  export type UserMessage = {
    role: "user";
    name?: string;
    content: Array<
      | {
          type: "image_url";
          image_url: { url: string };
        }
      | {
          type: "text";
          text: string;
        }
      | {
          type: "input_audio";
          input_audio: { data: string; format: "wav" | "mp3" };
        }
      | {
          type: "file";
          file: { filename: string; file_data: string };
        }
    >;
  };

  export type AssistantMessage = {
    role: "assistant";
    content?: string | null;
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

  export const StreamChunkUsageSchema = z
    .object({
      prompt_tokens: z.number().nullish(),
      completion_tokens: z.number().nullish(),
      total_tokens: z.number().nullish(),
      prompt_tokens_details: z
        .object({
          cached_tokens: z.number().nullish(),
        })
        .nullish(),
      completion_tokens_details: z
        .object({
          reasoning_tokens: z.number().nullish(),
          accepted_prediction_tokens: z.number().nullish(),
          rejected_prediction_tokens: z.number().nullish(),
        })
        .nullish(),
    })
    .nullish();

  export const StreamChunkToolCallSchema = z.object({
    index: z.number(),
    id: z.string().nullish(),
    type: z.literal("function").nullish(),
    function: z.object({
      name: z.string().nullish(),
      arguments: z.string().nullish(),
    }),
  });

  export const StreamChunkAnnotation = z.object({
    type: z.literal("url_citation"),
    start_index: z.number(),
    end_index: z.number(),
    url: z.string(),
    title: z.string(),
  });

  export const StreamChunkDeltaSchema = z.object({
    role: z.enum(["assistant"]).nullish(),
    content: z.string().nullish(),
    tool_calls: StreamChunkToolCallSchema.array().nullish(),
    annotations: StreamChunkAnnotation.array().nullish(),
  });

  export const StreamChunkChoiceSchema = z.object({
    delta: StreamChunkDeltaSchema.nullish(),
    finish_reason: z.string().nullish(),
  });

  export const StreamChunkSchema = z.object({
    id: z.string().nullish(),
    created: z.number().nullish(),
    model: z.string().nullish(),
    choices: StreamChunkChoiceSchema.array(),
    usage: StreamChunkUsageSchema,
  });

  export type StreamChunkUsage = z.infer<typeof StreamChunkUsageSchema>;
  export type StreamChunkToolCall = z.infer<typeof StreamChunkToolCallSchema>;
  export type StreamChunkDelta = z.infer<typeof StreamChunkDeltaSchema>;
  export type StreamChunkChoice = z.infer<typeof StreamChunkChoiceSchema>;
  export type StreamChunk = z.infer<typeof StreamChunkSchema>;

  export const ErrorSchema = z.object({
    error: z.object({
      message: z.string(),
      type: z.string().nullish(),
      param: z.any().nullish(),
      code: z.union([z.string(), z.number()]).nullish(),
    }),
  });
}
