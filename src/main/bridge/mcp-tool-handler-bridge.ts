import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { MCPToolHandler } from "@/main/services/mcp-tool-handler";

export class MCPToolHandlerBridge extends Bridge.define("mcp-tool-handler", () => {
  const service = Container.inject(MCPToolHandler);

  return {
    createToolBundlesStateStream() {
      const transformToolBundles = (bundles: Map<string, MCPToolHandler.ToolBundle>) => {
        const entries = Array.from(bundles.entries()).map(([id, bundle]) => {
          if (bundle.status === "loading") {
            return [
              id,
              {
                status: bundle.status,
              },
            ];
          }

          return [id, bundle];
        });

        return Object.fromEntries(entries);
      };

      return service.createStream((state) => {
        return transformToolBundles(state.bundles);
      });
    },
  };
}) {}
