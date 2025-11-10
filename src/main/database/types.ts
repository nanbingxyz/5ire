import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type {
  collection,
  conversationCollection,
  document,
  documentChunk,
  prompt,
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

/**
 * The model that can be applied to a prompt.
 */
export type PromptApplicableModel = {
  /**
   * The id of the model.
   */
  id: string;
};

export type Prompt = InferSelectModel<typeof prompt>;
export type PromptRaw = InferSelectModel<typeof prompt, { dbColumnNames: true }>;
export type PromptInsert = InferInsertModel<typeof prompt>;
