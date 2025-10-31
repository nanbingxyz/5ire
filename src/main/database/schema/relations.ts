import { relations } from "drizzle-orm";
import { collection, document, documentChunk } from "@/main/database/schema/tables";

/**
 * Defines the relationships between the `collection` table and other tables.
 */
export const collectionRelations = relations(collection, (helpers) => {
  return {
    /**
     * A knowledge collection can contain multiple documents.
     */
    documents: helpers.many(document),
  };
});

/**
 * Defines the relationships between the `document` table and other tables.
 */
export const documentRelations = relations(document, (helpers) => {
  return {
    /**
     * Associates with the knowledge collection it belongs to.
     */
    collection: helpers.one(collection, {
      references: [collection.id],
      fields: [document.collectionId],
    }),
    /**
     * A document can contain multiple document chunks.
     */
    chunks: helpers.many(documentChunk),
  };
});

/**
 * Defines the relationships between the `documentChunk` table and other tables.
 */
export const documentChunkRelations = relations(documentChunk, (helpers) => {
  return {
    /**
     * Associates with the document it belongs to.
     */
    document: helpers.one(document, {
      references: [document.id],
      fields: [documentChunk.documentId],
    }),
  };
});
