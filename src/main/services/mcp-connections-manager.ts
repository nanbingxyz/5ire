import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ClientCapabilities, Implementation, ServerCapabilities } from "@modelcontextprotocol/sdk/types.js";
import { asError } from "catch-unknown";
import { eq } from "drizzle-orm";
import { app } from "electron";
import { isEqual } from "lodash";
import { Database } from "@/main/database";
import type { Server } from "@/main/database/types";
import { Container } from "@/main/internal/container";
import { Emitter } from "@/main/internal/emitter";
import { Stateful } from "@/main/internal/stateful";
import { Logger } from "@/main/services/logger";
import { MCPServersManager } from "@/main/services/mcp-servers-manager";

/**
 * The implementation details of the Model Context Protocol (MCP) client.
 */
const CLIENT_IMPLEMENTATION: Implementation = {
  name: "5ire",
  version: app.getVersion(),
  title: "5ire",
};

/**
 * The capabilities that the MCP client supports.
 */
const CLIENT_CAPABILITIES: ClientCapabilities = {};

/**
 * Manages connections to Model Context Protocol (MCP) servers.
 *
 * This class handles the lifecycle of MCP server connections including:
 * - Establishing connections via different transports (stdio, sse, http)
 * - Managing connection states (connecting, connected, error)
 * - Handling server activation/deactivation
 * - Providing access to connected clients and their capabilities
 *
 * It also manages persistence of server configurations in the database
 * and emits events when connection states change.
 */
export class MCPConnectionsManager extends Stateful<MCPConnectionsManager.State> {
  #logger = Container.inject(Logger).scope("MCPConnectionsManager");
  #database = Container.inject(Database);
  #emitter = Emitter.create<MCPConnectionsManager.Events>();
  #serversManager = Container.inject(MCPServersManager);

  /**
   * The emitter for MCP server events.
   */
  get emitter() {
    return this.#emitter;
  }

  constructor() {
    super(() => {
      return {
        connections: new Map(),
      };
    });
  }

  /**
   * Creates a transport client for connecting to an MCP server based on the server's transport configuration.
   *
   * @param server - The server configuration containing transport type, endpoint, and optional config
   * @returns A configured client transport instance ready for MCP communication
   * @throws {Error} When stdio transport endpoint is invalid or missing command
   */
  #transport(server: MCPConnectionsManager.ServerSnapshot) {
    if (server.transport === "stdio") {
      const args = server.endpoint.split(" ").filter(Boolean);
      const command = args.shift();

      if (!command) {
        throw new Error(`Invalid stdio transport endpoint: ${server.endpoint}`);
      }

      return new StdioClientTransport({
        command,
        args,
        env: server.config,
        stderr: "ignore",
      });
    }

    const url = new URL(server.endpoint);
    const requestInit: RequestInit = {
      headers: server.config,
    };

    // StreamableHTTPClientTransport can handle both SSE and HTTP Stream transport modes
    // so SSEClientTransport is no longer needed
    return new StreamableHTTPClientTransport(url, { requestInit });
  }

  /**
   * Establishes a connection to an MCP server with automatic retry logic.
   *
   * @param server - The server configuration to connect to
   */
  #connect(server: MCPConnectionsManager.ServerSnapshot) {
    const logger = this.#logger.scope("Connect");

    {
      const connection = this.state.connections.get(server.id);
      if (connection && connection.status !== "error") {
        return logger.info(`Server already connected: ${server.id} ("${server.endpoint}")`);
      }
    }

    logger.info("Connecting to mcp server:", server);

    const controller = new AbortController();
    const connection: MCPConnectionsManager.Connection = {
      status: "connecting",
      controller,
      serverSnapshot: server,
      promise: Promise.resolve().then(async () => {
        let connectError: unknown;

        for (let retries = 0; retries < 3; retries++) {
          if (retries > 0) {
            logger.info(`Retrying connection to mcp server: ${server.id} ("${server.endpoint}")`);
          }

          // Wait for a moment before retrying, increasing the delay with each retry
          await new Promise((resolve) => setTimeout(resolve, 1000 * retries));

          try {
            const client = new Client(CLIENT_IMPLEMENTATION, { capabilities: CLIENT_CAPABILITIES });
            const capabilities = await client.connect(this.#transport(server), {}).then(() => {
              const data = client.getServerCapabilities();

              if (!data) {
                return client
                  .close()
                  .catch(() => {})
                  .then(() => {
                    throw new Error("Server does not support the required capabilities");
                  });
              }

              return data;
            });

            if (controller.signal.aborted) {
              return client.close().catch(() => {});
            }

            const connected = {
              status: "connected",
              client,
              capabilities,
              projectId: server.projectId || undefined,
              serverSnapshot: server,
            } satisfies MCPConnectionsManager.Connection;

            logger.info(`Connected to mcp server: ${server.id} ("${server.endpoint}")`);

            this.update((draft) => {
              draft.connections.set(server.id, connected);
            });
            this.emitter.emit("server-connected", {
              id: server.id,
              connection: connected,
            });

            return;
          } catch (e) {
            if (controller.signal.aborted) {
              return;
            }

            connectError = e;
          }
        }

        logger.capture(connectError, {
          reason: `Failed to connect to mcp server: ${server.id} ("${server.endpoint}")`,
        });

        this.update((draft) => {
          draft.connections.set(server.id, {
            status: "error",
            error: asError(connectError).message,
            serverSnapshot: server,
          });
        });
      }),
    };

    this.update((draft) => {
      draft.connections.set(server.id, connection);
    });

    controller.signal.addEventListener("abort", () => {
      this.update((draft) => {
        draft.connections.delete(server.id);
      });
    });
  }

  /**
   * Disconnects from an MCP server.
   *
   * @param id - The ID of the server to disconnect from
   */
  #disconnect(id: string) {
    const connection = this.state.connections.get(id);

    if (connection) {
      if (connection.status === "connected") {
        connection.client.close().catch(() => {});
        this.emitter.emit("server-disconnected", { id });
      }

      if (connection.status === "connecting") {
        connection.controller.abort();
      }
    }

    this.update((draft) => {
      draft.connections.delete(id);
    });
  }

  /**
   * Initializes the MCP connections manager by connecting to all active servers.
   *
   * This method retrieves all active servers from the database and attempts to establish
   * connections to them. It runs during the application startup process to restore
   * previously configured MCP server connections.
   *
   * Connection attempts are made concurrently for all active servers, and any
   * individual connection failures are caught and logged without stopping the
   * initialization of other servers.
   *
   * The method uses a live query to monitor changes to the active servers list,
   * automatically connecting to newly added servers and disconnecting from removed ones.
   */
  async init() {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const driver = this.#database.driver;
    const logger = this.#logger.scope("Init");

    const query = client
      .select(
        Database.utils.aliasedColumns({
          id: schema.server.id,
          transport: schema.server.transport,
          projectId: schema.server.projectId,
          config: schema.server.config,
          endpoint: schema.server.endpoint,
        }),
      )
      .from(schema.server)
      .where(eq(schema.server.active, true))
      .orderBy(schema.server.createTime);

    const sql = query.toSQL();

    await driver.live
      .changes<Awaited<ReturnType<(typeof query)["execute"]>>[number]>({
        query: sql.sql,
        params: sql.params,
        key: "id",
      })
      .then((live) => {
        const apply = (changes: typeof live.initialChanges) => {
          for (const change of changes) {
            const server: MCPConnectionsManager.ServerSnapshot = {
              id: change.id,
              transport: change.transport,
              projectId: change.projectId,
              config: change.config,
              endpoint: change.endpoint,
              shortId: this.#serversManager.getShortId(change.id),
            };

            const connection = this.state.connections.get(server.id);

            if (change.__op__ === "DELETE") {
              if (connection) {
                this.#disconnect(server.id);
              }
            } else {
              if (connection) {
                if (change.__op__ === "UPDATE") {
                  Object.assign(server, connection.serverSnapshot);

                  for (const column of change.__changed_columns__) {
                    if (column in server) {
                      // @ts-expect-error
                      server[column] = change[column];
                    }
                  }
                }

                if (isEqual(connection.serverSnapshot, server)) {
                  continue;
                }
              }

              this.#disconnect(server.id);
              this.#connect(server);
            }
          }
        };

        live.subscribe(apply);

        if (live.initialChanges.length) {
          logger.info(`Loading and connecting to ${live.initialChanges.length} active MCP servers`);
          apply(live.initialChanges);
        }
      });
  }

  /**
   * Gets a connected MCP server.
   *
   * @param id - The ID of the server
   */
  getConnectedOrThrow(id: string) {
    const connection = this.state.connections.get(id);

    if (!connection) {
      throw new Error(`No connection found for the server. Please check if the server exists and is active.`);
    }

    if (connection.status === "connecting") {
      throw new Error(
        `The server is still connecting. Please wait for the connection to complete or check the server status.`,
      );
    }

    if (connection.status === "error") {
      throw new Error(
        `Server connection failed: ${connection.error}. Please check the server configuration and network connectivity, then try reconnecting.`,
      );
    }

    return connection;
  }
}

export namespace MCPConnectionsManager {
  /**
   * Represents a snapshot of an MCP server.
   */
  export type ServerSnapshot = Pick<Server, "id" | "transport" | "projectId" | "config" | "endpoint"> & {
    shortId: number;
  };

  /**
   * Represents the connection state of an MCP server.
   *
   * The connection can be in one of three states:
   * - "connected": The server is successfully connected and ready to use
   * - "connecting": The server is currently establishing a connection
   * - "error": The server connection has failed
   */
  export type Connection =
    | {
        /**
         * Connection status - indicates the server is successfully connected
         */
        status: "connected";
        /**
         * The MCP client instance for communicating with the server
         */
        client: Client;
        /**
         * Capabilities advertised by the connected server
         */
        capabilities: ServerCapabilities;
        /**
         * Optional project ID associated with this connection
         */
        projectId?: string;
        /**
         * Snapshot of the server configuration
         */
        serverSnapshot: ServerSnapshot;
      }
    | {
        /**
         * Connection status - indicates the server is currently connecting
         */
        status: "connecting";
        /**
         * Promise that resolves when the connection attempt completes
         */
        promise: Promise<void>;
        /**
         * Controller for aborting the connection attempt
         */
        controller: AbortController;
        /**
         * Snapshot of the server configuration
         */
        serverSnapshot: ServerSnapshot;
      }
    | {
        /**
         * Connection status - indicates the server connection failed
         */
        status: "error";
        /**
         * Error message describing the connection failure
         */
        error: string;
        /**
         * Snapshot of the server configuration
         */
        serverSnapshot: ServerSnapshot;
      };

  /**
   * The state of the MCP connections manager service
   */
  export type State = {
    /**
     * A map of server IDs to their connection states
     */
    connections: Map<string, Connection>;
  };

  /**
   * Events emitted by the MCP connections manager service
   */
  export type Events = {
    /**
     * Emitted when a server connection is successfully established
     */
    "server-connected": {
      /**
       * The ID of the server that was connected
       */
      id: string;
      /**
       * The connection state of the server, Can be used to access client methods and server capabilities
       */
      connection: Extract<Connection, { status: "connected" }>;
    };
    /**
     * Emitted when a server connection is disconnected
     */
    "server-disconnected": {
      /**
       * The ID of the server that was disconnected
       */
      id: string;
    };
  };
}
