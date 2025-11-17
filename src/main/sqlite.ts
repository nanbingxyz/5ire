/* eslint-disable no-console */
import Database, { type Statement } from "better-sqlite3";
import { app, ipcMain } from "electron";
import path from "path";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";
import { isOneDimensionalArray } from "../utils/util";

export const initLegacyDatabase = () => {
  const logger = Container.inject(Logger).scope("LegacyDatabase");
  const dbPath = path.join(app.getPath("userData"), "5ire.db");
  const database = new Database(dbPath);

  function createTableFolders() {
    database
      .prepare(
        `
  CREATE TABLE IF NOT EXISTS "folders" (
    "id" text(31) NOT NULL,
    "name" text,
    "provider" text,
    "model" text,
    "systemMessage" text,
    "temperature" real,
    "maxTokens" integer,
    "knowledgeCollectionIds" text,
    "stream" integer(1) DEFAULT 1,
    "maxCtxMessages" integer DEFAULT 10,
    "createdAt" integer,
    PRIMARY KEY ("id")
  )`,
      )
      .run();
  }

  function createTableChats() {
    database
      .prepare(
        `
  CREATE TABLE IF NOT EXISTS "chats" (
    "id" text(31) NOT NULL,
    "folderId" text(31),
    "name" text,
    "summary" text,
    "provider" text,
    "model" text,
    "systemMessage" text,
    "temperature" real,
    "maxTokens" integer,
    "stream" integer(1) DEFAULT 1,
    "context" text,
    "maxCtxMessages" integer DEFAULT 10,
    "prompt" TEXT,
    "input" TEXT,
    "createdAt" integer,
    PRIMARY KEY ("id")
  )`,
      )
      .run();
  }

  function createTableMessages() {
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS "messages" (
      "id" text(31) NOT NULL,
      "prompt" TEXT COLLATE NOCASE,
      "reply" TEXT COLLATE NOCASE,
      "reasoning" TEXT,
      "inputTokens" integer,
      "outputTokens" integer,
      "chatId" text(31),
      "temperature" real,
      "model" text,
      "memo" text,
      "createdAt" integer,
      "isActive" integer(1),
      "citedFiles"	TEXT,
      "citedChunks"	TEXT,
      "maxTokens" INTEGER,
      PRIMARY KEY ("id"),
      CONSTRAINT "fk_messages_chats" FOREIGN KEY ("chatId") REFERENCES "chats" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
      )
      .run();
  }

  function createTableBookmarks() {
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS "bookmarks" (
    "id" text(31) NOT NULL,
    "msgId" text NOT NULL,
    "prompt" TEXT,
    "reply" TEXT,
    "reasoning" TEXT,
    "temperature" real,
    "model" text,
    "memo" text,
    "favorite" integer(1) DEFAULT 0,
    "citedFiles"	TEXT,
    "citedChunks"	TEXT,
    "createdAt" integer,
    PRIMARY KEY ("id"),
    CONSTRAINT "uix_msg_id" UNIQUE ("msgId" COLLATE BINARY ASC)
  )`,
      )
      .run();
  }

  function createTablePrompts() {
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS "prompts" (
    "id" text(31) NOT NULL,
    "name" text,
    "systemMessage" TEXT,
    "userMessage" text,
    "systemVariables" text,
    "userVariables" text,
    "models" text,
    "temperature" real,
    "maxTokens" integer,
    "createdAt" integer,
    "updatedAt" integer,
    "pinedAt" integer DEFAULT NULL,
    PRIMARY KEY ("id")
  )`,
      )
      .run();
  }

  function createTableUsages() {
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS "usages" (
    "id" text(31),
    "provider" text,
    "model" text,
    "InputTokens" integer,
    "outputTokens" integer,
    "inputPrice" number,
    "outputPrice" NUMBER,
    "createdAt" integer,
    PRIMARY KEY ("id")
  )`,
      )
      .run();
  }

  function createTableKnowledgeCollections() {
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS "knowledge_collections" (
     "id" text(31) NOT NULL,
     "name" varchar NOT NULL,
     "memo" text,
     "pinedAt" integer,
     "favorite" integer(1),
     "createdAt" integer NOT NULL,
     "updatedAt" integer NOT NULL,
     PRIMARY KEY (id));`,
      )
      .run();
  }

  function createTableKnowledgeFiles() {
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS "knowledge_files" (
    "id" text(31) NOT NULL,
    "collectionId" text(31) NOT NULL,
    "name" varchar NOT NULL,
    "size" integer,
    "numOfChunks" integer,
    "createdAt" integer NOT NULL,
    "updatedAt" integer NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (collectionId)
        REFERENCES knowledge_collections(id)
        ON DELETE CASCADE
    );`,
      )
      .run();
  }

  function createTableChatKnowledgeRels() {
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS "chat_knowledge_rels" (
	"id" text NOT NULL,
	"chatId" text NOT NULL,
	"collectionId" text NOT NULL,
	FOREIGN KEY("chatId") REFERENCES "chats"("id") ON DELETE CASCADE,
	FOREIGN KEY("collectionId") REFERENCES "knowledge_collections"("id") ON DELETE CASCADE,
	PRIMARY KEY (id)
)`,
      )
      .run();
  }

  function alertTableChats() {
    const columns = database.prepare(`PRAGMA table_info(chats)`).all();
    const hasPromptColumn = columns.some((column: any) => column.name === "prompt");
    if (!hasPromptColumn) {
      database.prepare(`ALTER TABLE chats ADD COLUMN prompt TEXT`).run();
      logger.debug("Added [prompt] column to [chats] table");
    } else {
      logger.debug("[prompt】 column already exists in [chats] table");
    }
    const hasInputColumn = columns.some((column: any) => column.name === "input");
    if (!hasInputColumn) {
      database.prepare(`ALTER TABLE chats ADD COLUMN input TEXT`).run();
      logger.debug("Added [input] column to [chats] table");
    } else {
      logger.debug("[input] column already exists in [chats] table");
    }
    const hasFolderIdColumn = columns.some((column: any) => column.name === "folderId");
    if (!hasFolderIdColumn) {
      database.prepare(`ALTER TABLE chats ADD COLUMN folderId TEXT`).run();
      logger.debug("Added [folderId] column to [chats] table");
    } else {
      logger.debug("[folderId] column already exists in [chats] table");
    }
    const hasProviderColumn = columns.some((column: any) => column.name === "provider");
    if (!hasProviderColumn) {
      database.prepare(`ALTER TABLE chats ADD COLUMN provider TEXT`).run();
      logger.debug("Added [provider] column to [chats] table");
    } else {
      logger.debug("[provider column already exists in [chats] table");
    }
    const hasNameColumn = columns.some((column: any) => column.name === "name");
    if (!hasNameColumn) {
      database.prepare(`ALTER TABLE chats ADD COLUMN name TEXT`).run();
      logger.debug("Added [name] column to [chats] table");
    } else {
      logger.debug("[name] column already exists in [chats] table");
    }
  }

  function alertTableMessages() {
    const columns = database.prepare(`PRAGMA table_info(messages)`).all();
    const hasReasoningColumn = columns.some((column: any) => column.name === "reasoning");
    if (!hasReasoningColumn) {
      database.prepare(`ALTER TABLE messages ADD COLUMN reasoning TEXT`).run();
      logger.debug("Added [reasoning] column to  [messages] table");
    } else {
      logger.debug("[reasoning] column already exists in [Messages] table");
    }

    // 2025-08-07
    // Add 'structuredPrompts' column to 'messages' table.
    const hasStructuredPromptsColumn = columns.some((column: any) => column.name === "structuredPrompts");
    if (!hasStructuredPromptsColumn) {
      database.prepare(`ALTER TABLE messages ADD COLUMN structuredPrompts TEXT`).run();
      logger.debug("Added [structuredPrompts] column to [messages] table");
    } else {
      logger.debug("[structuredPrompts] column already exists in [messages] table");
    }
  }

  function alertTableBookmarks() {
    const columns = database.prepare(`PRAGMA table_info(bookmarks)`).all();
    const hasReasoningColumn = columns.some((column: any) => column.name === "reasoning");
    if (!hasReasoningColumn) {
      database.prepare(`ALTER TABLE bookmarks ADD COLUMN reasoning TEXT`).run();
      logger.debug("Added [reasoning] column to [bookmarks] table");
    } else {
      logger.debug("[reasoning] column already exists in [bookmarks] table");
    }
  }

  function alertTableFolders() {
    const columns = database.prepare(`PRAGMA table_info(folders)`).all();
    const hasProviderColumn = columns.some((column: any) => column.name === "provider");
    if (!hasProviderColumn) {
      database.prepare(`ALTER TABLE folders ADD COLUMN provider TEXT`).run();
      logger.debug("Added [provider] column to [folders] table");
    } else {
      logger.debug("[provider] column already exists in [folders] table");
    }
  }

  const initDatabase = database.transaction(() => {
    logger.debug("Init database...");

    database.pragma("foreign_keys = ON");
    createTableFolders();
    createTableChats();
    createTableMessages();
    createTableBookmarks();
    createTablePrompts();
    createTableUsages();
    createTableKnowledgeCollections();
    createTableKnowledgeFiles();
    createTableChatKnowledgeRels();
    // v0.9.6
    alertTableChats();
    // v.0.9.7
    alertTableMessages();
    alertTableBookmarks();
    // v1.0.0
    alertTableFolders();

    logger.info("Database initialized.");
  });

  database.pragma("journal_mode = WAL"); // performance reason
  initDatabase();

  ipcMain.handle("db-all", (event, data) => {
    const { sql, params } = data;
    logger.debug("db-all", sql, params);
    try {
      return database.prepare(sql).all(params);
    } catch (err: any) {
      logger.capture(err);
      return [];
    }
  });

  ipcMain.handle("db-run", (_, data) => {
    const { sql, params } = data;
    logger.debug("db-run", sql, params);
    try {
      database.prepare(sql).run(params);
      return true;
    } catch (err: any) {
      logger.capture(err);
      return false;
    }
  });

  ipcMain.handle("db-transaction", (_, data: any[]) => {
    logger.debug("db-transaction", JSON.stringify(data, null, 2));
    const tasks: { statement: Statement; params: any[] }[] = [];
    data.forEach(({ sql, params }) => {
      tasks.push({
        statement: database.prepare(sql),
        params,
      });
    });
    return new Promise((resolve) => {
      try {
        database.transaction(() => {
          tasks.forEach(({ statement, params }) => {
            if (isOneDimensionalArray(params)) {
              statement.run(params);
            } else {
              params.forEach((param: any) => {
                statement.run(param);
              });
            }
          });
        })();
        resolve(true);
      } catch (err: any) {
        logger.capture(err);
        resolve(false);
      }
    });
  });

  ipcMain.handle("db-get", (_, data) => {
    const { sql, id } = data;
    logger.debug("db-get", sql, id);
    try {
      return database.prepare(sql).get(id);
    } catch (err: any) {
      logger.capture(err);
      return null;
    }
  });

  return database;
};
