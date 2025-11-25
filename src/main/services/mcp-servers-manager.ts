import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { ClientCapabilities, Implementation, ServerCapabilities } from "@modelcontextprotocol/sdk/types.js";
import { asError } from "catch-unknown";
import { eq } from "drizzle-orm";
import { Database } from "@/main/database";
import type { Server, ServerApprovalPolicy, ServerInsert, ServerTransport } from "@/main/database/types";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { Logger } from "@/main/services/logger";

const CLIENT_IMPLEMENTATION: Implementation = {
  name: "5ire",
  version: "0.0.1",
  title: "5ire",
};

const CLIENT_CAPABILITIES: ClientCapabilities = {};

export class MCPServersManager extends Stateful<MCPServersManager.State> {
  #environment = Container.inject(Environment);
  #logger = Container.inject(Logger).scope("MCPServersManager");
  #database = Container.inject(Database);

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

    const abort = new AbortController();
    const connection: MCPServersManager.Connection = {
      type: "connecting",
      server,
      abort,
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

              if (abort.signal.aborted) {
                return client.close().catch(() => {});
              }

              this.update((draft) => {
                draft.connections[server.id] = {
                  type: "connected",
                  server,
                  client,
                  capabilities,
                };
              });
            } catch (e) {
              if (abort.signal.aborted) {
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
              server,
              error: asError(connectError).message,
            };
          });
        }),
    };

    this.update((draft) => {
      draft.connections[server.id] = connection;
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

  updateServer() {}

  deleteServer() {}

  activeServer() {}

  inactiveServer() {}

  listConnectedServers() {}

  listServers() {}
}

export namespace MCPServersManager {
  export type Connection =
    | {
        type: "connected";
        server: Server;
        client: Client;
        capabilities: ServerCapabilities;
      }
    | {
        type: "connecting";
        server: Server;
        promise: Promise<void>;
        abort: AbortController;
      }
    | {
        type: "error";
        server: Server;
        error: string;
      };

  export type State = {
    connections: Record<string, Connection>;
  };

  export type CreateServerOptions = Pick<Server, "label" | "config" | "endpoint" | "transport" | "approvalPolicy"> &
    Pick<ServerInsert, "description" | "projectId">;

  export type UpdateServerOptions = CreateServerOptions & {
    id: string;
  };
}
