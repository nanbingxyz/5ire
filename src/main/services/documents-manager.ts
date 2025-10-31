import type { Results } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { Database } from "@/main/database";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

export class DocumentsManager {
  #database = Container.inject(Database);
  #logger = Container.inject(Logger).scope("DocumentsManager");

  createCollection(options: DocumentsManager.CreateCollectionOptions) {
    return this.#database.client.transaction(async (tx) => {
      return tx
        .insert(this.#database.schema.collection)
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

  deleteCollection(options: DocumentsManager.DeleteCollectionOptions) {
    return this.#database.client.transaction(async (tx) => {
      return tx
        .delete(this.#database.schema.collection)
        .where(eq(this.#database.schema.collection.id, options.id))
        .returning()
        .execute()
        .then((result) => {
          return !!result[0];
        });
    });
  }

  updateCollection(options: DocumentsManager.UpdateCollectionOptions) {
    return this.#database.client.transaction(async (tx) => {
      return tx
        .update(this.#database.schema.collection)
        .set({
          name: options.name,
          description: options.description,
        })
        .where(eq(this.#database.schema.collection.id, options.id))
        .returning()
        .execute()
        .then((result) => {
          return !!result[0];
        });
    });
  }

  liveCollections() {
    const query = this.#database.client.select().from(this.#database.schema.collection);
    const sql = query.toSQL();
    const abort = new AbortController();

    type QueryResultRow = Awaited<ReturnType<(typeof query)["execute"]>>[number];

    return new ReadableStream<Results<QueryResultRow>>({
      cancel: () => {
        abort.abort();
      },
      start: (controller) => {
        this.#database.driver.live.query<QueryResultRow>({
          query: sql.sql,
          params: sql.params,
          callback: (results) => {
            controller.enqueue(results);
          },
          signal: abort.signal,
        });
      },
    });
  }
}

export namespace DocumentsManager {
  export type CreateCollectionOptions = {
    name: string;
    description: string;
  };

  export type UpdateCollectionOptions = {
    id: string;
    name: string;
    description: string;
  };

  export type DeleteCollectionOptions = {
    id: string;
  };
}
