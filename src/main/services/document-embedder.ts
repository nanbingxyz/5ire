import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { asError } from "catch-unknown";
import { asc, eq, not } from "drizzle-orm";
import { createReadStream, createWriteStream } from "fs-extra";
import { Database } from "@/main/database";
import { Container } from "@/main/internal/container";
import { Emitter } from "@/main/internal/emitter";
import { Mutex } from "@/main/internal/mutex";
import { Stateful } from "@/main/internal/stateful";
import { DocumentExtractor } from "@/main/services/document-extractor";
import { Embedder } from "@/main/services/embedder";
import { Logger } from "@/main/services/logger";

/**
 * DocumentEmbedder class is used to handle document embedding vector generation
 * Responsible for fetching pending documents from the database, extracting text content and generating embedding vectors
 * @extends Stateful<DocumentEmbedder.State>
 */
export class DocumentEmbedder extends Stateful<DocumentEmbedder.State> {
  #database = Container.inject(Database);
  #embedder = Container.inject(Embedder);
  #extractor = Container.inject(DocumentExtractor);
  #logger = Container.inject(Logger).scope("DocumentEmbedder");
  #emitter = Emitter.create<DocumentEmbedder.Events>();

  /**
   * Number of worker threads
   * Controls the number of concurrent document processing to avoid exhausting system resources
   */
  #workers = 1;

  /**
   * Empty state flag
   * Set to true when there are no pending documents to avoid unnecessary polling
   */
  #empty = false;

  /**
   * Mutex instance
   * Used to ensure thread safety for database operations with multiple concurrent requests
   */
  #mutex = Mutex.create();

  /**
   * Get the event emitter instance
   * @returns Event emitter instance
   */
  get emitter() {
    return this.#emitter;
  }

  /**
   * Create DocumentEmbedder instance
   * Initialize the state of documents being processed
   */
  constructor() {
    super(() => {
      return {
        processingDocuments: {},
      };
    });
  }

  /**
   * Lock and fetch a pending document
   * Use mutex to ensure concurrency safety and update document status to processing
   * @returns Promise<{id: string, url: string} | undefined> Document information or undefined
   */
  async #lock() {
    const client = this.#database.client;
    const schema = this.#database.schema;
    const logger = this.#logger.scope("Lock");

    await this.#mutex.acquire();

    return client
      .transaction(async (tx) => {
        return tx
          .select({
            id: schema.document.id,
            url: schema.document.url,
          })
          .from(schema.document)
          .where(eq(schema.document.status, "pending"))
          .orderBy(asc(schema.document.id))
          .limit(1)
          .then(async ([it]) => {
            if (!it) {
              return;
            }

            await Promise.all([
              tx
                .update(schema.document)
                .set({
                  status: "processing",
                })
                .where(eq(schema.document.id, it.id))
                .execute(),
              tx.delete(schema.documentChunk).where(eq(schema.documentChunk.documentId, it.id)).execute(),
            ]);

            return it;
          });
      })
      .catch((error) => {
        logger.error("Failed to lock document:", error);
      })
      .finally(() => {
        this.#mutex.release();
      });
  }

  /**
   * Process embedding vector generation for the specified document
   * Includes three stages: document extraction, vector embedding, and result persistence
   *
   * Processing flow:
   * 1. Extraction stage: Use DocumentExtractor to extract document text content from URL
   * 2. Embedding stage: Use Embedder to generate vector representations for each text block
   * 3. Saving stage: Save the generated vectors and corresponding text to the database
   *
   * Progress status is updated in real-time during processing, and events are triggered when errors occur
   *
   * @param id Document ID
   * @param url Document URL
   * @returns Promise<void>
   */
  async #process(id: string, url: string) {
    const logger = this.#logger.scope("Process");
    const controller = new AbortController();

    const client = this.#database.client;
    const schema = this.#database.schema;

    this.update((draft) => {
      draft.processingDocuments[id] = {
        controller: controller,
        status: "extracting",
        progress: 0,
      };
    });

    logger.info(`Processing document "${url}"`);

    return (
      this.#extractor
        .extract(url)
        // Embedding
        .then(async ({ texts, mimetype, size }) => {
          controller.signal.throwIfAborted();

          logger.info(`Extracted ${texts.length} text blocks in document "${url}"`);

          this.update((draft) => {
            draft.processingDocuments[id] = {
              controller: controller,
              status: "embedding",
              progress: 0,
            };
          });

          const file = join(tmpdir(), crypto.randomUUID());
          const stream = createWriteStream(file);

          let processed = 0;

          for (const text of texts) {
            controller.signal.throwIfAborted();

            await this.#embedder.embed([text]).then(([vector]) => {
              stream.write(`${JSON.stringify({ text, vector })}\n`);
            });

            processed += 1;

            this.update((draft) => {
              draft.processingDocuments[id] = {
                controller: controller,
                status: "embedding",
                progress: processed / texts.length,
              };
            });

            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          stream.end();

          await new Promise<void>((resolve, reject) => {
            stream.on("finish", resolve);
            stream.on("error", reject);
          });

          return {
            readline: createInterface({ input: createReadStream(file), crlfDelay: Infinity }),
            length: texts.length,
            mimetype,
            size,
          };
        })
        // Persistence
        .then(async (result) => {
          controller.signal.throwIfAborted();

          this.update((draft) => {
            draft.processingDocuments[id] = {
              controller: controller,
              status: "saving",
              progress: 0,
            };
          });

          const document = await client
            .update(schema.document)
            .set({
              status: "completed",
              mimetype: result.mimetype,
              size: result.size,
            })
            .where(eq(schema.document.id, id))
            .returning()
            .execute()
            .then((rows) => {
              if (!rows.length) {
                return null;
              }

              return rows[0];
            });

          if (!document) {
            return;
          }

          let inserted = 0;

          const batch: { text: string; vector: number[] }[] = [];
          const insert = async () => {
            const values = batch.map(({ text, vector }, index) => {
              return {
                documentId: id,
                text,
                embedding: vector,
                index: inserted + index,
              } as const;
            });

            if (values.length === 0) {
              return;
            }

            return client
              .insert(schema.documentChunk)
              .values(values)
              .execute()
              .then(() => {
                inserted += values.length;
                // Clear the batch after inserting
                batch.length = 0;
                // Update the progress
                this.update((draft) => {
                  draft.processingDocuments[id] = {
                    controller: controller,
                    status: "saving",
                    progress: inserted / result.length,
                  };
                });
              });
          };

          try {
            for await (const line of result.readline) {
              controller.signal.throwIfAborted();
              batch.push(JSON.parse(line));

              if (batch.length >= 10) {
                await insert();
              }

              await new Promise((resolve) => setTimeout(resolve, 20));
            }

            await insert();
          } finally {
            result.readline.close();
          }
        })
        // Error handling
        .catch(async (error) => {
          if (controller.signal.aborted) {
            return;
          }

          logger.error("Failed to process document:", error);

          this.#emitter.emit("document-embed-failed", {
            id,
            url,
            message: asError(error).message,
          });

          return client
            .update(schema.document)
            .set({
              status: "failed",
              error: asError(error).message,
            })
            .where(eq(schema.document.id, id))
            .execute()
            .catch(() => {
              logger.error("Failed to update document status after processing failure:", error);
            });
        })
        // Reset processing state
        .finally(() => {
          this.update((draft) => {
            delete draft.processingDocuments[id];
          });
        })
    );
  }

  /**
   * Pull and process pending documents
   * Concurrently process documents based on the number of available worker threads
   *
   * Workflow:
   * 1. Check if the embedder is ready
   * 2. Check if there are pending documents
   * 3. Check if there are available worker threads
   * 4. Loop to process documents using worker threads
   * 5. Release worker threads after processing and recursively call to continue processing
   */
  #pull() {
    if (this.#embedder.state.status.type !== "ready") {
      return;
    }

    if (this.#empty) {
      return;
    }

    if (!this.#workers) {
      return;
    }

    while (this.#workers) {
      this.#workers--;

      this.#lock()
        .then((it) => {
          if (it) {
            return this.#process(it.id, it.url);
          }

          this.#empty = true;
        })
        .finally(() => {
          this.#workers++;
          this.#pull();
        });
    }
  }

  /**
   * Initialize the document embedder
   * Set up database listeners and embedder status change listeners
   * @returns Promise<void>
   */
  async init() {
    await this.#database.ready;

    const client = this.#database.client;
    const schema = this.#database.schema;
    const driver = this.#database.driver;

    await client
      .update(schema.document)
      .set({
        status: "pending",
      })
      .where(eq(schema.document.status, "processing"))
      .execute();

    const query = client
      .select({
        id: schema.document.id,
        status: schema.document.status,
      })
      .from(schema.document)
      .where(not(eq(schema.document.status, "completed")));
    const sql = query.toSQL();
    const abort = new AbortController();

    const live = await driver.live.changes<Awaited<ReturnType<(typeof query)["execute"]>>[number]>({
      query: sql.sql,
      params: sql.params,
      key: "id",
      signal: abort.signal,
    });

    live.subscribe((changes) => {
      for (const change of changes) {
        if (change.__op__ === "INSERT") {
          this.#empty = false;
          this.#pull();
        } else if (change.__op__ === "DELETE") {
          this.update((draft) => {
            const it = draft.processingDocuments[change.id];
            if (it) {
              it.controller.abort();
              delete draft.processingDocuments[change.id];
            }
          });
        }
      }
    });

    this.#embedder.subscribe((prev, next) => {
      if (prev.status.type === "ready" && next.status.type !== "ready") {
        this.update((draft) => {
          for (const [_, it] of Object.entries(draft.processingDocuments)) {
            it.controller.abort();
          }

          draft.processingDocuments = {};
        });
      }
      if (prev.status.type !== "ready" && next.status.type === "ready") {
        this.#pull();
      }
    });

    if (this.#embedder.state.status.type === "ready") {
      this.#pull();
    }
  }
}

export namespace DocumentEmbedder {
  /**
   * Document embedder event definitions
   * Defines events that may be triggered during document embedding
   */
  export type Events = {
    /**
     * Document embedding failed event
     * Triggered when an error occurs during document embedding
     */
    "document-embed-failed": {
      /**
       * Document ID
       */
      id: string;
      /**
       * Document URL
       */
      url: string;
      /**
       * Error message
       */
      message: string;
    };
  };

  /**
   * Document embedder state definition
   * Contains information about documents being processed
   */
  export type State = {
    /**
     * Records of documents being processed
     * Keyed by document ID, storing processing controller, status and progress information
     */
    processingDocuments: Record<
      string,
      {
        /**
         * Abort controller
         * Used to cancel ongoing document processing operations
         */
        controller: AbortController;
        /**
         * Processing status
         * - extracting: Extracting document content
         * - embedding: Generating embedding vectors
         * - saving: Saving results
         */
        status: "embedding" | "extracting" | "saving";
        /**
         * Processing progress
         * A value between 0 and 1, representing the percentage of completion
         */
        progress: number;
      }
    >;
  };
}
