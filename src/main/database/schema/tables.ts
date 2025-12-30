import { isNotNull } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import type {
  BookmarkSnapshot,
  ConversationConfig,
  ProjectConfig,
  TurnMetadata,
  TurnPrompt,
  TurnReply,
  TurnUsage,
} from "@/main/database/types";

/**
 * Defines a column for recording the creation time.
 */
const makeCreateTime = () => {
  return timestamp("create_time").defaultNow().notNull();
};

/**
 * Defines a column for recording the update time and automatically updating it.
 */
const makeUpdateTime = () => {
  return timestamp("update_time")
    .defaultNow()
    .notNull()
    .$onUpdate(() => {
      return new Date();
    });
};

/**
 * Schema definition for the `collections` table.
 */
const collectionColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * The name of the collection.
   */
  name: varchar({ length: 300 }).notNull(),
  /**
   * The description of the collection.
   */
  description: varchar().notNull(),
  /**
   * The pinned time of the collection.
   */
  pinedTime: timestamp("pined_time"),
  /**
   * The project ID the collection belongs to.
   */
  projectId: uuid("project_id").references(() => project.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  /**
   * The legacy ID of the collection.
   */
  legacyId: varchar("legacy_id", { length: 300 }),
};

/**
 * The `collections` table is used to store knowledge collections created by users.
 */
export const collection = pgTable("collections", collectionColumns, (table) => {
  return [
    index().on(table.createTime),
    index().on(table.name),
    uniqueIndex().on(table.legacyId).where(isNotNull(table.legacyId)),
  ];
});

/**
 * The status of document vectorization.
 */
export const documentStatus = pgEnum("document_status", ["pending", "processing", "completed", "failed"]);

/**
 * Schema definition for the `documents` table.
 */
const documentColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * Associates with the knowledge collection it belongs to.
   */
  collectionId: uuid("collection_id")
    .notNull()
    .references(() => collection.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  /**
   * The name of the document.
   */
  name: varchar({ length: 300 }).notNull(),
  /**
   * The source URL of the document.
   */
  url: varchar({ length: 300 }).notNull(),
  /**
   * The status of the document.
   */
  status: documentStatus().default("pending").notNull(),
  /**
   * The error message when vectorization fails.
   * Nullable — only present when `status` is "failed".
   */
  error: varchar(),
  /**
   * The MIME type of the document.
   */
  mimetype: varchar().notNull(),
  /**
   * The size of the document.
   */
  size: integer().default(0).notNull(),
  /**
   * The legacy ID of the document.
   */
  legacyId: varchar("legacy_id", { length: 300 }),
};

/**
 * The `documents` table is used to store specific documents in a collection.
 */
export const document = pgTable("documents", documentColumns, (table) => {
  return [
    index().on(table.collectionId),
    index().on(table.name),
    index().on(table.createTime),
    index().on(table.url),
    // Duplicate documents are not allowed in knowledge collection
    uniqueIndex().on(table.collectionId, table.url),
    uniqueIndex().on(table.legacyId).where(isNotNull(table.legacyId)),
  ];
});

/**
 * Schema definition for the `document_chunks` table.
 */
const documentChunkColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * The text content of the chunk.
   */
  text: varchar().notNull(),
  /**
   * The index of the chunk in the document.
   */
  index: integer().default(0).notNull(),
  /**
   * Vector embedding representation of the text content for similarity search.
   */
  embedding: vector({ dimensions: 1024 }).notNull(),
  /**
   * Associates with the document it belongs to.
   */
  documentId: uuid("document_id")
    .notNull()
    .references(() => document.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  /**
   * The legacy ID of the document chunk.
   */
  legacyId: varchar("legacy_id", { length: 300 }),
};

/**
 * The `document_chunks` table is used to store text chunks and their vector representations split from documents.
 */
export const documentChunk = pgTable("document_chunks", documentChunkColumns, (table) => {
  return [
    index().on(table.createTime),
    index().using("hnsw", table.embedding.op("vector_cosine_ops")),
    // Duplicate chunk indexes are not allowed for the same document
    uniqueIndex().on(table.documentId, table.index),
    uniqueIndex().on(table.legacyId).where(isNotNull(table.legacyId)),
  ];
});

/**
 * Schema definition for the `conversation_collections` table.
 */
const conversationCollectionColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * The conversation identifier.
   */
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversation.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  /**
   * Associates with the knowledge collection it belongs to.
   */
  collectionId: uuid("collection_id")
    .notNull()
    .references(() => collection.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
};

/**
 * The `conversation_collections` table is used to store the relationship between conversations and knowledge collections.
 */
export const conversationCollection = pgTable("conversation_collections", conversationCollectionColumns, (table) => {
  return [
    index().on(table.createTime),
    index().on(table.conversationId),
    uniqueIndex().on(table.conversationId, table.collectionId),
  ];
});

/**
 * Schema definition for the `prompts` table.
 */
const promptColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * The name of the prompt.
   */
  name: varchar({ length: 300 }).notNull(),
  /**
   * "Role definition" or "behavioral instruction"
   */
  roleDefinitionTemplate: varchar("role_definition_template"),
  /**
   * Template used to generate user instructions
   */
  instructionTemplate: varchar("instruction_template").notNull(),
  /**
   * The legacy ID of the prompt.
   */
  legacyId: varchar("legacy_id", { length: 300 }),
};

/**
 * The `prompts` table is used to store user-defined prompts.
 */
export const prompt = pgTable("prompts", promptColumns, (table) => {
  return [
    index().on(table.createTime),
    index().on(table.name),
    uniqueIndex().on(table.legacyId).where(isNotNull(table.legacyId)),
  ];
});

/**
 * Schema definition for the `projects` table.
 */
const projectColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * The name of the project.
   */
  name: varchar({ length: 300 }).notNull(),
  /**
   * The project config.
   */
  config: jsonb().$type<ProjectConfig>().notNull(),
  /**
   * The legacy folder ID of the project.
   */
  legacyFolderId: varchar("legacy_folder_id", { length: 300 }),
  /**
   * Custom system prompt used for this project.
   */
  systemPrompt: varchar("system_prompt"),
};

/**
 * The `projects` table is used to store project information.
 */
export const project = pgTable("projects", projectColumns, (table) => {
  return [
    index().on(table.createTime),
    index().on(table.name),
    uniqueIndex().on(table.legacyFolderId).where(isNotNull(table.legacyFolderId)),
  ];
});

/**
 * Schema definition for the `conversations` table.
 */
const conversationColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * Associates with the project it belongs to.
   */
  projectId: uuid("project_id").references(() => project.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  /**
   * A brief summary or title of the conversation.
   */
  summary: varchar({ length: 300 }).notNull(),
  /**
   * Custom system prompt used for this conversation.
   */
  systemPrompt: varchar("system_prompt"),
  /**
   * The configuration for the conversation.
   */
  config: jsonb().$type<ConversationConfig>().notNull(),
  /**
   * The provider used for this conversation.
   */
  providerId: uuid("provider_id").references(() => provider.id, {
    onDelete: "set null",
    onUpdate: "set null",
  }),
  /**
   * The model used for this conversation.
   */
  model: varchar(),
};

/**
 * The `conversations` table is used to store conversation information.
 */
export const conversation = pgTable("conversations", conversationColumns, (table) => {
  return [index().on(table.createTime)];
});

/**
 * Represents the possible reasons why a conversation turn has finished.
 *
 * - `length`: The turn ended because the maximum token limit or length constraint was reached.
 * - `stop`: The turn ended naturally or due to an explicit stop sequence.
 * - `content-filter`: The turn was interrupted by a content moderation or filtering policy.
 * - `tool-calls`: The turn concluded with one or more tool invocations.
 * - `error`: The turn terminated due to an internal or runtime error.
 * - `unrecognized`: The turn ended with a reason that is not defined in this enumeration (e.g., from an unknown API value).
 * - `unknown`: The reason for the turn’s completion has not been determined yet.
 */
export const turnFinishReason = pgEnum("turn_finish_reason", [
  "length",
  "stop",
  "content-filter",
  "tool-calls",
  "error",
  "unrecognized",
  "unknown",
]);

/**
 * Schema definition for the `turns` table.
 */
const turnColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * Metadata related to the turn, such as token usage or other metrics.
   */
  metadata: jsonb().$type<TurnMetadata>().notNull(),
  /**
   * The prompt used for this turn, including user input and any templating information.
   */
  prompt: jsonb().$type<TurnPrompt>().notNull(),
  /**
   * Associates with the conversation it belongs to.
   */
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversation.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  /**
   * The reason why the turn finished, e.g., "stop", "length", etc.
   */
  finishReason: turnFinishReason("finish_reason").notNull().default("unknown"),
  /**
   * The reply generated by the model for this turn.
   */
  reply: jsonb().$type<TurnReply>().default([]).notNull(),
  /**
   * Usage statistics for the turn, such as token usage.
   */
  usage: jsonb().$type<TurnUsage>().notNull(),
  /**
   * The error message if the turn ended with an error.
   */
  error: varchar(),
};

/**
 * The `turns` table is used to store conversation turns.
 */
export const turn = pgTable("turns", turnColumns, (table) => {
  return [index().on(table.createTime)];
});

export const providerKind = pgEnum("provider_kind", [
  "openai",
  "openai-compatible",
  "anthropic",
  "cohere",
  "google",
  "azure",
  "baidu",
  "doubao",
  "grok",
  "302-ai",
  "zhipu",
  "perplexity",
  "moonshot",
  "ollama",
  "lm-studio",
  "mistral",
  "deepseek",
]);

/**
 * Schema definition for the `providers` table.
 */
const providerColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * The kind of provider.
   */
  kind: providerKind().notNull(),
  /**
   * The display label for end users.
   */
  label: varchar({ length: 300 }).notNull(),
  /**
   * The remark for the provider.
   */
  remark: varchar({ length: 300 }),
  /**
   * The configuration of the provider.
   */
  config: jsonb().$type<Record<string, unknown>>().notNull(),
};

export const provider = pgTable("providers", providerColumns, (table) => {
  return [index().on(table.createTime), index().on(table.label)];
});

/**
 * Schema definition for the `usages` table.
 */
const usageColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * Associates with the provider it belongs to.
   */
  providerId: uuid("provider_id")
    .notNull()
    .references(() => provider.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  /**
   * The model name associated with the usage record.
   */
  model: varchar({ length: 300 }).notNull(),
  /**
   * The number of input tokens used.
   */
  input: integer().notNull().default(0),
  /**
   * The number of output tokens used.
   */
  output: integer().notNull().default(0),
  /**
   * The number of cached input tokens used.
   */
  cachedInput: integer("cached_input").notNull().default(0),
  /**
   * The number of reasoning tokens used (for reasoning-intensive models).
   */
  reasoning: integer().notNull().default(0),
};

export const usage = pgTable("usages", usageColumns, (table) => {
  return [index().on(table.createTime), index().on(table.providerId), uniqueIndex().on(table.providerId, table.model)];
});

/**
 * Schema definition for the `bookmarks` table.
 */
const bookmarkColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * The snapshot of the turn associated with the bookmark.
   */
  snapshot: jsonb().$type<BookmarkSnapshot>().notNull(),
  /**
   * Whether the bookmark is a favorite.
   */
  favorite: boolean().notNull().default(false),
};

/**
 * Bookmarks table is used to store user bookmarks.
 */
export const bookmark = pgTable("bookmarks", bookmarkColumns, (table) => {
  return [index().on(table.createTime), index().on(table.favorite)];
});

// const serverColumns = {};
/**
 * MCP server transport protocols
 * - stdio: Standard Input/Output
 * - http-streamable: HTTP Streamable
 */
export const serverTransport = pgEnum("server_transport", ["stdio", "http-streamable"]);

/**
 * Approval policy when model requests to call tools:
 * - always: Always require confirmation
 * - never: Default, no confirmation required
 * - once: Only require confirmation once
 */
export const serverApprovalPolicy = pgEnum("server_approval_policy", ["always", "never", "once"]);

/**
 * Schema definition for the `servers` table.
 */
const serverColumns = {
  /**
   * The unique identifier for the record.
   */
  id: uuid().primaryKey().defaultRandom(),
  /**
   * The creation time of the record.
   */
  createTime: makeCreateTime(),
  /**
   * The last update time of the record.
   */
  updateTime: makeUpdateTime(),
  /**
   * The display label for end users.
   */
  label: varchar({ length: 300 }).notNull(),
  /**
   * The description for the server.
   */
  description: varchar({ length: 300 }),
  /**
   * The transport protocol used by the server.
   */
  transport: serverTransport().notNull(),
  /**
   * The endpoint for the server.
   * - When `transport` is "stdio", this is the command to start the process.
   * - When `transport` is "http-streamable", this is the URL to connect to.
   */
  endpoint: varchar({ length: 600 }).notNull(),
  /**
   * Configuration for the server.
   * - When `transport` is "stdio", this represents environment variables.
   * - When `transport` is "http-streamable", this represents HTTP headers.
   */
  config: jsonb().$type<Record<string, string>>().notNull(),
  /**
   * Associates with the project it belongs to.
   */
  projectId: uuid("project_id").references(() => project.id, {
    onDelete: "cascade",
    onUpdate: "cascade",
  }),
  /**
   * Whether the server is active.
   */
  active: boolean().notNull().default(true),
  /**
   * The approval policy for model requests to call tools.
   */
  approvalPolicy: serverApprovalPolicy("approval_policy").notNull().default("once"),
};

/**
 * The `servers` table is used to store mcp server configurations.
 */
export const server = pgTable("servers", serverColumns, (table) => {
  return [index().on(table.createTime), index().on(table.projectId)];
});
