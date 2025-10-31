import { asc, eq } from "drizzle-orm";
import { Database } from "@/main/database";
import { Container } from "@/main/internal/container";
import { Mutex } from "@/main/internal/mutex";
import { DocumentExtractor } from "@/main/services/document-extractor";
import { Embedder } from "@/main/services/embedder";
import { Logger } from "@/main/services/logger";

export class DocumentEmbedder {
  #database = Container.inject(Database);
  #embedder = Container.inject(Embedder);
  #extractor = Container.inject(DocumentExtractor);
  #logger = Container.inject(Logger).scope("DocumentEmbedder");

  #metadata = new Map<
    string,
    {
      controller: AbortController;
    }
  >();

  #workers = 5;
  #empty = false;
  #mutex = Mutex.create();

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
          .then(([it]) => {
            if (!it) {
              return;
            }

            return tx
              .update(schema.document)
              .set({
                status: "processing",
              })
              .where(eq(schema.document.id, it.id))
              .execute()
              .then(() => it);
          });
      })
      .catch((error) => {
        logger.error("Failed to lock document:", error);
      })
      .finally(() => {
        this.#mutex.release();
      });
  }

  async #process(id: string, url: string) {
    const controller = new AbortController();

    const client = this.#database.client;
    const schema = this.#database.schema;

    this.#metadata.set(id, { controller });
    this.#extractor
      .extract(url)
      .then(async (texts) => {
        controller.signal.throwIfAborted();

        const chunks: string[][] = [];
        const embeddings: number[][] = [];

        for (let i = 0; i < texts.length; i += 2) {
          chunks.push(texts.slice(i, i + 2));
        }

        while (true) {
          controller.signal.throwIfAborted();

          const chunk = chunks.shift();

          if (!chunk) {
            break;
          }

          await this.#embedder.embed(chunk).then((embeddings) => {
            embeddings.push(...embeddings);
          });
        }

        return embeddings;
      })
      .then((embeddings) => {
        controller.signal.throwIfAborted();

        return client.transaction(async (tx) => {
          const document = await tx
            .update(schema.document)
            .set({
              status: "completed",
            })
            .where(eq(schema.document.id, id))
            .returning()
            .execute()
            .then((result) => {
              return result[0];
            });

          if (!document) {
            return;
          }

          // return tx.insert(schema.documentChunk).values(embeddings.map((embedding, index) => {
          //   return {
          //     documentId: document.id,
          //     text: chunk[index][index],
          //     embedding: embedding,
          //   }
          // }))
        });
        // client.update(schema.document).set({})
      })
      .finally(() => {
        this.#metadata.delete(id);
      });
  }

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

  async init() {
    await this.#database.ready;

    const client = this.#database.client;
    const schema = this.#database.schema;
    const driver = this.#database.driver;

    const query = client
      .select({
        id: schema.collection.id,
      })
      .from(schema.document)
      .where(eq(schema.document.status, "pending"));
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
        } else {
          this.#metadata.get(change.id)?.controller.abort();
        }
      }
    });

    this.#embedder.subscribe((prev, next) => {
      if (prev.status.type === "ready" && next.status.type !== "ready") {
        for (const { controller } of this.#metadata.values()) {
          controller.abort();
        }
      }
      if (prev.status.type !== "ready" && next.status.type === "ready") {
        this.#pull();
      }
    });
  }
}
