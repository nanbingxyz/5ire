import type { InferEnum, InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  collection,
  conversation,
  conversationCollection,
  document,
  documentChunk,
  project,
  prompt,
  promptMergeStrategy,
  provider,
  providerKind,
  turn,
  turnFinishReason,
  usage,
} from "@/main/database/schema/tables";

export type Collection = InferSelectModel<typeof collection>;
export type CollectionRaw = InferSelectModel<typeof collection, { dbColumnNames: true }>;
export type CollectionInsert = InferInsertModel<typeof collection>;

export type Document = InferSelectModel<typeof document>;
export type DocumentRaw = InferSelectModel<typeof document, { dbColumnNames: true }>;
export type DocumentInsert = InferInsertModel<typeof document>;

export type DocumentChunk = InferSelectModel<typeof documentChunk>;
export type DocumentChunkRaw = InferSelectModel<typeof documentChunk, { dbColumnNames: true }>;
export type DocumentChunkInsert = InferInsertModel<typeof documentChunk>;

export type ConversationCollection = InferSelectModel<typeof conversationCollection>;
export type ConversationCollectionRaw = InferSelectModel<typeof conversationCollection, { dbColumnNames: true }>;
export type ConversationCollectionInsert = InferInsertModel<typeof conversationCollection>;

export type Prompt = InferSelectModel<typeof prompt>;
export type PromptRaw = InferSelectModel<typeof prompt, { dbColumnNames: true }>;
export type PromptInsert = InferInsertModel<typeof prompt>;
export type PromptMergeStrategy = InferEnum<typeof promptMergeStrategy>;

export type ProjectConfig = {
  defaultConversationConfig?: Partial<ConversationConfig>;
  systemPrompt?: string;
};

export type Project = InferSelectModel<typeof project>;
export type ProjectRaw = InferSelectModel<typeof project, { dbColumnNames: true }>;
export type ProjectInsert = InferInsertModel<typeof project>;

/**
 * Represents the configuration settings applied to a conversation session.
 *
 * A `ConversationConfig` defines the model, provider, and runtime parameters
 * that influence how turns are processed and how the model generates replies.
 */
export type ConversationConfig = {
  /**
   * The maximum number of previous messages retained in the conversation context.
   */
  maxContextMessages: number;
  /**
   * The maximum number of tokens that the model can generate for a single turn.
   */
  maxTokens: number;
  /**
   * Controls the randomness of the model’s output.
   */
  temperature: number;
  /**
   * The identifier of the provider that serves this conversation.
   */
  provider: string;
  /**
   * The name or identifier of the model used in this conversation.
   */
  model: string;
  // /**
  //  * Whether to enable web search augmentation for model responses.
  //  */
  // enableWebSearch: boolean;
  // /**
  //  * Whether to enable the model's explicit reasoning process output.
  //  */
  // enableThinking: boolean;
  // /**
  //  * Whether to enable the artifact output mode.
  //  */
  // enableArtifact: boolean;
};

export type Conversation = InferSelectModel<typeof conversation>;
export type ConversationRaw = InferSelectModel<typeof conversation, { dbColumnNames: true }>;
export type ConversationInsert = InferInsertModel<typeof conversation>;

/**
 * Represents metadata for a single conversation turn.
 *
 * This metadata is primarily used for display and diagnostic purposes within a conversation.
 */
export type TurnMetadata = {
  /**
   * Information about the provider that processed this turn.
   *
   * This is a snapshot of the provider's state at the time of execution.
   * The provider may be removed or modified later, so this data is for
   * display purposes only.
   */
  provider: {
    /**
     * The unique identifier of the provider.
     */
    id: string;
    /**
     * The display name of the provider.
     */
    label: string;
    /**
     * The kind of provider, e.g. `openai`, `anthropic`, `ollama`.
     */
    kind: ProviderKind;
  };
  /**
   * The name or identifier of the model used to process this turn.
   */
  model: string;
};

/**
 * Represents the prompt that initiated this conversation turn.
 *
 * A `TurnPrompt` defines the origin or cause of a model turn — whether it was
 * triggered by user input, a predefined prompt, a tool invocation result, or
 * an external MCP-provided prompt.
 */
export type TurnPrompt =
  | TurnPrompt.UserInput
  | TurnPrompt.UserPrompt
  | TurnPrompt.ToolResult
  | TurnPrompt.ExternalPrompt;

export namespace TurnPrompt {
  /**
   * Represents a turn that was triggered by direct user input.
   */
  export type UserInput = {
    type: "user-input";
    /**
     * The content provided by the user.
     */
    content: UserInput.ContentPart[];
  };

  export namespace UserInput {
    /**
     * Defines the structure of a user-provided content part.
     */
    export type ContentPart =
      | {
          /**
           * Plain text input from the user.
           */
          type: "text";
          text: string;
        }
      | {
          /**
           * File input provided by the user.
           */
          type: "file";
          /**
           * The MIME type of the file, e.g. `image/png`, `application/pdf`.
           */
          mimetype: string;
          /**
           * The URL of the file resource.
           */
          url: string;
        };
  }

  /**
   * Represents a turn initiated by a user-defined prompt.
   *
   * This captures a snapshot of the custom prompt used, including its
   * instruction and optional role definition.
   */
  export type UserPrompt = {
    type: "user-prompt";
    /**
     * The name of the custom prompt.
     */
    name: string;
    /**
     * The role definition associated with the prompt, if provided.
     */
    roleDefinition?: string;
    /**
     * The main instruction or task description of the prompt.
     */
    instruction: string;
    /**
     * Defines how this prompt's role definition should be merged with
     * the conversation's system prompt.
     */
    mergeStrategy: PromptMergeStrategy;
  };

  /**
   * Represents a turn that occurs after a tool call completes.
   *
   * This type records the parameters, results, and possible errors
   * from the tool invocation that triggered a new model response.
   */
  export type ToolResult = {
    type: "tool-result";
    /**
     * The unique ID of the tool call.
     */
    id: string;
    /**
     * The name of the invoked tool.
     */
    tool: string;
    /**
     * The input arguments passed to the tool.
     */
    arguments: unknown;
    /**
     * The raw result returned from the tool.
     */
    result: unknown;
    /**
     * The structured JSON output returned by the tool, if available.
     */
    structuredResult?: unknown;
    /**
     * Indicates whether the tool call resulted in an error.
     */
    isError: boolean;
  };

  /**
   * Represents a turn triggered by a prompt provided by an external MCP server.
   *
   * This captures metadata about the MCP server and the prompt content
   * returned by it.
   */
  export type ExternalPrompt = {
    type: "external-prompt";
    /**
     * Information about the MCP server that provided the prompt.
     */
    server: {
      /**
       * The unique ID of the MCP server instance.
       */
      id: string;
      /**
       * The display name of the MCP server.
       */
      name: string;
      /**
       * The server key identifying this MCP server.
       */
      key: string;
    };
    /**
     * The name of the external prompt.
     */
    name: string;
    /**
     * A short description of the external prompt, if available.
     */
    description?: string;
    /**
     * The raw message data that defines the prompt content as returned by MCP.
     */
    messages: unknown[];
  };
}

/**
 * Represents the model's reply content for a single conversation turn.
 */
export type TurnReply = TurnReply.ContentPart[];

export namespace TurnReply {
  /**
   * Defines a single part of the model's reply content.
   */
  export type ContentPart =
    | {
        /**
         * Plain text generated by the model.
         */
        type: "text";
        text: string;
      }
    | {
        /**
         * The model’s reasoning trace or explanation text.
         *
         * Typically used for displaying the model’s intermediate thinking
         * or hidden reasoning (when available and appropriate to expose).
         */
        type: "reasoning";
        text: string;
      }
    | {
        /**
         * Information about a tool invocation initiated by the model.
         *
         * This indicates that the model attempted to call a tool during
         * the conversation turn.
         */
        type: "tool-call";
        /**
         * The name of the invoked tool.
         */
        name: string;
        /**
         * The serialized input arguments passed to the tool.
         */
        input: string;
        /**
         * The unique identifier for this tool call.
         */
        id: string;
      }
    | {
        /**
         * An image output generated by the model.
         */
        type: "image";
        /**
         * The URL of the generated image resource.
         */
        url: string;
        /**
         * The MIME type of the image, e.g. `image/png`, `image/jpeg`.
         */
        mimetype: `image/${string}`;
      }
    | {
        /**
         * A reference to an external or cited information source.
         */
        type: "source";
        /**
         * The URL of the cited source.
         */
        url: string;
        /**
         * The display title of the source.
         */
        title: string;
        /**
         * A unique identifier for this source reference.
         */
        id: string;
      }
    | {
        /**
         * Represents an error message generated during the turn.
         */
        type: "error";
        /**
         * The error message text.
         */
        message: string;
      };
}

export type TurnUsage = {
  input?: number;
  output?: number;
  total?: number;
  reasoning?: number;
  cachedInput?: number;
};

export type Turn = InferSelectModel<typeof turn>;
export type TurnRaw = InferSelectModel<typeof turn, { dbColumnNames: true }>;
export type TurnInsert = InferInsertModel<typeof turn>;
export type TurnFinishReason = InferEnum<typeof turnFinishReason>;

export type ProviderKind = InferEnum<typeof providerKind>;
export type Provider = InferSelectModel<typeof provider>;
export type ProviderRaw = InferSelectModel<typeof provider, { dbColumnNames: true }>;
export type ProviderInsert = InferInsertModel<typeof provider>;

export type Usage = InferSelectModel<typeof usage>;
export type UsageRaw = InferSelectModel<typeof usage, { dbColumnNames: true }>;
export type UsageInsert = InferInsertModel<typeof usage>;
