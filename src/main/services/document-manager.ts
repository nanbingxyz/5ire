import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { Results } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { MAX_COLLECTIONS, SUPPORTED_DOCUMENT_URL_SCHEMAS } from "@/main/constants";
import { Database } from "@/main/database";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

/**
 * DocumentManager class is used to manage document collections and documents
 * Provides functions to create, delete, update collections and import, delete documents
 */
export class DocumentManager {
  #database = Container.inject(Database);
  #logger = Container.inject(Logger).scope("DocumentsManager");

  /**
   * Create a new document collection
   * @param options Options for creating a collection, including name and description
   * @returns Promise<Collection> The created collection object
   * @throws Error when the number of collections reaches the limit
   */
  async createCollection(options: DocumentManager.CreateCollectionOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      const count = await tx.$count(schema.collection);

      if (count >= MAX_COLLECTIONS) {
        throw new Error("Maximum number of collections reached.");
      }

      return tx
        .insert(schema.collection)
        .values({
          name: options.name,
          description: options.description,
        })
        .returning()
        .execute()
        .then((result) => {
          return result[0];
        });
    });
  }

  /**
   * Delete the specified document collection
   * @param options Options containing the ID of the collection to delete
   * @returns Promise<void>
   * @throws Error when the collection does not exist
   */
  async deleteCollection(options: DocumentManager.DeleteCollectionOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      const exists = await tx
        .$count(schema.collection, eq(schema.collection.id, options.id))
        .then((count) => count > 0);

      if (!exists) {
        throw new Error("Collection does not exist.");
      }

      return tx.delete(schema.collection).where(eq(schema.collection.id, options.id)).execute();
    });
  }

  /**
   * Update the specified document collection
   * @param options Options containing the collection ID, new name and new description
   * @returns Promise<void>
   * @throws Error when the collection does not exist
   */
  async updateCollection(options: DocumentManager.UpdateCollectionOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      const exists = await tx
        .$count(schema.collection, eq(schema.collection.id, options.id))
        .then((count) => count > 0);

      if (!exists) {
        throw new Error("Collection does not exist.");
      }

      return tx
        .update(schema.collection)
        .set({
          name: options.name,
          description: options.description,
        })
        .where(eq(schema.collection.id, options.id))
        .execute();
    });
  }

  /**
   * Import documents into the specified collection
   * @param options Options containing the target collection ID and document URL list
   * @returns Promise<void>
   * @throws Error when the collection does not exist, URL is invalid, or document already exists
   */
  async importDocuments(options: DocumentManager.ImportDocumentsOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    const urls = options.urls.map((url) => {
      try {
        return new URL(url);
      } catch (e) {
        throw new Error(`Invalid URL: ${url}`);
      }
    });

    if (urls.length === 0) {
      throw new Error("No URLs provided.");
    }

    if (urls.some((url) => !SUPPORTED_DOCUMENT_URL_SCHEMAS.includes(url.protocol.slice(0, -1)))) {
      throw new Error(
        `Unsupported document URL schema. Only ${SUPPORTED_DOCUMENT_URL_SCHEMAS.join(", ")} are supported.`,
      );
    }

    return client.transaction(async (tx) => {
      const exists = await tx
        .$count(schema.collection, eq(schema.collection.id, options.collection))
        .then((count) => count > 0);

      if (!exists) {
        throw new Error("Collection does not exist.");
      }

      const stringifiedUrlSet = new Set(urls.map((url) => url.toString()));
      const stringifiedUrls = Array.from(stringifiedUrlSet);

      for (const url of stringifiedUrls) {
        await tx
          .$count(schema.collection, eq(schema.document.url, url))
          .then((count) => count > 0)
          .then((exists) => {
            if (exists) {
              throw new Error(`Document ${url} already exists.`);
            }
          });
      }

      return tx
        .insert(schema.document)
        .values(
          stringifiedUrls.map((url) => {
            let name = url;

            if (url.startsWith("file://")) {
              name = basename(fileURLToPath(url));
            }

            return {
              url,
              collectionId: options.collection,
              name,
              status: "pending" as const,
              mimetype: "unknown",
              error: null,
            };
          }),
        )
        .execute();
    });
  }

  /**
   * Delete the specified document
   * @param options Options containing the ID of the document to delete
   * @returns Promise<void>
   * @throws Error when the document does not exist
   */
  async deleteDocument(options: DocumentManager.DeleteDocumentOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      const exists = await tx.$count(schema.collection, eq(schema.document.id, options.id)).then((count) => count > 0);

      if (!exists) {
        throw new Error("Document does not exist.");
      }

      return tx.delete(schema.document).where(eq(schema.document.id, options.id)).execute();
    });
  }

  /**
   * Listen to collection changes in real-time
   * Returns a readable stream that continuously pushes updates of collections and their document counts
   * @returns ReadableStream<Results<QueryResultRow>> Real-time data stream
   */
  liveCollections() {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;

    const query = client
      .select({
        id: schema.collection.id,
        name: schema.collection.name,
        description: schema.collection.description,
        createTime: schema.collection.createTime,
        updateTime: schema.collection.updateTime,
        documents: client
          .$count(schema.document, eq(schema.document.collectionId, schema.collection.id))
          .as("documents"),
      })
      .from(schema.collection);
    const sql = query.toSQL();
    const abort = new AbortController();

    type QueryResultRow = Awaited<ReturnType<(typeof query)["execute"]>>[number];

    return new ReadableStream<Results<QueryResultRow>>({
      cancel: () => {
        abort.abort();
      },
      start: (controller) => {
        driver.live
          .query<QueryResultRow>({
            query: sql.sql,
            params: sql.params,
            callback: (results) => {
              controller.enqueue(results);
            },
            signal: abort.signal,
          })
          .catch((error) => {
            controller.error(error);
          });
      },
    });
  }
}

export namespace DocumentManager {
  /**
   * Create collection options
   * Defines parameters required for creating a new collection
   */
  export type CreateCollectionOptions = {
    /**
     * Collection name
     */
    name: string;
    /**
     * Collection description
     */
    description: string;
  };

  /**
   * Update collection options
   * Defines parameters required for updating a collection
   */
  export type UpdateCollectionOptions = {
    /**
     * Collection ID
     */
    id: string;
    /**
     * New collection name
     */
    name: string;
    /**
     * New collection description
     */
    description: string;
  };

  /**
   * Delete collection options
   * Defines parameters required for deleting a collection
   */
  export type DeleteCollectionOptions = {
    /**
     * ID of the collection to delete
     */
    id: string;
  };

  /**
   * Import documents options
   * Defines parameters required for importing documents
   */
  export type ImportDocumentsOptions = {
    /**
     * Target collection ID
     */
    collection: string;
    /**
     * Document URL list
     */
    urls: string[];
  };

  /**
   * Delete document options
   * Defines parameters required for deleting a document
   */
  export type DeleteDocumentOptions = {
    /**
     * ID of the document to delete
     */
    id: string;
  };
}
