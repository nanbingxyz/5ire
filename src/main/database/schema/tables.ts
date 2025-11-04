import { index, integer, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar, vector } from "drizzle-orm/pg-core";

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
};

/**
 * The `collections` table is used to store knowledge collections created by users.
 */
export const collection = pgTable("collections", collectionColumns, (table) => {
  return [index().on(table.createTime), index().on(table.name)];
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
  documentId: uuid()
    .notNull()
    .references(() => document.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
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
  conversationId: varchar().notNull(),
  /**
   * Associates with the knowledge collection it belongs to.
   */
  collectionId: uuid()
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
  return [index().on(table.createTime), index().on(table.conversationId)];
});
