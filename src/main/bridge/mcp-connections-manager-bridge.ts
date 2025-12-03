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
      const transformConnections = (connections: Map<string, MCPConnectionsManager.Connection>) => {
        const entries = [...connections.entries()].map(([id, connection]) => {
          if (connection.status === "connected") {
            return [
              id,
              {
                status: connection.status,
                capabilities: connection.capabilities,
                projectId: connection.projectId,
              },
            ];
          }

          if (connection.status === "connecting") {
            return [
              id,
              {
                status: connection.status,
              },
            ];
          }

          return [
            id,
            {
              status: connection.status,
              error: connection.error,
            },
          ];
        });

        return Object.fromEntries(entries);
      };

      return connectionsManager.createStream((state) => {
        return transformConnections(state.connections);
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
