import { PGlite } from "@electric-sql/pglite";
import { type LiveNamespace, live } from "@electric-sql/pglite/live";
import { NodeFS } from "@electric-sql/pglite/nodefs";
import { vector } from "@electric-sql/pglite/vector";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { schema } from "@/main/database/schema";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

export class Database {
  #ready: Promise<Database.Client>;
  #client?: Database.Client;
  #driver?: Database.Driver;

  #logger = Container.inject(Logger).scope("Database");
  #environment = Container.inject(Environment);

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

  constructor() {
    this.#ready = this.#init();
  }

  get ready() {
    return this.#ready;
  }

  get client() {
    if (!this.#client) {
      throw new Error("Database client is not ready yet.");
    }

    return this.#client;
  }

  get driver() {
    if (!this.#driver) {
      throw new Error("Database driver is not ready yet.");
    }

    return this.#driver;
  }

  get schema() {
    return schema;
  }
}

export namespace Database {
  export type Client = PgliteDatabase<typeof schema>;

  export type Driver = PGlite & {
    live: LiveNamespace;
  };
}
