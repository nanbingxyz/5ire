import type { InferEnum, InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  bookmark,
  collection,
  conversation,
  conversationCollection,
  document,
  documentChunk,
  project,
  prompt,
  provider,
  providerKind,
  server,
  serverApprovalPolicy,
  serverTransport,
  turn,
  turnFinishReason,
  usage,
} from "@/main/database/schema/tables";
import type { Message, Part } from "@/main/model/content-specification";

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

export type ProjectStageConversation = {
  model?: {
    name: string;
    provider: string;
  };
  config?: ConversationConfig;
};

export type ProjectConfig = {
  stageConversation?: ProjectStageConversation;
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
  maxOutputTokens: number;
  /**
   * Controls the randomness of the model’s output.
   */
  temperature: number;
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
  | TurnPrompt.ToolCompletion
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
    content: Array<Part.Text | Part.Reference>;
  };

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
  };

  /**
   * Represents a turn that occurs after tool calls complete.
   *
   * This type records the results from multiple tool invocations that triggered
   * a new model response. Each result contains the output or error information
   * from a specific tool call.
   */
  export type ToolCompletion = {
    type: "tool-completion";
    /**
     * The array of tool results that were executed in parallel.
     */
    results: Part.ToolResult[];
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
     * The message data that defines the prompt content as returned by MCP.
     */
    messages: {
      role: "user" | "assistant";
      content: Array<Part.Text | Part.Reference | Part.Resource>;
    }[];
  };
}

/**
 * Represents the model's reply content for a single conversation turn.
 */
export type TurnReply = Extract<Message, { role: "assistant" }>["content"];

/**
 * Represents the token usage statistics for a single conversation turn.
 *
 * This type captures the breakdown of tokens consumed during the processing
 * of a turn, including input tokens, output tokens, and various specialized
 * token counts such as those used for reasoning or cached content.
 */
export type TurnUsage = {
  /**
   * The number of tokens used in the input (prompt) for this turn.
   */
  input?: number;
  /**
   * The number of tokens generated in the output (completion) for this turn.
   */
  output?: number;
  /**
   * The number of tokens used for reasoning or thinking processes, if supported by the model.
   */
  reasoning?: number;
  /**
   * The number of tokens used for caching input content, if supported by the model.
   */
  inputCacheHit?: number;
  /**
   * The number of tokens used for caching output content, if supported by the model.
   */
  inputCacheMiss?: number;
};

export type Turn = InferSelectModel<typeof turn>;
export type TurnRaw = InferSelectModel<typeof turn, { dbColumnNames: true }>;
export type TurnInsert = InferInsertModel<typeof turn>;
export type TurnFinishReason = InferEnum<typeof turnFinishReason>;

export type ProviderConfig = {
  /**
   * The parameters to configure the provider.
   */
  parameters: Record<string, string>;
  /**
   * The proxy URL to use for requests to the provider.
   */
  proxy?: string;
  /**
   * The custom models to use for this provider.
   */
  customModels?: unknown[];
};

export type ProviderKind = InferEnum<typeof providerKind>;
export type Provider = InferSelectModel<typeof provider>;
export type ProviderRaw = InferSelectModel<typeof provider, { dbColumnNames: true }>;
export type ProviderInsert = InferInsertModel<typeof provider>;

export type Usage = InferSelectModel<typeof usage>;
export type UsageRaw = InferSelectModel<typeof usage, { dbColumnNames: true }>;
export type UsageInsert = InferInsertModel<typeof usage>;

export type ServerTransport = InferEnum<typeof serverTransport>;
export type ServerApprovalPolicy = InferEnum<typeof serverApprovalPolicy>;
export type Server = InferSelectModel<typeof server>;
export type ServerRaw = InferSelectModel<typeof server, { dbColumnNames: true }>;
export type ServerInsert = InferInsertModel<typeof server>;

export type BookmarkSnapshot = Pick<Turn, "prompt" | "id" | "reply"> & {
  /**
   * The name of the model used to process this turn.
   */
  model: string;
};

export type Bookmark = InferSelectModel<typeof bookmark>;
export type BookmarkRaw = InferSelectModel<typeof bookmark, { dbColumnNames: true }>;
export type BookmarkInsert = InferInsertModel<typeof bookmark>;
