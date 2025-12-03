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
      return [
        {
          type: "error",
          message: `Invalid tool uri format. Expected format: "tool:{connection-id}/{tool-name}". The uri must contain a valid connection id (uuid format) and tool name. Please check the uri and ensure it follows the correct pattern.`,
        },
      ] satisfies Part.ToolResult["result"];
    }

    const connection = this.#connectionsManager.state.connections.get(toolURI.connectionId);

    if (!connection) {
      return [
        {
          type: "error",
          message: `Connection not found or disconnected. Please check the connection id in the tool uri and ensure the mcp server is reachable.`,
        },
      ] satisfies Part.ToolResult["result"];
    }

    if (connection.status !== "connected") {
      return [
        {
          type: "error",
          message: `Unable to call tool due to mcp server connection issues. Please verify the connection is active and the server is reachable.`,
        },
      ] satisfies Part.ToolResult["result"];
    }

    // Verify the requested tool is loaded. This check prevents calling unavailable tools,
    // avoiding unnecessary network requests and potential errors.
    if (!this.#loadedTools.find((tool) => tool.uri === options.uri)) {
      return [
        {
          type: "error",
          message: `Tool not found. Please check the tool name in the tool uri and ensure it matches a tool available on the mcp server.`,
        },
      ] satisfies Part.ToolResult["result"];
    }

    const resultParts: Part.ToolResult["result"] = [];

    try {
      const result = await connection.client.callTool({ name: toolURI.name, arguments: options.input });
      const content = (result.content || []) as ContentBlock[];
      const structuredContent = result.structuredContent as Record<string, unknown> | undefined;

      if (structuredContent) {
        resultParts.push({
          type: "text",
          text: `${JSON.stringify(structuredContent)}`,
          format: "json",
        });
      } else {
        for (const block of content) {
          resultParts.push(this.#contentConverter.convert(block, toolURI.connectionId));
        }
      }

      let isEmpty = true;

      for (const part of resultParts) {
        if (part.type === "file" || part.type === "reference" || part.type === "resource") {
          isEmpty = false;
        } else if (part.type === "text" && part.text.trim()) {
          isEmpty = false;
        } else if (part.type === "error" && part.message.trim()) {
          isEmpty = false;
        }
      }

      // When the converted tool call result contains no actual useful content,
      // default to filling with `null` as response to ensure tool call result is never empty text.
      if (isEmpty) {
        resultParts.push({
          type: "text",
          text: `${JSON.stringify({ result: "" })}`,
          format: "json",
        });
      }

      // When isError is true, the MCP server might still return content that appears successful.
      // However, since the tool execution encountered an internal error, we need to ensure
      // that the model understands this tool call was actually unsuccessful.
      // This comment explains why we're adding an explicit error message in this case.
      if (result.isError) {
        resultParts.push({
          type: "text",
          text: "<tip>The tool call itself succeeded (the tool was found and executed), but the tool's returned result indicates an internal error. This is not a protocol-level failure, but a tool-level business error, and the operation should be considered unsuccessful.</tip>",
        });
      }

      return resultParts;
    } catch (e) {
      return [
        {
          type: "error",
          message: `Error calling tool: ${asError(e).message}`,
        },
      ] satisfies Part.ToolResult["result"];
    }
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
  };
}
