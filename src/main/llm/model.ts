import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Message } from "@/main/model/content-specification";

export abstract class Model {
  abstract generate(context: Model.GenerateOptions): Promise<ReadableStream<Model.GenerateResultChunk>>;

  abstract readonly name: string;

  abstract readonly title: string;

  abstract readonly description: string;

  abstract readonly capabilities: Model.Capabilities;
}

export namespace Model {
  export type GenerateOptions = {
    /**
     * The prompt to generate from
     */
    prompt: Message[];
    /**
     * The maximum number of tokens to generate
     */
    maxOutputTokens: number;
    /**
     * The temperature to use
     */
    temperature: number;
    /**
     * The signal to abort the generation
     */
    signal?: AbortSignal;
    /**
     * Tools
     */
    tools: Tool[];
  };

  export type GenerateFinishReason =
    | "length"
    | "stop"
    | "content-filter"
    | "tool-calls"
    | "error"
    | "unrecognized"
    | "aborted";

  export type GenerateResultChunk =
    | Extract<Message, { role: "assistant" }>["content"][number]
    | {
        type: "finish";
        /**
         * Reason why a language model finished generating a response.
         */
        reason: GenerateFinishReason;
        /**
         * Usage information for a language model call.
         */
        usage?: Record<"input" | "output", number | null>;
      };

  export type Capabilities = {
    /**
     * Whether the model can reason
     */
    readonly reasoning: boolean;
    /**
     * Whether the model can call functions
     */
    readonly functionCalling: boolean;
    /**
     * Whether the model can produce images
     */
    readonly vision: boolean;
    /**
     * Whether the model can generate images
     */
    readonly imageGeneration: boolean;
  };
}
