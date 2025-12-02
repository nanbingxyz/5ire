import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { and, cosineDistance, eq, inArray, type SQL } from "drizzle-orm";
import { dialog } from "electron";
import { default as memoize } from "memoizee";
import {
  COMMON_BINARY_DOCUMENT_FILE_MIMETYPES,
  COMMON_TEXTUAL_FILE_MIMETYPES,
  MAX_DOCUMENT_SIZE,
  SUPPORTED_DOCUMENT_URL_SCHEMAS,
} from "@/main/constants";
import { Database } from "@/main/database";
import { Container } from "@/main/internal/container";
import { Embedder } from "@/main/services/embedder";
import { LegacyDataMigrator } from "@/main/services/legacy-data-migrator";
import { Logger } from "@/main/services/logger";

/**
 * DocumentManager class is used to manage document collections and documents
 * Provides functions to create, delete, update collections and import, delete documents
 */
export class DocumentManager {
  #database = Container.inject(Database);
  #logger = Container.inject(Logger).scope("DocumentsManager");
  #embedder = Container.inject(Embedder);
  #legacyDataMigrator = Container.inject(LegacyDataMigrator);

  /**
   * Constructor to initialize the DocumentManager instance
   *
   * This constructor sets up memoization for live query methods to improve performance
   * by caching the results of identical method calls.
   *
   * Configuration options:
   * - primitive: true enables primitive value comparison for cache keys
   * - promise: true handles Promise-returning functions properly
   * - normalizer: function to generate cache keys from method arguments
   */
  constructor() {
    this.liveCollections = memoize(this.liveCollections.bind(this), {
      primitive: true,
      promise: true,
    });
    this.liveDocuments = memoize(this.liveDocuments.bind(this), {
      primitive: true,
      promise: true,
      normalizer: (args) => args[0],
    });
  }

  /**
   * Create a new document collection
   * @param options Options for creating a collection, including name and description
   * @returns Promise<Collection> The created collection object
   */
  async createCollection(options: DocumentManager.CreateCollectionOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
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
          .$count(
            schema.document,
            and(eq(schema.document.url, url), eq(schema.document.collectionId, options.collection)),
          )
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

  async importDocumentsFromFileSystem(options: DocumentManager.ImportDocumentsFromFileSystemOptions) {
    const extensions = [
      ...Object.keys(COMMON_TEXTUAL_FILE_MIMETYPES),
      ...Object.keys(COMMON_BINARY_DOCUMENT_FILE_MIMETYPES),
    ];

    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Documents",
          extensions,
        },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return;
    }

    for (const path of result.filePaths) {
      const extension = path.split(".").pop()?.toLowerCase();

      if (!extension || !extensions.includes(extension)) {
        throw new Error(`Unsupported file type for ${path}`);
      }

      await stat(path).then((stats) => {
        if (stats.size > MAX_DOCUMENT_SIZE) {
          throw new Error(`File ${path} is too large. Maximum size is ${MAX_DOCUMENT_SIZE / (1024 * 1024)} MB.`);
        }
      });
    }

    return this.importDocuments({
      collection: options.collection,
      urls: result.filePaths.map((path) => pathToFileURL(path, { windows: process.platform === "win32" }).toString()),
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
      const exists = await tx.$count(schema.document, eq(schema.document.id, options.id)).then((count) => count > 0);

      if (!exists) {
        throw new Error("Document does not exist.");
      }

      return tx.delete(schema.document).where(eq(schema.document.id, options.id)).execute();
    });
  }

  /**
   * Toggle the pin status of a collection
   * @param options Options containing the collection ID to toggle pin status
   * @returns Promise<void>
   * @throws Error when the collection does not exist
   */
  async toggleCollectionPin(options: DocumentManager.ToggleCollectionPinOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    return client.transaction(async (tx) => {
      // Check if collection exists
      const collection = await tx
        .select({
          id: schema.collection.id,
          pinedTime: schema.collection.pinedTime,
        })
        .from(schema.collection)
        .where(eq(schema.collection.id, options.id))
        .execute()
        .then((result) => {
          if (result.length === 0) {
            return null;
          }
          return result[0];
        });

      if (!collection) {
        throw new Error("Collection does not exist.");
      }

      // Toggle pin status - if pinedTime is set, clear it; otherwise set it to current time
      const newPinedTime = collection.pinedTime ? null : new Date();

      return tx
        .update(schema.collection)
        .set({
          pinedTime: newPinedTime,
        })
        .where(eq(schema.collection.id, options.id))
        .execute();
    });
  }

  /**
   * Listen to collection changes in real-time
   * Returns an object with subscribe method, refresh function and initial results
   * that continuously pushes updates of collections and their document counts
   * @returns Object containing:
   * - subscribe: Function to add a subscriber that receives updates
   * - refresh: Function to manually refresh the data
   * - initialResults: Initial set of collection data with document counts
   */
  async liveCollections() {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;

    const query = client
      .select({
        ...Database.utils.aliasedColumns({
          id: schema.collection.id,
          name: schema.collection.name,
          description: schema.collection.description,
          createTime: schema.collection.createTime,
          updateTime: schema.collection.updateTime,
          pinedTime: schema.collection.pinedTime,
          legacyId: schema.collection.legacyId,
        }),
        ...{
          documents: client
            .$count(schema.document, eq(schema.document.collectionId, schema.collection.id))
            .as("documents"),
        },
      })
      .from(schema.collection)
      .orderBy(schema.collection.pinedTime, schema.collection.createTime);

    const sql = query.toSQL();
    const subscribers = new Set<(results: typeof live.initialResults) => void>();

    const live = await driver.live.query<Awaited<ReturnType<(typeof query)["execute"]>>[number]>({
      query: sql.sql,
      params: sql.params,
      callback: (results) => {
        for (const subscriber of subscribers) {
          subscriber(results);
        }
      },
    });

    return {
      subscribe: (subscriber: (results: typeof live.initialResults) => void) => {
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      },
      refresh: live.refresh,
      initialResults: live.initialResults,
    };
  }

  /**
   * Listen to document changes in real-time for a specific collection
   * Returns an object with subscribe method, refresh function and initial results
   * that continuously pushes updates of documents in the collection
   * @param collection Collection ID to listen to
   * @returns Object containing:
   * - subscribe: Function to add a subscriber that receives updates
   * - refresh: Function to manually refresh the data
   * - initialResults: Initial set of document data
   */
  async liveDocuments(collection: string) {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;

    const query = client
      .select({
        ...Database.utils.aliasedColumns({
          id: schema.document.id,
          name: schema.document.name,
          url: schema.document.url,
          status: schema.document.status,
          error: schema.document.error,
          createTime: schema.document.createTime,
          updateTime: schema.document.updateTime,
          size: schema.document.size,
        }),
        ...{
          chunks: client
            .$count(schema.documentChunk, eq(schema.documentChunk.documentId, schema.document.id))
            .as("chunks"),
        },
      })
      .from(schema.document)
      .where(eq(schema.document.collectionId, collection));

    const sql = query.toSQL();
    const subscribers = new Set<(results: typeof live.initialResults) => void>();

    const live = await driver.live.query<Awaited<ReturnType<(typeof query)["execute"]>>[number]>({
      query: sql.sql,
      params: sql.params,
      callback: (results) => {
        for (const subscriber of subscribers) {
          subscriber(results);
        }
      },
    });

    return {
      subscribe: (subscriber: (results: typeof live.initialResults) => void) => {
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      },
      refresh: live.refresh,
      initialResults: live.initialResults,
    };
  }

  /**
   * Associate a collection with a target entity
   * @param options Options containing the collection ID, target entity ID and association type
   * @returns Promise<void>
   * @throws Error when the collection does not exist
   */
  async associateCollection(options: DocumentManager.AssociateCollectionOptions) {
    const schema = this.#database.schema;
    const client = this.#database.client;

    return client.transaction(async (tx) => {
      // Check if collection exists
      const exists = await tx
        .select({
          id: schema.collection.id,
        })
        .from(schema.collection)
        .where(eq(schema.collection.id, options.id))
        .execute()
        .then((result) => {
          return result.length > 0;
        });

      if (!exists) {
        throw new Error("Collection does not exist.");
      }

      if (options.type === "conversation") {
        return this.#legacyDataMigrator.updateTransitional((draft) => {
          const chatCollections = draft.chatCollections || new Map<string, string[]>();
          const collections = chatCollections.get(options.target) || [];

          collections.push(options.id);
          chatCollections.set(options.target, [...new Set(collections)]);

          draft.chatCollections = new Map(chatCollections);
        });
        // return tx
        //   .insert(schema.conversationCollection)
        //   .values({
        //     collectionId: options.id,
        //     conversationId: options.target,
        //   })
        //   .onConflictDoNothing()
        //   .execute();
      }
    });
  }

  /**
   * Disassociate a collection from a target entity
   * @param options Options containing the collection ID, target entity ID and association type
   * @returns Promise<void>
   */
  async disassociateCollection(options: DocumentManager.DisassociateCollectionOptions) {
    // const schema = this.#database.schema;
    // const client = this.#database.client;

    if (options.type === "conversation") {
      return this.#legacyDataMigrator.updateTransitional((draft) => {
        const chatCollections = draft.chatCollections || new Map<string, string[]>();
        const collections = chatCollections.get(options.target) || [];

        collections.push(options.id);
        chatCollections.set(
          options.target,
          collections.filter((collection) => collection !== options.id),
        );

        draft.chatCollections = new Map(chatCollections);
      });
      // return client
      //   .delete(schema.conversationCollection)
      //   .where(
      //     and(
      //       eq(schema.conversationCollection.collectionId, options.id),
      //       eq(schema.conversationCollection.conversationId, options.target),
      //     ),
      //   )
      //   .execute();
    }
  }

  /**
   * List collections associated with a target entity
   * @param options Options containing the target entity ID and association type
   * @returns Promise<Array> List of associated collections with their document counts
   */
  async listAssociatedCollections(options: DocumentManager.ListAssociatedCollectionsOptions) {
    const schema = this.#database.schema;
    const client = this.#database.client;

    const select = {
      id: schema.collection.id,
      name: schema.collection.name,
      description: schema.collection.description,
      createTime: schema.collection.createTime,
      updateTime: schema.collection.updateTime,
      pinedTime: schema.collection.pinedTime,
      documents: client.$count(schema.document, eq(schema.document.collectionId, schema.collection.id)).as("documents"),
      legacyId: schema.collection.legacyId,
    };

    if (options.type === "conversation") {
      const ids = this.#legacyDataMigrator.state.transitional.chatCollections?.get(options.target) || [];

      return client.select(select).from(schema.collection).where(inArray(schema.collection.id, ids)).execute();
    }

    return [];
  }

  /**
   * Update the target entity of associated collections
   * @param options Options containing the old target entity ID, new target entity ID and association type
   * @returns Promise<void>
   */
  async updateAssociatedCollectionsTarget(options: DocumentManager.UpdateAssociatedCollectionsTargetOptions) {
    if (options.type === "conversation") {
      return this.#legacyDataMigrator.updateTransitional((draft) => {
        const chatCollections = draft.chatCollections || new Map<string, string[]>();
        const collections = chatCollections.get(options.oldTarget) || [];

        chatCollections.set(options.newTarget, collections);
        chatCollections.delete(options.oldTarget);

        draft.chatCollections = new Map(chatCollections);
      });
    }
  }

  /**
   * Query document chunks based on given options
   *
   * This method uses embedding vector technology to search for document chunks based on semantic similarity.
   * It supports filtering the search scope by document IDs or collection IDs, and can limit the number of returned results.
   *
   * @param options Query options
   * @returns An array containing matching document chunks, each element includes chunk ID, text content, URL, document name, and distance information
   */
  async queryChunks(options: DocumentManager.QueryChunksOptions) {
    const logger = this.#logger.scope("QueryChunks");

    const schema = this.#database.schema;
    const client = this.#database.client;

    const vector = await this.#embedder.embed([options.text]).then(([vector]) => vector);

    const documents = [...new Set(options.documents || [])];
    const collections = [...new Set(options.collections || [])];

    let limit = options.limit || 10;

    if (limit < 1 || limit > 100) {
      limit = 10;
    }

    logger.info(
      `Querying chunks with text: "${options.text}", documents: ${documents.length}, collections: ${collections.length}, limit: ${limit}`,
    );

    if (collections.length) {
      await client
        .select({ id: schema.document.id })
        .from(schema.document)
        .where(and(inArray(schema.document.collectionId, collections), eq(schema.document.status, "completed")))
        .then((result) => {
          documents.push(...result.map((document) => document.id));
        });
    }

    if (!documents.length) {
      return [];
    }

    logger.info(`Querying against ${documents.length} documents after flattening`);

    const results = await client
      .select({
        id: schema.documentChunk.id,
        text: schema.documentChunk.text,
        url: schema.document.url,
        name: schema.document.name,
        distance: cosineDistance(schema.documentChunk.embedding, vector) as SQL<number>,
      })
      .from(schema.documentChunk)
      .innerJoin(schema.document, eq(schema.documentChunk.documentId, schema.document.id))
      .where(inArray(schema.documentChunk.documentId, documents))
      .orderBy(cosineDistance(schema.documentChunk.embedding, vector))
      .limit(limit);

    logger.info(`Retrieved ${results.length} chunks from database`);

    return results;
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
   * Toggle collection pin options
   * Defines parameters required for toggling collection pin status
   */
  export type ToggleCollectionPinOptions = {
    /**
     * Collection ID
     */
    id: string;
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
   * Import documents from file system options
   */
  export type ImportDocumentsFromFileSystemOptions = {
    /**
     * Target collection ID
     */
    collection: string;
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

  /**
   * Associate collection options
   * Defines parameters required for associating a collection with a target entity
   */
  export type AssociateCollectionOptions = {
    /**
     * Collection ID
     */
    id: string;
    /**
     * Target entity ID
     */
    target: string;
    /**
     * Association type
     */
    type: "conversation";
  };

  /**
   * Disassociate collection options
   * Defines parameters required for disassociating a collection from a target entity
   */
  export type DisassociateCollectionOptions = {
    /**
     * Collection ID
     */
    id: string;
    /**
     * Target entity ID
     */
    target: string;
    /**
     * Association type
     */
    type: "conversation";
  };

  export type ListAssociatedCollectionsOptions = {
    /**
     * Target entity ID
     */
    target: string;
    /**
     * Association type
     */
    type: "conversation";
  };

  export type UpdateAssociatedCollectionsTargetOptions = {
    /**
     * Association type
     */
    type: "conversation";
    /**
     * New target entity ID
     */
    newTarget: string;
    /**
     * Old target entity ID
     */
    oldTarget: string;
  };

  export type QueryChunksOptions = {
    /**
     * Specifies the maximum number of results to return, default is 10, minimum is 1, maximum is 100
     */
    limit?: number;
    /**
     * Specifies which documents to query from
     */
    documents?: string[];
    /**
     * Specifies which collections to query from
     */
    collections?: string[];
    /**
     * The text to search for
     */
    text: string;
  };
}
