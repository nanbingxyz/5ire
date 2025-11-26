import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";

export class MCPToolHandler {
  #logger = Container.inject(Logger).scope("MCPToolHandler");
  #connectionsManager = Container.inject(MCPConnectionsManager);

  #toolListRequestCache = new Map<string, Promise<Tool[]>>();

  #handleConnectionsUpdated(connections: Record<string, MCPConnectionsManager.Connection>) {
    const toolListRequestCache = new Map<string, Promise<Tool[]>>();

    for (const [id, connection] of Object.entries(connections)) {
      if (connection.type !== "connected") {
        continue;
      }

      const cache = this.#toolListRequestCache.get(id);

      if (cache) {
        toolListRequestCache.set(id, cache);
      }
    }

    this.#toolListRequestCache = toolListRequestCache;

    for (const [id, connection] of Object.entries(connections)) {
      if (connection.type !== "connected") {
        continue;
      }

      // prefetch shared tools
      if (!connection.projectId && !this.#toolListRequestCache.get(id)) {
        this.#fetchToolList(id).catch(() => {});
      }
    }
  }

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

    logger.warning("Invalid tool URL", uri);

    return null;
  }

  async #fetchToolList(connectionId: string) {
    const logger = this.#logger.scope("GetToolList");
    const cache = this.#toolListRequestCache.get(connectionId);

    if (cache) {
      return cache;
    }

    const request = Promise.resolve().then(async () => {
      const connection = this.#connectionsManager.state.connections[connectionId];

      if (!connection || connection.type !== "connected") {
        return [];
      }

      let page = 0;
      let cursor: string | undefined;

      const tools: Tool[] = [];

      while (true) {
        if (page > 10) {
          logger.error("Too many pages");
          break;
        }

        const result = await connection.client.listTools({ cursor });

        for (const tool of result.tools) {
          tools.push(tool);
        }

        if (!result.nextCursor) {
          break;
        }

        cursor = result.nextCursor;
        page++;
      }

      return tools;
    });

    this.#toolListRequestCache.set(connectionId, request);

    return request;
  }

  async listTools(connectionId: string) {
    return this.#fetchToolList(connectionId).then((tools) => {
      return tools.map((tool) => {
        let description = tool.description;

        if (description && description.length > 500) {
          description = `${description.slice(0, 500)}...`;
        }

        return {
          name: tool.name,
          description,
          uri: this.#formatToolURI(connectionId, tool),
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          title: tool.title,
        };
      });
    });
  }

  async callTool(uri: string, input?: Record<string, unknown>) {
    const tool = this.#parseToolURI(uri);

    if (!tool) {
      return null;
    }

    const connection = this.#connectionsManager.state.connections[tool.connectionId];

    if (!connection) {
      return null;
    }

    if (connection.type !== "connected") {
      return null;
    }

    connection.client.callTool({
      name: tool.name,
      arguments: input,
      // progressToken:
    });
  }

  constructor() {
    this.#handleConnectionsUpdated(this.#connectionsManager.state.connections);

    this.#connectionsManager.subscribe(({ connections }) => {
      this.#handleConnectionsUpdated(connections);
    });
  }
}
