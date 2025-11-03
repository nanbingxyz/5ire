import type { Connection as LanceDB } from "@lancedb/lancedb";
import type { Database as SqliteDB } from "better-sqlite3";
import { Database } from "@/main/database";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Store } from "@/main/internal/store";
import { Logger } from "@/main/services/logger";

/**
 * Database migrator class
 *
 * Responsible for migrating old database structures to new database structures
 *
 * Inherits from Store.Persistable to persist migration state and avoid duplicate migrations
 */
export class DatabaseMigrator extends Store.Persistable<DatabaseMigrator.State> {
  #logger = Container.inject(Logger).scope("DatabaseMigrator");
  #database = Container.inject(Database);

  /**
   * Migrate knowledge-related data
   *
   * This method migrates the following data:
   * 1. Knowledge collections (knowledge_collections)
   * 2. Knowledge files (knowledge_files)
   * 3. Knowledge vector data
   * 4. Relationships between knowledge and chat records (chat_knowledge_rels)
   *
   * @param sqlite SQLite database connection
   * @param lance LanceDB vector database connection
   *
   * @returns Promise<void> A Promise that resolves when the migration is complete
   */
  async #migrateKnowledge(sqlite: SqliteDB, lance: LanceDB) {
    const logger = this.#logger.scope("MigrateKnowledge");

    // Check if knowledge migration has already been completed to avoid duplicate execution
    if (this.state.migrations.migratedKnowledge) {
      return logger.info("Knowledge migration already completed.");
    }

    const schema = this.#database.schema;
    const client = this.#database.client;

    const existsKnowledgeCollectionsTable = sqlite
      .prepare<[], { count: number }>(
        "select count(*) as count from sqlite_master where type='table' and name='knowledge_collections'",
      )
      .get();

    const existsKnowledgeFilesTable = sqlite
      .prepare<[], { count: number }>(
        "select count(*) as count from sqlite_master where type='table' and name='knowledge_files'",
      )
      .get();

    const existsKnowledgeRelationsTable = sqlite
      .prepare<[], { count: number }>(
        "select count(*) as count from sqlite_master where type='table' and name='knowledge_collections'",
      )
      .get();

    if (!existsKnowledgeCollectionsTable || existsKnowledgeCollectionsTable.count <= 0) {
      return logger.info("No knowledge collections table found.");
    }

    if (!existsKnowledgeFilesTable || existsKnowledgeFilesTable.count <= 0) {
      return logger.info("No knowledge files table found.");
    }

    if (!existsKnowledgeRelationsTable || existsKnowledgeRelationsTable.count <= 0) {
      return logger.info("No knowledge relations table found.");
    }

    const knowledgeCollectionsIdMap = new Map<string, string>();
    const knowledgeCollections = sqlite
      .prepare<
        [],
        {
          id: string;
          name: string;
          memo: string | null;
          pinedAt: number | null;
          createdAt: number;
          updatedAt: number;
        }
      >("select * from knowledge_collections")
      .iterate();

    for (const knowledgeCollection of knowledgeCollections) {
      const id = crypto.randomUUID();

      await client
        .insert(schema.collection)
        .values({
          name: knowledgeCollection.name.slice(0, 300),
          description: knowledgeCollection.memo || "",
          createTime: new Date(knowledgeCollection.createdAt * 1000),
          updateTime: new Date(knowledgeCollection.updatedAt * 1000),
          pinedTime: knowledgeCollection.pinedAt ? new Date(knowledgeCollection.pinedAt * 1000) : null,
          id,
        })
        .execute()
        .then(() => {
          knowledgeCollectionsIdMap.set(knowledgeCollection.id, id);
        })
        .catch((error) => {
          logger.error("Failed to insert knowledge collection", error);
        });
    }

    logger.info("Migrate knowledge collections completed.");

    const knowledgeFilesIdMap = new Map<string, string>();
    const knowledgeFiles = sqlite
      .prepare<
        [],
        {
          id: string;
          name: string;
          collectionId: string;
          size?: number;
          createdAt: number;
          updatedAt: number;
        }
      >("select * from knowledge_files")
      .iterate();

    const knowledgeFileVectorsTable = await lance.openTable("knowledge").catch((error) => {
      logger.error("Failed to open knowledge file vectors table", error);
      return null;
    });

    for (const knowledgeFile of knowledgeFiles) {
      const id = crypto.randomUUID();
      const collectionId = knowledgeCollectionsIdMap.get(knowledgeFile.collectionId);

      if (!collectionId) {
        continue;
      }

      await client
        .insert(schema.document)
        .values({
          id,
          collectionId,
          name: knowledgeFile.name.slice(0, 300),
          url: `legacy://${knowledgeFile.id}`,
          status: "completed",
          mimetype: "unknown",
        })
        .execute()
        .then(async () => {
          let page = 0;

          if (!knowledgeFileVectorsTable) {
            return;
          }

          while (true) {
            const batch = await knowledgeFileVectorsTable
              .query()
              .where(`file_id = "${knowledgeFile.id}"`)
              .limit(5)
              .offset(page * 5)
              .toArray()
              .catch((error) => {
                logger.error("Failed to query knowledge file vectors", error);
                return [];
              });

            if (batch.length <= 0) {
              break;
            }

            await client
              .insert(schema.documentChunk)
              .values(
                batch.map((item, i) => {
                  const index = i + page * 5;
                  const record = batch[i] as {
                    id: string;
                    collection_id: string;
                    file_id: string;
                    content: string;
                    vector: number[];
                  };

                  return {
                    documentId: id,
                    text: record.content,
                    embedding: item.vector,
                    index,
                  };
                }),
              )
              .catch((error) => {
                logger.error("Failed to insert document chunks", error);
              });

            page++;
          }

          knowledgeFilesIdMap.set(knowledgeFile.id, id);
        });
    }

    logger.info("Migrate knowledge files completed.");

    const knowledgeRelations = sqlite
      .prepare<
        [],
        {
          collectionId: string;
          chatId: string;
        }
      >("select * from chat_knowledge_rels")
      .iterate();

    for (const rel of knowledgeRelations) {
      const collectionId = knowledgeCollectionsIdMap.get(rel.collectionId);

      if (!collectionId) {
        continue;
      }

      await client
        .insert(schema.conversationCollection)
        .values({
          conversationId: rel.chatId,
          collectionId,
        })
        .execute()
        .catch((error) => {
          logger.error("Failed to insert conversation collection relation", error);
        });
    }

    logger.info("Migrate knowledge relations completed.");

    // Update state to mark knowledge migration as completed
    this.update((draft) => {
      draft.migrations.migratedKnowledge = new Date();
    });
  }

  /**
   * Execute database migration
   *
   * @param sqlite SQLite database connection
   * @param lance LanceDB vector database connection
   *
   * @returns Promise<void> A Promise that resolves when the migration is complete
   */
  async migrate(sqlite: SqliteDB, lance: LanceDB) {
    if (this.state.migrating) {
      return;
    }

    this.update((draft) => {
      draft.migrating = true;
    });

    try {
      await this.#migrateKnowledge(sqlite, lance);
    } finally {
      this.update((draft) => {
        draft.migrating = false;
      });
    }
  }

  /**
   * Create a database migrator instance
   *
   * Initialize persistent storage configuration
   */
  constructor() {
    super({
      name: "database-migrator",
      defaults: {
        migrations: {},
        migrating: false,
      },
      directory: Container.inject(Environment).storiesFolder,
    });
  }
}

export namespace DatabaseMigrator {
  /**
   * Database migrator state type definition
   *
   * Used to track the completion status of various migration tasks
   */
  export type State = {
    /**
     * Migration task records
     *
     * Key is the migration task name, value is the completion time
     * Used to avoid re-executing completed migration tasks
     */
    migrations: Record<string, Date>;
    /**
     * Indicates whether a migration is currently in progress
     */
    migrating: boolean;
  };
}
