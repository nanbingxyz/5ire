import { type ContentBlock, type Tool, ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { asError } from "catch-unknown";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import type { Part } from "@/main/model/content-specification";
import { Logger } from "@/main/services/logger";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";
import { MCPContentConverter } from "@/main/services/mcp-content-converter";

/**
 * Maximum number of pages to fetch when retrieving tools from an MCP server.
 * This limit prevents infinite loops when fetching paginated tool lists.
 */
const MAX_TOOLS_PAGE = 10;

/**
 * Manage tools from Model Context Protocol (MCP) servers.
 *
 * This class manages the lifecycle of tools provided by MCP server connections,
 * including loading, caching, and executing tools. It maintains collections
 * of tools organized by server connection IDs and provides mechanisms for
 * calling tools with proper error handling.
 */
export class MCPToolsManager extends Stateful<MCPToolsManager.State> {
  #logger = Container.inject(Logger).scope("MCPToolHandler");
  #connectionsManager = Container.inject(MCPConnectionsManager);
  #contentConverter = Container.inject(MCPContentConverter);

  #formatToolURI(connectionId: string, tool: Tool) {
    return `tool:${connectionId}/${encodeURIComponent(tool.name)}`;
  }

  #parseToolURI(uri: string) {
    const logger = this.#logger.scope("ParseToolURI");

    try {
      const { protocol, hostname, pathname } = new URL(uri);

      if (protocol === "tool:") {
        const connectionId = hostname;
        const name = decodeURIComponent(pathname.slice(1));

        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(connectionId) && name) {
          return {
            connectionId,
            name,
          };
        }
      }
    } catch {}

    logger.warning("Invalid tool URI", uri);

    return null;
  }

  /**
   * Fetches tools from an MCP server connection and updates the local collection.
   *
   * @param id - The connection ID identifying which MCP server to fetch tools from
   * @param connection - The active MCP server connection object with client access
   */
  #fetchTools(id: string, connection: Extract<MCPConnectionsManager.Connection, { status: "connected" }>) {
    const logger = this.#logger.scope("FetchTools");
    const collection = this.state.collections.get(id);

    if (!collection) {
      return logger.warning("Tool collection not found for connection ID", id);
    }

    // Abort if the collection is already loading
    if (collection.status === "loading") {
      collection.abortController.abort();
    }

    const abortController = new AbortController();
    const promise = Promise.resolve()
      .then(async () => {
        let page = 0;
        let cursor: string | undefined;

        const tools: MCPToolsManager.ToolEnhanced[] = [];

        while (true) {
          abortController.signal.throwIfAborted();

          if (page > MAX_TOOLS_PAGE) {
            logger.error(`Too many tool pages (${page}), stopping fetch with ${tools.length} tools loaded`);
            break;
          }

          const result = await connection.client.listTools(
            {
              cursor,
            },
            {
              signal: abortController.signal,
            },
          );

          tools.push(
            ...result.tools.map((tool) => {
              return {
                ...tool,
                ...{
                  uri: this.#formatToolURI(id, tool),
                },
              };
            }),
          );

          if (!result.nextCursor) {
            break;
          }

          cursor = result.nextCursor;
          page++;
        }

        return tools;
      })
      .then((tools) => {
        this.update((draft) => {
          if (draft.collections.get(id)) {
            draft.collections.set(id, {
              status: "loaded",
              tools,
            });
          }
        });
      })
      .catch((e) => {
        if (!abortController.signal.aborted) {
          this.update((draft) => {
            if (draft.collections.get(id)) {
              draft.collections.set(id, {
                status: "error",
                message: asError(e).message,
              });
            }
          });
        }
      });

    this.update((draft) => {
      draft.collections.set(id, {
        status: "loading",
        promise,
        abortController,
      });
    });
  }

  /**
   * Gets all loaded tools from the state.
   */
  get #loadedTools() {
    return Array.from(this.state.collections.values())
      .filter((collection) => collection.status === "loaded")
      .flatMap((collection) => collection.tools);
  }

  /**
   * Calls a tool from an MCP server using the provided URI and input parameters.
   *
   * This method executes a tool by parsing the URI to identify the specific
   * MCP server connection and tool name, then sends the tool call request
   * to the appropriate server. The method handles various error conditions
   * including invalid URIs, disconnected servers, and tool execution errors.
   *
   * The URI format must follow: `tool:{connection-id}/{tool-name}`
   *
   * @param options - The options for calling a tool, including the tool URI and input parameters
   */
  async call(options: MCPToolsManager.CallOptions) {
    const toolURI = this.#parseToolURI(options.uri);

    if (!toolURI) {
      return {
        result: [
          {
            type: "text",
            text: `Invalid tool uri format. Expected format: "tool:{connection-id}/{tool-name}". The uri must contain a valid connection id (uuid format) and tool name. Please check the uri and ensure it follows the correct pattern.`,
          },
        ],
        status: "failure",
      } satisfies MCPToolsManager.CallResult;
    }

    const connection = this.#connectionsManager.state.connections.get(toolURI.connectionId);

    if (!connection) {
      return {
        result: [
          {
            type: "text",
            text: `Connection not found or disconnected. Please check the connection id in the tool uri and ensure the mcp server is reachable.`,
          },
        ],
        status: "failure",
      } satisfies MCPToolsManager.CallResult;
    }

    if (connection.status !== "connected") {
      return {
        result: [
          {
            type: "text",
            text: `Unable to call tool due to mcp server connection issues. Please verify the connection is active and the server is reachable.`,
          },
        ],
        status: "failure",
      } satisfies MCPToolsManager.CallResult;
    }

    // Verify the requested tool is loaded. This check prevents calling unavailable tools,
    // avoiding unnecessary network requests and potential errors.
    if (!this.#loadedTools.find((tool) => tool.uri === options.uri)) {
      return {
        result: [
          {
            type: "text",
            text: `Tool not found. Please check the tool name in the tool uri and ensure it matches a tool available on the mcp server.`,
          },
        ],
        status: "failure",
      } satisfies MCPToolsManager.CallResult;
    }

    const resultParts: Part.ToolResult["result"] = [];

    try {
      const result = await connection.client.callTool({ name: toolURI.name, arguments: options.input });
      const content = (result.content || []) as ContentBlock[];
      const structuredContent = result.structuredContent as Record<string, unknown> | undefined;

      for (const block of content) {
        resultParts.push(this.#contentConverter.convert(block, toolURI.connectionId));
      }

      return {
        result: resultParts,
        status: result.isError ? "failure" : "success",
        structuredResult: structuredContent as null | undefined,
      } satisfies MCPToolsManager.CallResult;
    } catch (e) {
      return {
        result: [
          {
            type: "text",
            text: `Error calling tool: ${asError(e).message}`,
          },
        ],
        status: "failure",
      } satisfies MCPToolsManager.CallResult;
    }
  }

  #legacyCallAbortControllers = new Map<string, AbortController>();

  async legacyCall(options: MCPToolsManager.LegacyCallOptions) {
    const controllerId = options.requestId || crypto.randomUUID();
    const controller = new AbortController();

    this.#legacyCallAbortControllers.set(controllerId, controller);

    const connection = this.#connectionsManager.state.connections.get(options.client);

    if (!connection || connection.status !== "connected") {
      return {
        isError: true,
        content: [
          {
            error: `MCP Client ${options.client} not found`,
            code: "client_not_found",
            clientName: options.client,
            toolName: options.name,
          },
        ],
      };
    }

    try {
      const result = await connection.client.callTool(
        {
          name: options.name,
          arguments: options.arguments,
        },
        undefined,
        {
          signal: controller.signal,
        },
      );

      return { isError: false, ...result };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            error: `Error calling tool ${options.name}: ${asError(error).message}`,
            code: "tool_call_error",
            clientName: options.client,
            toolName: options.name,
          },
        ],
      };
    } finally {
      this.#legacyCallAbortControllers.delete(controllerId);
    }
  }

  async legacyCancelCall(options: MCPToolsManager.LegacyCancelCallOptions) {
    this.#legacyCallAbortControllers.get(options.requestId)?.abort();
  }

  async legacyList() {
    const bundles = Array.from(this.state.collections.entries()).map(([id, collection]) => {
      if (collection.status === "loaded") {
        return {
          client: id,
          tools: collection.tools.map((tool) => {
            return {
              ...tool,
              ...{
                name: `${id}--${tool.name}`,
              },
            };
          }),
          error: null,
        };
      }

      if (collection.status === "error") {
        return {
          client: id,
          tools: [],
          error: collection.message,
        };
      }

      return {
        client: id,
        tools: [],
        error: null,
      };
    });

    const tools = bundles.flatMap((r) => r.tools);
    const failedClients = bundles.filter((r) => r.error).map((r) => ({ client: r.client, error: r.error! }));

    return {
      tools,
      error: failedClients.length
        ? {
            message: "Partial failure listing tools",
            code: "partial_failure",
            failedClients,
          }
        : null,
    };
  }

  constructor() {
    super(() => {
      return {
        collections: new Map(),
      };
    });

    this.#connectionsManager.emitter.on("server-connected", ({ id, connection }) => {
      if (!connection.capabilities.tools) {
        return;
      }

      this.update((draft) => {
        draft.collections.set(id, {
          status: "loaded",
          tools: [],
        });
      });

      if (connection.capabilities.tools.listChanged) {
        connection.client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
          this.#fetchTools(id, connection);
        });
      }

      this.#fetchTools(id, connection);
    });

    // When a server disconnects, we need to cancel any pending tool collection requests
    // and clean up the associated resources to prevent memory leaks and unnecessary operations.
    this.#connectionsManager.emitter.on("server-disconnected", ({ id }) => {
      const bundle = this.state.collections.get(id);

      if (bundle?.status === "loading") {
        bundle.abortController.abort();
      }

      this.update((draft) => {
        draft.collections.delete(id);
      });
    });
  }
}

export namespace MCPToolsManager {
  export type ToolEnhanced = Tool & {
    /**
     * The URI of the tool.
     */
    uri: string;
  };

  /**
   * Represents a collection of tools from an MCP server connection.
   */
  export type ToolCollection =
    | {
        /**
         * The tools from the MCP server are loaded.
         */
        status: "loaded";
        /**
         * The tools in the collection.
         */
        tools: Array<ToolEnhanced>;
      }
    | {
        /**
         * The tools from the MCP server are loading.
         */
        status: "loading";
        /**
         * The promise that resolves when the tool collection is loaded.
         */
        promise: Promise<void>;
        /**
         * The abort controller that can be used to cancel the tool collection load.
         */
        abortController: AbortController;
      }
    | {
        /**
         * Failed to load tools from the MCP server.
         */
        status: "error";
        /**
         * The error message.
         */
        message: string;
      };

  /**
   * The state of the tool manager service.
   */
  export type State = {
    /**
     * The tool collections. The key is the server ID.
     */
    collections: Map<string, ToolCollection>;
  };

  /**
   * Options for calling a tool.
   */
  export type CallOptions = {
    /**
     * The tool URI.
     */
    uri: string;
    /**
     * The tool input.
     */
    input?: Record<string, unknown>;
    /**
     * The conversation ID.
     */
    conversationId?: string;
  };

  export type CallResult = Pick<Part.ToolResult, "result" | "structuredResult" | "status">;

  export type LegacyCallOptions = {
    client: string;
    name: string;
    arguments: Record<string, unknown>;
    requestId?: string;
  };

  export type LegacyCancelCallOptions = {
    requestId: string;
  };
}
