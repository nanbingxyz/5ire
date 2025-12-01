import { type ContentBlock, type Tool, ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { asError } from "catch-unknown";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import type { Part } from "@/main/model/content-specification";
import { Logger } from "@/main/services/logger";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";
import { MCPContentConverter } from "@/main/services/mcp-content-converter";

export class MCPToolHandler extends Stateful<MCPToolHandler.State> {
  #logger = Container.inject(Logger).scope("MCPToolHandler");
  #connectionsManager = Container.inject(MCPConnectionsManager);
  #contentConverter = Container.inject(MCPContentConverter);

  #formatToolURI(connectionId: string, tool: Tool) {
    return `tool:${connectionId}/${encodeURIComponent(tool.name)}`;
  }

  #parseToolURI(uri: string) {
    const logger = this.#logger.scope("ParseToolURL");

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

  async callTool(uri: string, input?: Record<string, unknown>) {
    const tool = this.#parseToolURI(uri);

    if (!tool) {
      return [
        {
          type: "error",
          message: `Invalid tool uri format. Expected format: "tool:{connection-id}/{tool-name}". The uri must contain a valid connection id (uuid format) and tool name. Please check the uri and ensure it follows the correct pattern.`,
        },
      ] satisfies Part.ToolResult["result"];
    }

    const connection = this.#connectionsManager.state.connections[tool.connectionId];

    if (!connection) {
      return [
        {
          type: "error",
          message: `Connection not found or disconnected. Please check the connection id in the tool uri and ensure the mcp server is reachable.`,
        },
      ] satisfies Part.ToolResult["result"];
    }

    if (connection.type !== "connected") {
      return [
        {
          type: "error",
          message: `Unable to call tool due to mcp server connection issues. Please verify the connection is active and the server is reachable.`,
        },
      ] satisfies Part.ToolResult["result"];
    }

    const resultParts: Part.ToolResult["result"] = [];

    try {
      const result = await connection.client.callTool({ name: tool.name, arguments: input });
      const content = (result.content || []) as ContentBlock[];
      const structuredContent = result.structuredContent as Record<string, unknown> | undefined;

      if (structuredContent) {
        resultParts.push({
          type: "text",
          text: `${JSON.stringify(structuredContent, null, 2)}`,
          format: "json",
        });
      } else {
        for (const block of content) {
          resultParts.push(this.#contentConverter.convert(block, tool.connectionId));
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
          text: "null",
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
        bundles: new Map(),
      };
    });

    this.#connectionsManager.emitter.on("server-connected", ({ id, connection }) => {
      if (!connection.capabilities.tools) {
        return;
      }

      const fetchToolList = () => {
        const logger = this.#logger.scope("FetchToolList");
        const bundle = this.state.bundles.get(id);

        if (!bundle) {
          return logger.warning("Bundle not found");
        }

        if (bundle.status === "loading") {
          bundle.abortController.abort();
        }

        const abortController = new AbortController();
        const promise = Promise.resolve()
          .then(async () => {
            let page = 0;
            let cursor: string | undefined;

            const tools: Tool[] = [];

            while (true) {
              abortController.signal.throwIfAborted();

              if (page > 10) {
                logger.error("Too many pages");
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

              tools.push(...result.tools);

              if (!result.nextCursor) {
                break;
              }

              cursor = result.nextCursor;
              page++;
            }

            return tools;
          })
          .then((tools) => {
            return tools.map((tool) => {
              return {
                ...tool,
                ...{
                  uri: this.#formatToolURI(id, tool),
                },
              };
            });
          })
          .then((tools) => {
            this.update((draft) => {
              if (draft.bundles.get(id)) {
                draft.bundles.set(id, {
                  status: "loaded",
                  tools,
                });
              }
            });
          })
          .catch((e) => {
            if (!abortController.signal.aborted) {
              this.update((draft) => {
                if (draft.bundles.get(id)) {
                  draft.bundles.set(id, {
                    status: "error",
                    message: asError(e).message,
                  });
                }
              });
            }
          });

        this.update((draft) => {
          draft.bundles.set(id, {
            status: "loading",
            promise,
            abortController,
          });
        });
      };

      this.update((draft) => {
        draft.bundles.set(id, {
          status: "loaded",
          tools: [],
        });
      });

      if (connection.capabilities.tools.listChanged) {
        connection.client.setNotificationHandler(ToolListChangedNotificationSchema, fetchToolList);
      }

      fetchToolList();
    });
    this.#connectionsManager.emitter.on("server-disconnected", ({ id }) => {
      const bundle = this.state.bundles.get(id);

      if (bundle?.status === "loading") {
        bundle.abortController.abort();
      }

      this.update((draft) => {
        draft.bundles.delete(id);
      });
    });
  }
}

export namespace MCPToolHandler {
  export type ToolBundle =
    | {
        /**
         * The tool bundle is loaded.
         */
        status: "loaded";
        /**
         * The tools in the bundle.
         */
        tools: Array<Tool & { uri: string }>;
      }
    | {
        /**
         * The tool bundle is loading.
         */
        status: "loading";
        /**
         * The promise that resolves when the tool bundle is loaded.
         */
        promise: Promise<void>;
        /**
         * The abort controller that can be used to cancel the tool bundle load.
         */
        abortController: AbortController;
      }
    | {
        /**
         * The tool bundle is in an error state.
         */
        status: "error";
        /**
         * The error message.
         */
        message: string;
      };

  export type State = {
    /**
     * The tool bundles. The key is the server ID.
     */
    bundles: Map<string, ToolBundle>;
  };
}
