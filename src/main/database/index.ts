import { PGlite } from "@electric-sql/pglite";
import { type LiveNamespace, live } from "@electric-sql/pglite/live";
import { NodeFS } from "@electric-sql/pglite/nodefs";
import { vector } from "@electric-sql/pglite/vector";
import { type Column, type GetColumnData, type SQL, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { schema } from "@/main/database/schema";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

/**
 * Database class is used to handle database initialization and management
 * Responsible for creating database instances, applying migrations and providing ORM clients
 */
export class Database {
  /**
   * Promise that resolves when database initialization is complete
   */
  #ready: Promise<Database.Client>;

  /**
   * Database client instance
   */
  #client?: Database.Client;

  /**
   * Database driver instance
   */
  #driver?: Database.Driver;

  #logger = Container.inject(Logger).scope("Database");
  #environment = Container.inject(Environment);

  /**
   * Initialize the database
   *
   * Performs the following operations:
   * 1. Creates a PGlite database instance with NodeFS storage and extension plugins
   * 2. Creates vector extension
   * 3. Initializes Drizzle ORM client
   * 4. Executes database migrations
   *
   * @returns Promise<Database.Client> Database client instance
   */
  async #init() {
    const logger = this.#logger.scope("Init");

    logger.info("Database initialization started...");

    const driver = await PGlite.create({
      fs: new NodeFS(this.#environment.databaseDataFolder),
      extensions: {
        vector,
        live,
      },
    });

    await driver.exec("CREATE EXTENSION IF NOT EXISTS vector;");

    logger.info("Creating Drizzle ORM client...");

    const clientQueryLogger = this.#logger.scope("DrizzleQuery");
    const client = drizzle(driver, {
      schema,
      logger: {
        logQuery: (query, params) => {
          const normalizedParams = params.map((value) => {
            if (typeof value === "string") {
              try {
                const json = JSON.parse(value);
                if (Array.isArray(json)) {
                  if (json.every((item) => typeof item === "number" && Number.isInteger(item))) {
                    return `<butter length=${json.length}>`;
                  }
                  if (json.every((item) => typeof item === "number")) {
                    return `<vector length=${json.length}>`;
                  }
                }
              } catch {}
            }

            return value;
          });

          clientQueryLogger.verbose(`${query} | Parameters: `, JSON.stringify(normalizedParams));
        },
      },
    });

    logger.info(`Starting database migration from ${this.#environment.databaseMigrationsFolder}...`);

    await migrate(client, {
      migrationsFolder: this.#environment.databaseMigrationsFolder,
    });

    logger.info("Database migration successful.");
    logger.info("Database initialization successful.");

    this.#client = client;
    this.#driver = driver;

    return client;
  }

  /**
   * Constructor
   *
   * Starts the database initialization process
   */
  constructor() {
    this.#ready = this.#init();
  }

  /**
   * Get database initialization status
   *
   * @returns Promise<Database.Client> Database client initialization Promise
   */
  get ready() {
    return this.#ready;
  }

  /**
   * Get database client instance
   *
   * @throws {Error} Throws error when database client is not ready
   * @returns Database.Client Database client instance
   */
  get client() {
    if (!this.#client) {
      throw new Error("Database client is not ready yet.");
    }

    return this.#client;
  }

  /**
   * Get database driver instance
   *
   * @throws {Error} Throws error when database driver is not ready
   * @returns Database.Driver Database driver instance
   */
  get driver() {
    if (!this.#driver) {
      throw new Error("Database driver is not ready yet.");
    }

    return this.#driver;
  }

  /**
   * Get database schema definition
   *
   * @returns Database schema object
   */
  get schema() {
    return schema;
  }

  /**
   * Database utility functions collection
   */
  static utils = {
    /**
     * Create an alias for a column
     *
     * @template T extends Column Column type
     * @param column Original column
     * @param alias Alias
     * @returns SQL expression
     */
    aliasedColumn: <T extends Column>(column: T, alias: string) => {
      return sql<GetColumnData<T>>`${column} as ${sql.identifier(alias)}`;
    },

    /**
     * Create aliases for multiple columns
     *
     * @template T extends Record<string, Column> Column record type
     * @param columns Column object
     * @returns Object containing SQL expressions with aliased columns
     */
    aliasedColumns: <T extends Record<string, Column>>(columns: T) => {
      return Object.fromEntries(
        Object.entries(columns).map(([alias, column]) => {
          return [alias, Database.utils.aliasedColumn(column, alias)];
        }),
      ) as {
        [K in keyof T]: SQL<GetColumnData<T[K]>>;
      };
    },
  };
}

/**
 * Database namespace
 *
 * Contains database-related type definitions
 */
export namespace Database {
  /**
   * Database client type
   *
   * Drizzle ORM PGlite database client type
   */
  export type Client = PgliteDatabase<typeof schema>;

  /**
   * Database driver type
   *
   * Extended PGlite driver type including live namespace
   */
  export type Driver = PGlite & {
    live: LiveNamespace;
  };
}
