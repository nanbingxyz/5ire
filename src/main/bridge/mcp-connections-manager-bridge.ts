import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";

export class MCPConnectionsManagerBridge extends Bridge.define("mcp-connections-manager", () => {
  const service = Container.inject(MCPConnectionsManager);

  return {
    createServer: service.createServer.bind(service),
    deleteServer: service.deleteServer.bind(service),
    updateServer: service.updateServer.bind(service),
    activeServer: service.activeServer.bind(service),
    inactiveServer: service.inactiveServer.bind(service),
    createConnectionsStateStream: () => {
      const transformConnections = (connections: Record<string, MCPConnectionsManager.Connection>) => {
        const entries = Object.entries(connections).map(([id, connection]) => {
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

          return [id, connection];
        });

        return Object.fromEntries(entries);
      };

      return service.createStream((state) => {
        return transformConnections(state.connections);
      });
    },
  };
}) {}
