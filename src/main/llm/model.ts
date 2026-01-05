import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { TurnFinishReason, TurnUsage } from "@/main/database/types";
import type { Message, Part } from "@/main/model/content-specification";

export abstract class Model {
  abstract generate(context: Model.GenerateOptions): Promise<ReadableStream<Model.GenerateResultChunk>>;

  abstract readonly name: string;

  abstract readonly title: string;

  abstract readonly description: string;

  abstract readonly capabilities: Model.Capabilities;

  abstract readonly maxContextLength: number;

  abstract readonly maxOutput: number;

  abstract readonly pricing: Model.Pricing;

  static stringifyReference(part: Part.Reference) {
    const attributes: string[] = [];

    attributes.push(`url=${JSON.stringify(part.url)}`);

    if (part.title) {
      attributes.push(`title=${JSON.stringify(part.title)}`);
    }

    if (part.mimetype) {
      attributes.push(`mimetype=${JSON.stringify(part.mimetype)}`);
    }

    if (part.description) {
      attributes.push(`description=${JSON.stringify(part.description)}`);
    }

    return `<5ire.reference ${attributes.join(" ")} />`;
  }

  static stringifyResource(part: Part.Resource) {
    const attributes: string[] = [];

    attributes.push(`url=${JSON.stringify(part.url)}`);
    attributes.push(`mimetype=${JSON.stringify(part.mimetype)}`);

    if (typeof part.content === "string") {
      return `<5ire.resource>${JSON.stringify(part.content)}</5ire.resource>`;
    }

    return `<5ire.resource ${attributes.join(" ")} />`;
  }
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
    maxOutputTokens?: number;
    /**
     * The temperature to use
     */
    temperature?: number;
    /**
     * The signal to abort the generation
     */
    signal?: AbortSignal;
    /**
     * Tools
     */
    tools: Tool[];
  };

  export type GenerateResultChunk =
    | Extract<Message, { role: "assistant" }>["content"][number]
    | {
        type: "finish";
        /**
         * Reason why a language model finished generating a response.
         */
        reason: TurnFinishReason;
        /**
         * Usage information for a language model call.
         */
        usage?: TurnUsage;
      };

  export type Capabilities = {
    /**
     * Whether the model can reason
     */
    readonly reasoning?: boolean;
    /**
     * Whether the model can call functions
     */
    readonly functionCalling?: boolean;
    /**
     * Whether the model can produce images
     */
    readonly vision?: boolean;
  };

  export type Pricing = {
    input: number;
    output: number;
  };
}
