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
  #ready?: Promise<Database.Client>;

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

    // Clean up live query views to prevent "out of shared memory" errors caused by improper subscription cleanup
    await driver
      .query<Record<"schemaname" | "viewname", string>>("SELECT * FROM pg_views WHERE viewname LIKE 'live_query_%';")
      .then(async (results) => {
        logger.info("Dropping live query views...");

        await Promise.all(
          results.rows.map(async (row) => {
            await driver.exec(`DROP VIEW IF EXISTS "${row.schemaname}"."${row.viewname}";`);
          }),
        );

        return logger.info(`Live query views dropped. Count: ${results.rows.length}`);
      })
      .catch((error) => {
        logger.error("Failed to drop live query views.", error);
      });

    await driver
      .query<Record<"schemaname" | "tablename", string>>(
        "SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE 'live_query_%' AND schemaname NOT IN ('pg_catalog', 'information_schema');",
      )
      .then(async (results) => {
        logger.info(`Found ${results.rows.length} live query tables to drop. Starting cleanup...`);

        await Promise.all(
          results.rows.map(async (row) => {
            await driver.exec(`DROP TABLE IF EXISTS "${row.schemaname}"."${row.tablename}" CASCADE;`);
          }),
        );

        return logger.info(`Live query tables dropped successfully. Count: ${results.rows.length}`);
      })
      .catch((error) => {
        logger.error("Failed to drop live query tables.", error);
      });

    await driver
      .query<Record<"name", string>>("SELECT name FROM pg_prepared_statements WHERE name LIKE 'live_query_%';")
      .then(async (results) => {
        logger.info(`Found ${results.rows.length} live query prepared statements to deallocate. Starting cleanup...`);

        await Promise.all(
          results.rows.map(async (row) => {
            await driver.exec(`DEALLOCATE ${row.name};`);
          }),
        );

        return logger.info(`Live query prepared statements deallocated successfully. Count: ${results.rows.length}`);
      })
      .catch((error) => {
        logger.error("Failed to deallocate live query prepared statements. Ensure this session created them.", error);
      });

    logger.info("Creating Drizzle ORM client...");

    const clientQueryLogger = this.#logger.scope("DrizzleQuery");
    const client = drizzle(driver, {
      schema,
      logger: {
        logQuery: (query) => {
          clientQueryLogger.verbose(
            query
              .replace(/[\n\r\t]+/g, " ")
              .replace(/ {2,}/g, " ")
              .trim(),
          );
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
   * Starts the database initialization process
   */
  init() {
    // biome-ignore lint/suspicious/noAssignInExpressions: x
    return (this.#ready = this.#init());
  }

  /**
   * Get database initialization status
   *
   * @returns Promise<Database.Client> Database client initialization Promise
   */
  get ready() {
    if (!this.#ready) {
      return Promise.reject(new Error("Database has not been initialized. Please call init() first."));
    }
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

  /**
   * Database transaction type
   *
   * Type representing a database transaction context
   */
  export type Transaction = Parameters<Exclude<Parameters<Client["transaction"]>[0], undefined>>[0];
}
