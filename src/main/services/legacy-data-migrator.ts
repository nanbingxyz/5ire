import { pathToFileURL } from "node:url";
import type { Connection as LanceDB } from "@lancedb/lancedb";
import type { Database as SqliteDB } from "better-sqlite3";
import type { StructuredPrompt as LegacyStructuredPrompt } from "@/intellichat/types";
import { Database } from "@/main/database";
import type { ConversationInsert, ServerInsert, TurnInsert, TurnPrompt, TurnReply } from "@/main/database/types";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { Logger } from "@/main/services/logger";
import { MCPContentConverter } from "@/main/services/mcp-content-converter";
import { URLParser } from "@/main/services/url-parser";
import type { IMCPConfig as LegacyMCPConfig } from "@/types/mcp";
import { splitByCitations, splitByImg } from "@/utils/util";

const LEGACY_DATABASE_TABLES = [
  "knowledge_collections",
  "knowledge_files",
  "chat_knowledge_rels",
  "chats",
  "folders",
  "prompts",
  "bookmarks",
  "messages",
  "usages",

  // Stories
  "mcp_config",
  "provider_config",

  // Lance
  "knowledge_chunks",
] as const;

/**
 * Responsible for migrating old database structures to new database structures
 *
 * Inherits from Store.Persistable to persist migration state and avoid duplicate migrations
 */
export class LegacyDataMigrator extends Stateful.Persistable<LegacyDataMigrator.State> {
  #logger = Container.inject(Logger).scope("LegacyDataMigrator");
  #database = Container.inject(Database);
  #urlParser = Container.inject(URLParser);
  #mcpContentConverter = Container.inject(MCPContentConverter);

  async #migrateMCPConfig(context: LegacyDataMigrator.Context) {
    const { legacyDataIdMap: ids, legacySqliteDB: sqlite, legacyLanceDB: lance, tx, legacyMCPConfig: mcp } = context;

    const logger = this.#logger.scope("MigrateMCPConfig");
    const schema = this.#database.schema;
    const client = tx;

    if (mcp?.mcpServers && typeof mcp.mcpServers === "object") {
      for (const [key, server] of Object.entries(mcp.mcpServers)) {
        try {
          const id = crypto.randomUUID();
          const data: ServerInsert = {
            id,
            label: server.name || key,
            description: server.description,
            transport: "stdio",
            endpoint: "",
            config: {},
            approvalPolicy: server.approvalPolicy || "once",
            active: server.isActive,
          };

          if (server.type === "local") {
            data.transport = "stdio";
            data.config = server.env || {};
            data.endpoint = `${server.command?.trim() || ""} ${server.args?.join(" ") || ""}`;
          } else {
            data.transport = "http-streamable";
            data.config = server.headers || {};
            data.endpoint = server.url || "";
          }

          await client.insert(schema.server).values(data);

          ids.mcp_config.set(key, id);
        } catch (error) {
          logger.warning(`Failed to insert mcp server "${key}"`, error);
        }
      }
    }

    logger.info(`Migrate mcp servers completed. Total: ${ids.mcp_config.size} mcp servers migrated.`);
  }

  /**
   * Migrate knowledge-related data
   *
   * This method migrates the following data:
   * 1. Knowledge collections (knowledge_collections)
   * 2. Knowledge files (knowledge_files)
   * 3. Knowledge vector data
   * 4. Relationships between knowledge and chat records (chat_knowledge_rels)
   *
   * @param context
   *
   * @returns Promise<void> A Promise that resolves when the migration is complete
   */
  async #migrateKnowledge(context: LegacyDataMigrator.Context) {
    const { legacyDataIdMap: ids, legacySqliteDB: sqlite, legacyLanceDB: lance, tx } = context;

    const logger = this.#logger.scope("MigrateKnowledge");
    const schema = this.#database.schema;
    const client = tx;

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
        "select count(*) as count from sqlite_master where type='table' and name='chat_knowledge_rels'",
      )
      .get();

    if (!existsKnowledgeCollectionsTable || existsKnowledgeCollectionsTable.count <= 0) {
      return logger.warning("No knowledge collections table found.");
    }

    if (!existsKnowledgeFilesTable || existsKnowledgeFilesTable.count <= 0) {
      return logger.warning("No knowledge files table found.");
    }

    if (!existsKnowledgeRelationsTable || existsKnowledgeRelationsTable.count <= 0) {
      return logger.warning("No knowledge relations table found.");
    }

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
          ids.knowledge_collections.set(knowledgeCollection.id, id);
        })
        .catch((error) => {
          logger.error("Failed to insert knowledge collection", error);
        });
    }

    logger.info(
      `Migrate knowledge collections completed. Total: ${ids.knowledge_collections.size} collections migrated.`,
    );

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
      const collectionId = ids.knowledge_collections.get(knowledgeFile.collectionId);

      if (!collectionId) {
        continue;
      }

      const ext = knowledgeFile.name.split(".").pop();

      let mimetype = "unknown";

      if (ext) {
        mimetype =
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
          }[ext] || "unknown";
      }

      await client
        .insert(schema.document)
        .values({
          id,
          collectionId,
          name: knowledgeFile.name.slice(0, 300),
          url: pathToFileURL(`/[not found in legacy]/${knowledgeFile.name}`).toString(),
          status: "completed",
          mimetype,
          size: knowledgeFile.size || 0,
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

            const values = batch.map((item, i) => {
              const index = i + page * 5;
              const record = batch[i] as {
                id: string;
                collection_id: string;
                file_id: string;
                content: string;
                vector: number[];
              };

              return {
                id: crypto.randomUUID(),
                legacyId: record.id,
                documentId: id,
                text: record.content,
                embedding: item.vector,
                index,
              };
            });

            await client
              .insert(schema.documentChunk)
              .values(values.map(({ legacyId, ...rest }) => rest))
              .then(() => {
                for (const { id, legacyId } of values) {
                  ids.knowledge_chunks.set(legacyId, id);
                }
              })
              .catch((error) => {
                logger.error("Failed to insert document chunks", error);
              });

            page++;
          }

          ids.knowledge_files.set(knowledgeFile.id, id);
        });
    }

    logger.info(`Migrate knowledge files completed. Total: ${ids.knowledge_files.size} knowledge files migrated.`);
    logger.info(`Migrate knowledge chunks completed. Total: ${ids.knowledge_chunks.size} knowledge chunks migrated.`);
  }

  /**
   * Migrate prompt-related data
   *
   * This method migrates the following data:
   * 1. Prompt templates (prompts)
   * 2. Prompt messages (system and user messages)
   * 3. Applicable models for each prompt
   *
   * @param context
   *
   * @returns Promise<void> A Promise that resolves when the migration is complete
   */
  async #migratePrompts(context: LegacyDataMigrator.Context) {
    const { legacyDataIdMap: ids, legacySqliteDB: sqlite, tx } = context;

    const logger = this.#logger.scope("MigrateKnowledge");
    const schema = this.#database.schema;
    const client = tx;

    const existsPromptsTable = sqlite
      .prepare<[], { count: number }>(
        "select count(*) as count from sqlite_master where type='table' and name='prompts'",
      )
      .get();

    if (!existsPromptsTable || existsPromptsTable.count <= 0) {
      return logger.warning("No prompts table found.");
    }

    const prompts = sqlite
      .prepare<
        [],
        {
          id: string;
          name: string;
          systemMessage: string;
          userMessage: string;
          models: string;
          createdAt: number;
          updatedAt: number;
        }
      >("select * from prompts")
      .iterate();

    for (const prompt of prompts) {
      const id = crypto.randomUUID();

      await client.insert(schema.prompt).values({
        id,
        name: prompt.name.slice(0, 300),
        createTime: new Date(prompt.createdAt * 1000),
        updateTime: new Date(prompt.updatedAt * 1000),
        roleDefinitionTemplate: prompt.systemMessage,
        instructionTemplate: prompt.userMessage,
      });

      ids.prompts.set(prompt.id, id);
    }

    logger.info(`Migrate prompts completed. Total: ${ids.prompts.size} prompts migrated.`);
  }

  async #migrateFolders(context: LegacyDataMigrator.Context) {
    const { legacyDataIdMap: ids, legacySqliteDB: sqlite, tx } = context;

    const logger = this.#logger.scope("MigrateFolders");
    const schema = this.#database.schema;
    const client = tx;

    const existsFoldersTable = sqlite
      .prepare<[], { count: number }>(
        "select count(*) as count from sqlite_master where type='table' and name='folders'",
      )
      .get();

    if (!existsFoldersTable || existsFoldersTable.count <= 0) {
      return logger.warning("No folders table found.");
    }

    const folders = sqlite
      .prepare<
        [],
        {
          id: string;
          name: string;
          provider: string | null;
          model: string | null;
          systemMessage: string | null;
          temperature: number | null;
          maxTokens: number | null;
          maxCtxMessages: number | null;
          knowledgeCollectionIds: string | null;
          createdAt: number;
        }
      >("select * from folders")
      .iterate();

    for (const folder of folders) {
      const id = crypto.randomUUID();

      await client.insert(schema.project).values({
        id,
        name: folder.name.slice(0, 300),
        createTime: new Date(folder.createdAt * 1000),
        updateTime: new Date(folder.createdAt * 1000),
        config: {
          systemPrompt: folder.systemMessage || undefined,
          defaultConversationConfig: {
            maxContextMessages: folder.maxCtxMessages || undefined,
          },
        },
      });

      ids.folders.set(folder.id, id);
    }

    logger.info(`Migrate folders completed. Total: ${ids.folders.size} folders migrated.`);
  }

  async #migrateChats(context: LegacyDataMigrator.Context) {
    const { legacyDataIdMap: ids, legacySqliteDB: sqlite, tx } = context;

    const logger = this.#logger.scope("MigrateChats");
    const schema = this.#database.schema;
    const client = tx;

    const existsChatsTable = sqlite
      .prepare<[], { count: number }>("select count(*) as count from sqlite_master where type='table' and name='chats'")
      .get();

    if (!existsChatsTable || existsChatsTable.count <= 0) {
      return logger.warning("No chats table found.");
    }

    const chats = sqlite
      .prepare<
        [],
        {
          id: string;
          folderId: string | null;
          summary: string | null;
          systemMessage: string | null;
          temperature: number | null;
          maxTokens: number | null;
          maxCtxMessages: number | null;
          createdAt: number | null;
        }
      >("select * from chats")
      .iterate();

    for (const chat of chats) {
      const id = crypto.randomUUID();
      const projectId = chat.folderId ? ids.folders.get(chat.folderId) : null;

      const data: ConversationInsert = {
        id,
        summary: chat.summary?.slice(0, 300) || "...",
        createTime: chat.createdAt ? new Date(chat.createdAt * 1000) : new Date(),
        updateTime: chat.createdAt ? new Date(chat.createdAt * 1000) : new Date(),
        config: {
          maxContextMessages: chat.maxCtxMessages || 10,
          maxTokens: chat.maxTokens || 2000,
          temperature: chat.temperature || 0.9,
          provider: "",
          model: "",
        },
        projectId: projectId,
      };

      await client.insert(schema.conversation).values(data);

      ids.chats.set(chat.id, id);
    }

    logger.info(`Migrate chats completed. Total: ${ids.chats.size} chats migrated.`);
  }

  async #migrateMessages(context: LegacyDataMigrator.Context) {
    const { legacyDataIdMap: ids, legacySqliteDB: sqlite, legacyMCPConfig: mcp, tx } = context;

    const logger = this.#logger.scope("MigrateMessages");
    const schema = this.#database.schema;
    const client = tx;

    const existsMessagesTable = sqlite
      .prepare<[], { count: number }>(
        "select count(*) as count from sqlite_master where type='table' and name='messages'",
      )
      .get();

    if (!existsMessagesTable || existsMessagesTable.count <= 0) {
      return logger.warning("No messages table found.");
    }

    const messages = sqlite
      .prepare<
        [],
        {
          id: string;
          prompt: string | null;
          reply: string | null;
          reason: string | null;
          inputTokens: string | null;
          outputTokens: string | null;
          chatId: string | null;
          temperature: number | null;
          model: string | null;
          memo: string | null;
          createdAt: number | null;
          isActive: number | null;
          citedFiles: string | null;
          citedChunks: string | null;
          maxTokens: number | null;
          structuredPrompts: string | null;
        }
      >("select * from messages")
      .iterate();

    for (const message of messages) {
      const id = crypto.randomUUID();
      const conversationId = message.chatId ? ids.chats.get(message.chatId) : null;

      if (!conversationId) {
        logger.warning(`No chat found for message ${message.id}. Skipping...`);
        continue;
      }

      let prompt: TurnPrompt | undefined;

      if (message.structuredPrompts) {
        try {
          const json = JSON.parse(message.structuredPrompts);

          if (Array.isArray(json) && json.length > 0 && json.every((item) => item.role && item.raw)) {
            const legacyPrompts = json as LegacyStructuredPrompt[];
            const legacyServerKey = legacyPrompts[0].raw.prompt.source;
            const legacyServerName = mcp.mcpServers[legacyServerKey]?.name || legacyServerKey;
            const legacyServerId = ids.mcp_config.get(legacyServerKey) || crypto.randomUUID();

            const external: TurnPrompt.ExternalPrompt = {
              type: "external-prompt",
              messages: [],
              server: {
                id: legacyServerId,
                name: legacyServerName,
              },
              name: legacyPrompts[0].raw.prompt.name,
              description: legacyPrompts[0].raw.prompt.description,
            };

            for (const legacy of legacyPrompts) {
              const role = legacy.role;
              const blocks = legacy.raw.content;

              external.messages.push({
                role,
                content: blocks.map((block) => this.#mcpContentConverter.convert(block, "")),
              });
            }

            prompt = external;
          }
        } catch (error) {
          logger.warning(`Failed to parse structured prompts; skipping this message.`, error);
        }
      } else if (message.prompt) {
        prompt = {
          type: "user-input",
          content: [],
        };

        for (const item of splitByImg(message.prompt)) {
          if (item.type === "text") {
            prompt.content.push({
              type: "text",
              text: item.data,
            });
          } else if (item.dataType === "base64") {
            const desc = this.#urlParser.parse(item.data);

            if (desc.type === "inline") {
              prompt.content.push({
                type: "file",
                mimetype: desc.mimetype,
                content: desc.data,
              });
            } else {
              logger.warning(`Failed to parse image file data url extracted from text; skipping this file.`);
            }
          } else {
            prompt.content.push({
              type: "reference",
              mimetype: item.mimeType,
              url: item.data,
            });
          }
        }
      }

      if (!prompt) {
        logger.warning(`No prompt found for message ${message.id}. Skipping...`);
        continue;
      }

      if (message.citedChunks && prompt.type === "user-input") {
        try {
          const chunks = JSON.parse(message.citedChunks);

          if (Array.isArray(chunks) && chunks.every((chunk) => chunk?.id && chunk.content)) {
            for (const chunk of chunks) {
              const id = ids.knowledge_chunks.get(chunk.id);

              prompt.content.push({
                type: "reference",
                url: this.#urlParser.formatDocumentFragment(id || crypto.randomUUID()),
                mimetype: "text/plain",
              });
            }
          }
        } catch {}
      }

      const reply: TurnReply = [];

      if (message.reason) {
        reply.push({
          type: "reasoning",
          text: message.reason,
        });
      }

      if (message.reply) {
        for (const item of splitByImg(message.reply)) {
          if (item.type === "text") {
            for (const text of splitByCitations(item.data)) {
              if (typeof text === "string") {
                reply.push({
                  type: "text",
                  text,
                });
              } else {
                const id = ids.knowledge_chunks.get(text.id);

                reply.push({
                  type: "reference",
                  url: this.#urlParser.formatDocumentFragment(id || crypto.randomUUID()),
                  mimetype: "text/plain",
                });
              }
            }
          } else if (item.dataType === "base64") {
            const desc = this.#urlParser.parse(item.data);

            if (desc.type === "inline") {
              reply.push({
                type: "file",
                mimetype: desc.mimetype,
                content: desc.data,
              });
            } else {
              logger.warning(`Failed to parse image file data url extracted from text; skipping this file.`);
            }
          } else {
            reply.push({
              type: "reference",
              mimetype: item.mimeType,
              url: item.data,
            });
          }
        }
      }

      if (reply.length === 0) {
        logger.warning(`No reply found for message ${message.id}. Skipping...`);
        continue;
      }

      const data: TurnInsert = {
        id,
        conversationId,
        prompt,
        usage: {},
        reply: [],
        finishReason: "stop",
        createTime: message.createdAt ? new Date(message.createdAt * 1000) : new Date(),
        updateTime: message.createdAt ? new Date(message.createdAt * 1000) : new Date(),
      };

      await client.insert(schema.turn).values(data);

      ids.chats.set(message.id, id);
    }

    logger.info(`Migrate chats completed. Total: ${ids.chats.size} chats migrated.`);
  }

  /**
   * Execute database migration
   *
   * @param sqlite SQLite database connection
   * @param lance LanceDB vector database connection
   *
   * @returns Promise<void> A Promise that resolves when the migration is complete
   */
  async migrate(sqlite: SqliteDB, lance: LanceDB, mcp: LegacyMCPConfig) {
    const logger = this.#logger.scope("Migrate");
    const client = this.#database.client;

    // if (this.state.migrating || this.state.migrated) {
    //   return;
    // }

    this.update((draft) => {
      draft.migrating = true;
    });

    logger.info("Starting database migration...");

    try {
      await client.transaction(async (tx) => {
        const context: LegacyDataMigrator.Context = {
          legacyLanceDB: lance,
          legacySqliteDB: sqlite,
          legacyDataIdMap: {
            prompts: new Map<string, string>(),
            usages: new Map<string, string>(),
            knowledge_collections: new Map<string, string>(),
            knowledge_files: new Map<string, string>(),
            chat_knowledge_rels: new Map<string, string>(),
            chats: new Map<string, string>(),
            folders: new Map<string, string>(),
            bookmarks: new Map<string, string>(),
            messages: new Map<string, string>(),

            mcp_config: new Map<string, string>(),
            provider_config: new Map<string, string>(),

            knowledge_chunks: new Map<string, string>(),
          },
          legacyMCPConfig: mcp,
          tx,
        };

        await this.#migrateMCPConfig(context).catch((error) => {
          logger.error("Failed to migrate mcp config", error);
        });
        await this.#migrateKnowledge(context).catch((error) => {
          logger.error("Failed to migrate knowledge", error);
        });
        await this.#migratePrompts(context).catch((error) => {
          logger.error("Failed to migrate prompts", error);
        });
        await this.#migrateFolders(context).catch((error) => {
          logger.error("Failed to migrate folders", error);
        });
        await this.#migrateChats(context).catch((error) => {
          logger.error("Failed to migrate chats", error);
        });
        await this.#migrateMessages(context).catch((error) => {
          logger.error("Failed to migrate messages", error);
        });

        throw new Error("Migration stop.");
      });
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
        migrated: false,
        migrating: false,
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
    migrated: boolean;
    /**
     * Indicates whether a migration is currently in progress
     */
    migrating: boolean;
  };

  export type Context = {
    legacyDataIdMap: Record<(typeof LEGACY_DATABASE_TABLES)[number], Map<string, string>>;
    legacySqliteDB: SqliteDB;
    legacyLanceDB: LanceDB;
    legacyMCPConfig: LegacyMCPConfig;
    tx: Database.Transaction;
  };
}
