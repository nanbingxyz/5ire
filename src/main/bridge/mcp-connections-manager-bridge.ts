import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";
import { MCPPromptsManager } from "@/main/services/mcp-prompts-manager";
import { MCPResourcesManager } from "@/main/services/mcp-resources-manager";
import { MCPToolsManager } from "@/main/services/mcp-tools-manager";

export class MCPConnectionsManagerBridge extends Bridge.define("mcp-connections-manager", () => {
  const connectionsManager = Container.inject(MCPConnectionsManager);
  const toolManager = Container.inject(MCPToolsManager);
  const promptManager = Container.inject(MCPPromptsManager);
  const resourceManager = Container.inject(MCPResourcesManager);

  return {
    createStateStream: () => {
      const transformConnection = (connection: MCPConnectionsManager.Connection) => {
        if (connection.status === "connected") {
          return {
            status: connection.status,
            capabilities: connection.capabilities,
            projectId: connection.projectId,
          } as const;
        }

        if (connection.status === "connecting") {
          return {
            status: connection.status,
          } as const;
        }

        return {
          status: connection.status,
          error: connection.error,
        } as const;
      };

      return connectionsManager.createStream((state) => {
        const r: Record<string, ReturnType<typeof transformConnection>> = {};

        for (const [k, c] of state.connections.entries()) {
          r[k] = transformConnection(c);
        }

        return r;
      });
    },

    tool: {
      call: toolManager.call.bind(toolManager),
      createStateStream: () => {
        const transformCollection = (collection: MCPToolsManager.ToolCollection) => {
          if (collection.status === "loading") {
            return {
              status: collection.status,
            } as const;
          }

          return collection;
        };

        return toolManager.createStream((state) => {
          const r: Record<string, ReturnType<typeof transformCollection>> = {};

          for (const [k, c] of state.collections.entries()) {
            r[k] = transformCollection(c);
          }

          return r;
        });
      },
    },

    prompt: {
      get: promptManager.get.bind(promptManager),
      createStateStream: () => {
        const transformCollection = (collection: MCPPromptsManager.PromptCollection) => {
          if (collection.status === "loading") {
            return {
              status: collection.status,
            } as const;
          }

          return collection;
        };

        return promptManager.createStream((state) => {
          const r: Record<string, ReturnType<typeof transformCollection>> = {};

          for (const [k, c] of state.collections.entries()) {
            r[k] = transformCollection(c);
          }

          return r;
        });
      },
    },

    resource: {
      read: resourceManager.read.bind(resourceManager),
      createStateStream: () => {
        const transformCollection = (collection: MCPResourcesManager.ResourceCollection) => {
          if (collection.status === "loading") {
            return {
              status: collection.status,
            } as const;
          }

          return collection;
        };

        return resourceManager.createStream((state) => {
          const r: Record<string, ReturnType<typeof transformCollection>> = {};

          for (const [k, c] of state.collections.entries()) {
            r[k] = transformCollection(c);
          }

          return r;
        });
      },
    },
  };
}) {}
