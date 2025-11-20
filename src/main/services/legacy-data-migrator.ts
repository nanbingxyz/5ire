import { pathToFileURL } from "node:url";
import type { Connection as LanceDB } from "@lancedb/lancedb";
import type { Database as SqliteDB } from "better-sqlite3";
import { isNotNull } from "drizzle-orm";
import type { Draft } from "immer";
import { Database } from "@/main/database";
import type { ServerInsert } from "@/main/database/types";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { LegacyServersConfigLoader } from "@/main/services/legacy-servers-config-loader";
import { LegacyVectorDatabaseLoader } from "@/main/services/legacy-vector-database-loader";
import { Logger } from "@/main/services/logger";

/**
 * Responsible for migrating old database structures to new database structures
 *
 * Inherits from Store.Persistable to persist migration state and avoid duplicate migrations
 */
export class LegacyDataMigrator extends Stateful.Persistable<LegacyDataMigrator.State> {
  #logger = Container.inject(Logger).scope("LegacyDataMigrator");
  #database = Container.inject(Database);
  #environment = Container.inject(Environment);
  #legacyVectorDatabaseLoader = Container.inject(LegacyVectorDatabaseLoader);
  #legacyServersConfigLoader = Container.inject(LegacyServersConfigLoader);

  #iterateLegacyDatabaseTable<T>(database: SqliteDB, table: string) {
    const exists = database
      .prepare<[], { count: number }>(
        `select count(*) as count from sqlite_master where type='table' and name='${table}'`,
      )
      .get();

    if (!exists || exists.count <= 0) {
      return [] as T[];
    }

    return database.prepare<[], T>(`select * from ${table}`).iterate();
  }

  async #migrateCollections(context: LegacyDataMigrator.Context) {
    const logger = this.#logger.scope("MigrateCollections");
    const schema = this.#database.schema;
    const client = this.#database.client;

    if (this.state.migrated.collections) {
      return logger.info(`Migrate collections (total ${this.state.migrated.collections.total}). No migration needed.`);
    }

    const migratedCollections: string[] = [];

    for (const legacyCollection of this.#iterateLegacyDatabaseTable<{
      id: string;
      name: string | null;
      memo: string | null;
      pinedAt: number | null;
      createdAt: number | null;
      updatedAt: number | null;
    }>(context.legacySqliteDB, "knowledge_collections")) {
      await client
        .insert(schema.collection)
        .values({
          name: legacyCollection.name?.slice(0, 300) || "Unnamed",
          description: legacyCollection.memo || "",
          createTime: legacyCollection.createdAt ? new Date(legacyCollection.createdAt * 1000) : undefined,
          updateTime: legacyCollection.updatedAt ? new Date(legacyCollection.updatedAt * 1000) : undefined,
          pinedTime: legacyCollection.pinedAt ? new Date(legacyCollection.pinedAt * 1000) : null,
          legacyId: legacyCollection.id,
        })
        .onConflictDoNothing({
          target: schema.collection.legacyId,
          where: isNotNull(schema.collection.legacyId),
        })
        .execute()
        .then(() => {
          migratedCollections.push(legacyCollection.id);
        })
        .catch((error) => {
          logger.warning(`Failed to insert collection "${legacyCollection.id}"`, error);
        });
    }

    logger.info(`Migrate collections completed. Total: ${migratedCollections.length} migrated.`);

    this.update((draft) => {
      draft.migrated.collections = {
        total: migratedCollections.length,
        time: new Date(),
      };
    });
  }

  async #migrateDocuments(context: LegacyDataMigrator.Context) {
    const logger = this.#logger.scope("MigrateDocuments");
    const schema = this.#database.schema;
    const client = this.#database.client;

    if (this.state.migrated.documents) {
      return logger.info(
        `Migrate documents completed (total ${this.state.migrated.documents.total}). No migration needed.`,
      );
    }

    const migratedDocuments: string[] = [];
    const migratedLegacyCollections = await client
      .select({
        id: schema.collection.id,
        legacyId: schema.collection.legacyId,
      })
      .from(schema.collection)
      .where(isNotNull(schema.collection.legacyId))
      .execute()
      .then((result) => {
        return result as Array<{ id: string; legacyId: string }>;
      });

    for (const legacyDocument of this.#iterateLegacyDatabaseTable<{
      id: string;
      name: string | null;
      collectionId: string | null;
      size: number | null;
      createdAt: number | null;
      updatedAt: number | null;
    }>(context.legacySqliteDB, "knowledge_files")) {
      const collection = migratedLegacyCollections.find((collection) => {
        return collection.legacyId === legacyDocument.collectionId;
      });

      if (!collection) {
        logger.warning(`Skipping knowledge document "${legacyDocument.id}" because its collection is not migrated`);
        continue;
      }

      const name = legacyDocument.name?.slice(0, 300) || "Unnamed";
      const ext = name.split(".").pop();
      const mimetype =
        {
          txt: "text/plain",
          md: "text/plain",
          csv: "text/csv",
          epub: "application/epub+zip",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          pdf: "application/pdf",
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
        }[ext || ""] || "unknown";

      await client
        .insert(schema.document)
        .values({
          name: name.slice(0, 300) || "Unnamed",
          collectionId: collection.id,
          size: legacyDocument.size || 0,
          createTime: legacyDocument.createdAt ? new Date(legacyDocument.createdAt * 1000) : undefined,
          updateTime: legacyDocument.updatedAt ? new Date(legacyDocument.updatedAt * 1000) : undefined,
          status: "completed",
          // Add a random string to the file path to avoid duplicate file paths
          url: pathToFileURL(`/[not found in legacy(${crypto.randomUUID()})]/${name}`).toString(),
          mimetype,
          legacyId: legacyDocument.id,
        })
        .onConflictDoNothing({
          target: [schema.document.legacyId],
          where: isNotNull(schema.document.legacyId),
        })
        .execute()
        .then(() => {
          migratedDocuments.push(legacyDocument.id);
        })
        .catch((error) => {
          logger.warning(`Failed to insert document "${legacyDocument.id}"`, error);
        });
    }

    logger.info(`Migrate documents completed. Total: ${migratedDocuments.length} migrated.`);

    this.update((draft) => {
      draft.migrated.documents = {
        total: migratedDocuments.length,
        time: new Date(),
      };
    });
  }

  async #migrateDocumentChunks(context: LegacyDataMigrator.Context) {
    const logger = this.#logger.scope("MigrateDocumentChunks");
    const schema = this.#database.schema;
    const client = this.#database.client;

    if (this.state.migrated.documentChunks) {
      return logger.info(
        `Migrate document chunks completed (total ${this.state.migrated.documentChunks.total}). No migration needed.`,
      );
    }

    const migratedDocumentChunks: string[] = [];

    const legacyTable = await context.legacyLanceDB.openTable("knowledge").catch((error) => {
      logger.error("Failed to open knowledge file vectors table", error);
      return null;
    });

    if (!legacyTable) {
      logger.warning("Skipping knowledge document chunks because the knowledge file vectors table is not found");
      return;
    }

    const migratedLegacyDocuments = await client
      .select({
        id: schema.document.id,
        legacyId: schema.document.legacyId,
      })
      .from(schema.document)
      .where(isNotNull(schema.document.legacyId))
      .execute()
      .then((result) => {
        return result as Array<{ id: string; legacyId: string }>;
      });

    for (const migratedLegacyDocument of migratedLegacyDocuments) {
      logger.info(`Migrating document chunks for document "${migratedLegacyDocument.legacyId}"`);

      let page = 0;

      while (true) {
        const records = await legacyTable
          .query()
          .where(`file_id = "${migratedLegacyDocument.legacyId}"`)
          .limit(5)
          .offset(page * 5)
          .toArray()
          .catch((error) => {
            logger.error("Failed to query knowledge file vectors", error);
            return [];
          })
          .then((records) => {
            return records.filter((record) => {
              // biome-ignore lint/complexity/useOptionalChain: x
              return record && record.vector && record.content && record.file_id;
            });
          });

        if (records.length === 0) {
          break;
        }

        const values = records.map((item, i) => {
          const index = i + page * 5;
          const record = item as {
            id: string;
            collection_id: string;
            file_id: string;
            content: string;
            vector: number[];
          };

          return {
            legacyId: record.id,
            documentId: migratedLegacyDocument.id,
            text: record.content,
            embedding: item.vector,
            index,
          };
        });

        await Promise.all(
          values.map(async (value) => {
            client
              .insert(schema.documentChunk)
              .values(value)
              .onConflictDoNothing({
                target: schema.documentChunk.legacyId,
                where: isNotNull(schema.documentChunk.legacyId),
              })
              .execute()
              .then(() => {
                migratedDocumentChunks.push(value.legacyId);
              })
              .catch((error) => {
                logger.warning(`Failed to insert document chunk "${value.legacyId}"`, error);
              });
          }),
        );

        page++;
      }
    }

    logger.info(`Migrate document chunks completed. Total: ${migratedDocumentChunks.length} migrated.`);

    this.update((draft) => {
      draft.migrated.documentChunks = {
        total: migratedDocumentChunks.length,
        time: new Date(),
      };
    });
  }

  async #migrateTransitionalChatCollections(context: LegacyDataMigrator.Context) {
    const logger = this.#logger.scope("MigrateTransitionalChatCollections");
    const schema = this.#database.schema;
    const client = this.#database.client;

    if (this.state.migrated.transitionChatCollections) {
      return logger.info(
        `Migrate transitional chat collections completed (total ${this.state.migrated.transitionChatCollections.total}). No migration needed.`,
      );
    }

    const migratedTransitionalChatCollections: string[] = [];
    const migratedLegacyCollections = await client
      .select({
        id: schema.collection.id,
        legacyId: schema.collection.legacyId,
      })
      .from(schema.collection)
      .where(isNotNull(schema.collection.legacyId))
      .execute()
      .then((result) => {
        return result as Array<{ id: string; legacyId: string }>;
      });

    for (const item of this.#iterateLegacyDatabaseTable<{
      id: string;
      chatId: string | null;
      collectionId: string | null;
    }>(context.legacySqliteDB, "chat_knowledge_rels")) {
      if (!item.chatId || !item.collectionId) {
        logger.warning(`Skipping transitional chat collection "${item.id}" because chatId or collectionId is null`);
        continue;
      }

      const collection = migratedLegacyCollections.find((collection) => {
        return collection.legacyId === item.collectionId;
      });

      if (!collection) {
        logger.warning(`Skipping transitional chat collection "${item.id}" because its collection is not migrated`);
        continue;
      }

      const chatCollections = this.state.transitional.chatCollections || new Map<string, string[]>();
      const collectionIds = chatCollections.get(item.chatId) || [];

      collectionIds.push(collection.id);
      chatCollections.set(item.chatId, collectionIds);

      this.update((draft) => {
        draft.transitional.chatCollections = new Map(chatCollections.entries());
      });

      migratedTransitionalChatCollections.push(item.id);
    }

    this.update((draft) => {
      draft.migrated.transitionChatCollections = {
        total: migratedTransitionalChatCollections.length,
        time: new Date(),
      };
    });

    logger.info(
      `Migrate transitional chat collections completed. Total: ${migratedTransitionalChatCollections.length} migrated.`,
    );
  }

  async #migrateServersConfig(context: LegacyDataMigrator.Context) {
    const logger = this.#logger.scope("MigrateServersConfig");
    const schema = this.#database.schema;
    const client = this.#database.client;

    if (this.state.migrated.serversConfig) {
      return logger.info(
        `Migrate servers config completed (total ${this.state.migrated.serversConfig.total}). No migration needed.`,
      );
    }

    const config = await this.#legacyServersConfigLoader.load();

    const migratedServers: string[] = [];

    if (config && config.length > 0) {
      for (const server of config) {
        let data: ServerInsert;

        if (server.command) {
          data = {
            transport: "stdio",
            endpoint: [server.command, ...(server.args || [])].join(" "),
            label: server.name || server.key,
            config: server.env || {},
            description: server.description,
            approvalPolicy: server.approvalPolicy,
            active: server.isActive,
          };
        } else {
          data = {
            transport: "http-streamable",
            endpoint: server.url || "",
            label: server.name || server.key,
            config: server.headers || {},
            description: server.description,
            approvalPolicy: server.approvalPolicy,
            active: server.isActive,
          };

          await fetch(data.endpoint, { headers: data.config, signal: AbortSignal.timeout(5000) })
            .then((res) => {
              if (res.status === 200 && res.headers.get("content-type")?.startsWith("text/event-stream")) {
                data.transport = "sse";
              }
            })
            .catch((error) => {
              logger.warning(`Failed to get remote server transport type: "${data.endpoint}"`, error);
            });
        }

        await client
          .insert(schema.server)
          .values(data)
          .execute()
          .then(() => {
            migratedServers.push(server.key);
          })
          .catch((error) => {
            logger.warning(`Failed to insert server "${server.key}"`, error);
          });
      }
    }

    this.update((draft) => {
      draft.migrated.serversConfig = {
        total: 0,
        time: new Date(),
      };
    });
    return logger.info(`Migrate servers config completed (total ${migratedServers.length}). No migration needed.`);
  }

  /**
   * Execute database migration
   *
   * @param sqlite SQLite database connection
   *
   * @returns Promise<void> A Promise that resolves when the migration is complete
   */
  async migrate(sqlite: SqliteDB) {
    const logger = this.#logger.scope("Migrate");

    this.update((draft) => {
      draft.migrating = true;
    });

    logger.info("Starting database migration...");

    try {
      const context: LegacyDataMigrator.Context = {
        legacyLanceDB: await this.#legacyVectorDatabaseLoader.load(this.#environment.legacyVectorDatabaseFolder),
        legacySqliteDB: sqlite,
      };

      await this.#migrateCollections(context).catch((error) => {
        logger.error("Failed to migrate collections", error);
      });
      await this.#migrateDocuments(context).catch((error) => {
        logger.error("Failed to migrate documents", error);
      });
      await this.#migrateDocumentChunks(context).catch((error) => {
        logger.error("Failed to migrate document chunks", error);
      });
      await this.#migrateTransitionalChatCollections(context).catch((error) => {
        logger.error("Failed to migrate transitional chat collections", error);
      });
    } finally {
      this.update((draft) => {
        draft.migrating = false;
      });

      this.#legacyVectorDatabaseLoader.close();
    }
  }

  async updateTransitional(updater: (draft: Draft<LegacyDataMigrator.State["transitional"]>) => void) {
    this.update((draft) => {
      updater(draft.transitional);
    });
  }

  /**
   * Create a database migrator instance
   *
   * Initialize persistent storage configuration
   */
  constructor() {
    super({
      name: "legacy-data-migrator",
      defaults: {
        migrated: {},
        migrating: false,
        transitional: {},
      },
      directory: Container.inject(Environment).storiesFolder,
    });
  }
}

export namespace LegacyDataMigrator {
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
    migrated: Partial<
      Record<
        "collections" | "documents" | "documentChunks" | "transitionChatCollections" | "serversConfig",
        {
          time: Date;
          total: number;
        }
      >
    >;
    /**
     * Indicates whether a migration is currently in progress
     */
    migrating: boolean;
    /**
     * Transitional data storage; these data need to be migrated only after all related table migrations are completed; temporarily stored in the file system;
     */
    transitional: {
      chatCollections?: Map<string, string[]>;
    };
  };

  export type Context = {
    legacySqliteDB: SqliteDB;
    legacyLanceDB: LanceDB;
  };
}
