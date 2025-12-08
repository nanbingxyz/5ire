import { eq } from "drizzle-orm";
import { default as memoize } from "memoizee";
import { Database } from "@/main/database";
import type { Server } from "@/main/database/types";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

/**
 * Manages MCP (Machine Control Protocol) servers including creation, deletion,
 * activation, deactivation, and real-time monitoring of server states.
 *
 * This class provides methods to perform CRUD operations on MCP servers and
 * maintains live queries to track server state changes in real-time.
 */
export class MCPServersManager {
  #logger = Container.inject(Logger).scope("MCPServersManager");
  #database = Container.inject(Database);

  /**
   * Initializes the MCPServersManager instance.
   *
   * Memoizes the liveServers and liveActiveServers methods to cache their results
   * and avoid redundant computations. The memoization is configured to use
   * primitive values as cache keys and handle promises.
   */
  constructor() {
    this.liveServers = memoize(this.liveServers.bind(this), {
      primitive: true,
      promise: true,
    });
    this.liveActiveServers = memoize(this.liveActiveServers.bind(this), {
      primitive: true,
      promise: true,
    });
  }

  /**
   * Creates a new MCP server in the database.
   *
   * @param options - The options for creating the server
   */
  async createServer(options: MCPServersManager.CreateServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    if (options.transport !== "stdio") {
      try {
        new URL(options.endpoint);
      } catch {
        throw new Error("Invalid remote server url");
      }
    }

    if (options.projectId) {
      await client
        .select()
        .from(schema.project)
        .where(eq(schema.project.id, options.projectId))
        .then(async ([project]) => {
          if (!project) {
            throw new Error("Project not found");
          }
        });
    }

    await client.insert(schema.server).values(options).returning().execute();
  }

  /**
   * Deletes an existing MCP server from the database.
   *
   * @param options - The options for deleting the server
   */
  async deleteServer(options: MCPServersManager.DeleteServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    await client.delete(schema.server).where(eq(schema.server.id, options.id)).execute();
  }

  /**
   * Updates an existing MCP server in the database.
   *
   * @param options - The options for updating the server
   */
  async updateServer(options: MCPServersManager.UpdateServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    await client
      .update(schema.server)
      .set({
        label: options.label,
        config: options.config,
        endpoint: options.endpoint,
        approvalPolicy: options.approvalPolicy,
        description: options.description,
      })
      .where(eq(schema.server.id, options.id))
      .execute();
  }

  /**
   * Activates an existing MCP server in the database.
   *
   * @param options - The options for activating the server
   */
  async activateServer(options: MCPServersManager.ActivateServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    await client.update(schema.server).set({ active: true }).where(eq(schema.server.id, options.id)).execute();
  }

  /**
   * Deactivates an existing MCP server in the database.
   *
   * @param options - The options for deactivating the server
   */
  async deactivateServer(options: MCPServersManager.DeactivateServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    await client.update(schema.server).set({ active: false }).where(eq(schema.server.id, options.id)).execute();
  }

  /**
   * Creates a live query select object with aliased columns for server data.
   *
   * This method prepares the column selection for live queries by aliasing
   * the server table columns to ensure consistent property names in the results.
   *
   * @returns An object mapping aliased column names to their respective column references
   */
  #createLiveQuerySelect() {
    const schema = this.#database.schema;

    return Database.utils.aliasedColumns({
      id: schema.server.id,
      createTime: schema.server.createTime,
      updateTime: schema.server.updateTime,
      label: schema.server.label,
      description: schema.server.description,
      transport: schema.server.transport,
      approvalPolicy: schema.server.approvalPolicy,
      active: schema.server.active,
      projectId: schema.server.projectId,
      config: schema.server.config,
      endpoint: schema.server.endpoint,
    });
  }

  /**
   * Listen to server changes in real-time
   * Returns an object with subscribe method, refresh function and initial results
   * that continuously pushes updates of servers
   *
   * @returns Object containing:
   * - subscribe: Function to add a subscriber that receives updates
   * - refresh: Function to manually refresh the data
   * - initialResults: Initial set of server data
   */
  async liveServers() {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;
    const logger = this.#logger.scope("LiveServers");

    const query = client.select(this.#createLiveQuerySelect()).from(schema.server).orderBy(schema.server.createTime);

    const sql = query.toSQL();
    const subscribers = new Set<(results: typeof live.initialResults) => void>();

    const live = await driver.live.query<Awaited<ReturnType<(typeof query)["execute"]>>[number]>({
      query: sql.sql,
      params: sql.params,
      callback: (results) => {
        for (const subscriber of subscribers) {
          subscriber(results);
        }
      },
    });

    logger.debug("Live query started");

    return {
      subscribe: (subscriber: (results: typeof live.initialResults) => void) => {
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      },
      refresh: live.refresh,
      initialResults: live.initialResults,
    };
  }

  /**
   * Listen to active server changes in real-time
   * Returns an object with subscribe method, refresh function and initial results
   * that continuously pushes updates of active servers
   *
   * @returns Object containing:
   * - subscribe: Function to add a subscriber that receives updates
   * - refresh: Function to manually refresh the data
   * - initialResults: Initial set of active server data
   */
  async liveActiveServers() {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;
    const logger = this.#logger.scope("LiveActiveServers");

    const query = client
      .select(this.#createLiveQuerySelect())
      .from(schema.server)
      .where(eq(schema.server.active, true))
      .orderBy(schema.server.createTime);

    const sql = query.toSQL();
    const subscribers = new Set<(results: typeof live.initialResults) => void>();

    const live = await driver.live.query<Awaited<ReturnType<(typeof query)["execute"]>>[number]>({
      query: sql.sql,
      params: sql.params,
      callback: (results) => {
        for (const subscriber of subscribers) {
          subscriber(results);
        }
      },
    });

    logger.debug("Live query started");

    return {
      subscribe: (subscriber: (results: typeof live.initialResults) => void) => {
        subscribers.add(subscriber);
        return () => {
          subscribers.delete(subscriber);
        };
      },
      refresh: live.refresh,
      initialResults: live.initialResults,
    };
  }
}

export namespace MCPServersManager {
  /**
   * Options for creating a new MCP server.
   */
  export type CreateServerOptions = Pick<Server, "label" | "config" | "endpoint" | "transport" | "approvalPolicy"> & {
    /**
     * The project ID to associate with the server.
     */
    projectId?: string;
    /**
     * The description of the server.
     */
    description?: string;
    /**
     * Whether the server should be active.
     */
    active?: boolean;
  };

  /**
   * Options for updating a MCP server.
   */
  export type UpdateServerOptions = Omit<CreateServerOptions, "projectId" | "active" | "transport"> & {
    /**
     * The ID of the server to update.
     */
    id: string;
  };

  /**
   * Options for deleting a MCP server.
   */
  export type DeleteServerOptions = {
    /**
     * The ID of the server to delete.
     */
    id: string;
  };

  /**
   * Options for listing MCP servers.
   */
  export type ListServersOptions = {
    /**
     * The ID of the project to list servers for
     */
    projectId?: string;
    /**
     * Whether to include servers that are not associated with a project
     */
    includeGlobal?: boolean;
  };

  /**
   * Options for activating a MCP server.
   */
  export type ActivateServerOptions = {
    /**
     * The ID of the server to activate.
     */
    id: string;
  };

  /**
   * Options for deactivating a MCP server.
   */
  export type DeactivateServerOptions = {
    /**
     * The ID of the server to deactivate.
     */
    id: string;
  };
}
