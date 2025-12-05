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
          };
        }

        if (connection.status === "connecting") {
          return {
            status: connection.status,
          };
        }

        return {
          status: connection.status,
          error: connection.error,
        };
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
        const transformCollections = (collections: Map<string, MCPToolsManager.ToolCollection>) => {
          const entries = [...collections.entries()].map(([id, collection]) => {
            if (collection.status === "loading") {
              return [
                id,
                {
                  status: collection.status,
                },
              ];
            }

            return [id, collection];
          });

          return Object.fromEntries(entries);
        };

        return toolManager.createStream((state) => {
          return transformCollections(state.collections);
        });
      },
    },

    prompt: {
      get: promptManager.get.bind(promptManager),
      createStateStream: () => {
        const transformCollections = (collections: Map<string, MCPPromptsManager.PromptCollection>) => {
          const entries = [...collections.entries()].map(([id, collection]) => {
            if (collection.status === "loading") {
              return [
                id,
                {
                  status: collection.status,
                },
              ];
            }

            return [id, collection];
          });

          return Object.fromEntries(entries);
        };

        return promptManager.createStream((state) => {
          return transformCollections(state.collections);
        });
      },
    },

    resource: {
      read: resourceManager.read.bind(resourceManager),
      createStateStream: () => {
        const transformCollections = (collections: Map<string, MCPResourcesManager.ResourceCollection>) => {
          const entries = [...collections.entries()].map(([id, collection]) => {
            if (collection.status === "loading") {
              return [
                id,
                {
                  status: collection.status,
                },
              ];
            }

            return [id, collection];
          });

          return Object.fromEntries(entries);
        };

        return resourceManager.createStream((state) => {
          return transformCollections(state.collections);
        });
      },
    },
  };
}) {}
