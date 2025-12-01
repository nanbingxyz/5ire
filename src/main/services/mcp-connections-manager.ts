import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ClientCapabilities, Implementation, ServerCapabilities } from "@modelcontextprotocol/sdk/types.js";
import { asError } from "catch-unknown";
import { eq, isNull, or, type SQL } from "drizzle-orm";
import { Database } from "@/main/database";
import type { Server, ServerInsert } from "@/main/database/types";
import { Container } from "@/main/internal/container";
import { Emitter } from "@/main/internal/emitter";
import { Stateful } from "@/main/internal/stateful";
import { Logger } from "@/main/services/logger";

const CLIENT_IMPLEMENTATION: Implementation = {
  name: "5ire",
  version: "0.0.1",
  title: "5ire",
};

const CLIENT_CAPABILITIES: ClientCapabilities = {};

export class MCPConnectionsManager extends Stateful<MCPConnectionsManager.State> {
  #logger = Container.inject(Logger).scope("MCPServersManager");
  #database = Container.inject(Database);
  #emitter = Emitter.create<MCPConnectionsManager.Events>();

  get emitter() {
    return this.#emitter;
  }

  constructor() {
    super(() => {
      return {
        connections: {},
      };
    });
  }

  async #connect(server: Server) {
    const logger = this.#logger.scope("Connect");

    if (this.state.connections[server.id]?.type !== "error") {
      return;
    }

    logger.debug("Connecting to mcp server:", server);

    const controller = new AbortController();
    const connection: MCPConnectionsManager.Connection = {
      type: "connecting",
      controller,
      promise: Promise.resolve()
        .then(() => {
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

          if (server.transport === "sse") {
            return new SSEClientTransport(url, { requestInit });
          } else {
            return new StreamableHTTPClientTransport(url, { requestInit });
          }
        })
        .then(async (transport) => {
          const client = new Client(CLIENT_IMPLEMENTATION, { capabilities: CLIENT_CAPABILITIES });

          let connectError: unknown;

          for (let retries = 0; retries < 3; retries++) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * retries));

            try {
              const capabilities = await client.connect(transport, {}).then(() => {
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
                type: "connected",
                client,
                capabilities,
                projectId: server.projectId || undefined,
              } satisfies MCPConnectionsManager.Connection;

              this.update((draft) => {
                draft.connections[server.id] = connected;
              });
              this.emitter.emit("server-connected", {
                id: server.id,
                connection: connected,
              });
            } catch (e) {
              if (controller.signal.aborted) {
                return;
              }

              connectError = e;
            }
          }

          logger.capture(connectError, {
            reason: "Failed to connect to mcp server",
          });

          this.update((draft) => {
            draft.connections[server.id] = {
              type: "error",
              error: asError(connectError).message,
            };
          });
        }),
    };

    this.update((draft) => {
      draft.connections[server.id] = connection;
    });

    controller.signal.addEventListener("abort", () => {
      this.update((draft) => {
        delete draft.connections[server.id];
      });
    });
  }

  async init() {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const logger = this.#logger.scope("Init");

    await client
      .select()
      .from(schema.server)
      .where(eq(schema.server.active, true))
      .execute()
      .then((servers) => {
        logger.info(`Connecting to ${servers.length} mcp servers`);

        return Promise.all(servers.map((server) => this.#connect(server).catch(() => {})));
      });
  }

  async createServer(options: MCPConnectionsManager.CreateServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    if (options.transport !== "stdio") {
      try {
        new URL(options.endpoint);
      } catch {
        throw new Error("Invalid remote server url");
      }
    }

    const data: ServerInsert = options;

    await client
      .insert(schema.server)
      .values(data)
      .returning()
      .execute()
      .then(([server]) => {
        return this.#connect(server);
      });
  }

  async updateServer(options: MCPConnectionsManager.UpdateServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    const connection = this.state.connections[options.id];

    if (connection) {
      return;
    }

    await client.update(schema.server).set(options).where(eq(schema.server.id, options.id)).execute();
  }

  async deleteServer(options: MCPConnectionsManager.DeleteServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    const connection = this.state.connections[options.id];

    if (connection) {
      return;
    }

    await client.delete(schema.server).where(eq(schema.server.id, options.id)).execute();
  }

  async activeServer(options: MCPConnectionsManager.ActiveServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    const connection = this.state.connections[options.id];

    if (connection) {
      if (connection.type === "connecting") {
        return connection.promise;
      }
      if (connection.type === "connected") {
        return;
      }
    }

    await client
      .update(schema.server)
      .set({ active: true })
      .where(eq(schema.server.id, options.id))
      .returning()
      .execute()
      .then(([server]) => {
        this.#connect(server);
      });
  }

  async inactiveServer(options: MCPConnectionsManager.InactiveServerOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    const connection = this.state.connections[options.id];

    this.update((draft) => {
      delete draft.connections[options.id];
    });
    this.emitter.emit("server-disconnected", { id: options.id });

    if (connection) {
      if (connection.type === "connecting") {
        connection.controller.abort();
      }

      if (connection.type === "connected") {
        connection.client.close().catch(() => {});
      }
    }

    await client
      .update(schema.server)
      .set({ active: false })
      .where(eq(schema.server.id, options.id))
      .execute()
      .catch(() => {});
  }

  async listConnectedServers() {}

  async listServers(options: MCPConnectionsManager.ListServersOptions) {
    const client = this.#database.client;
    const schema = this.#database.schema;

    let where: SQL | undefined;

    if (options.projectId) {
      where = eq(schema.server.projectId, options.projectId);

      if (options.includeGlobal) {
        where = or(where, isNull(schema.server.projectId));
      }
    }

    return client
      .select()
      .from(schema.server)
      .where(where)
      .then((servers) => {
        return servers.map((server) => {
          const connection = this.state.connections[server.id];

          if (connection) {
            return {
              ...server,
              ...{
                connection,
              },
            };
          }

          return server;
        });
      });
  }
}

export namespace MCPConnectionsManager {
  export type Connection =
    | {
        type: "connected";
        client: Client;
        capabilities: ServerCapabilities;
        projectId?: string;
      }
    | {
        type: "connecting";
        promise: Promise<void>;
        controller: AbortController;
      }
    | {
        type: "error";
        error: string;
      };

  export type State = {
    connections: Record<string, Connection>;
  };

  export type Events = {
    "server-connected": {
      id: string;
      connection: Extract<Connection, { type: "connected" }>;
    };
    "server-disconnected": {
      id: string;
    };
  };

  export type CreateServerOptions = Pick<Server, "label" | "config" | "endpoint" | "transport" | "approvalPolicy"> &
    Pick<ServerInsert, "description" | "projectId">;

  export type UpdateServerOptions = CreateServerOptions & {
    id: string;
  };

  export type DeleteServerOptions = {
    id: string;
  };

  export type ActiveServerOptions = {
    id: string;
  };

  export type InactiveServerOptions = {
    id: string;
  };

  export type ListServersOptions = {
    projectId?: string;
    includeGlobal?: boolean;
  };
}
