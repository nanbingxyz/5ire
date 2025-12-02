import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";
import { MCPContentConverter } from "@/main/services/mcp-content-converter";

export class MCPCompletionHandler {
  #logger = Container.inject(Logger).scope("MCPCompletionHandler");
  #connectionsManager = Container.inject(MCPConnectionsManager);
  #contentConverter = Container.inject(MCPContentConverter);

  async complete(options: MCPCompletionHandler.CompleteOptions) {
    const connection = this.#connectionsManager.getConnectedOrThrow(options.server);

    if (!connection.capabilities.completions) {
      return null;
    }

    return connection.client
      .complete({
        ref:
          options.type === "prompt"
            ? {
                type: "ref/prompt",
                name: options.ref,
              }
            : {
                type: "ref/resource",
                uri: options.ref,
              },
        argument: {
          name: options.argument.name,
          value: options.argument.value,
        },
        context: options.context,
      })
      .then((result) => {
        return {
          values: result.completion.values,
        };
      });
  }

  async completeResourceTemplate() {}
}

export namespace MCPCompletionHandler {
  export type CompleteOptions = {
    type: "prompt" | "resource";
    server: string;
    ref: string;
    argument: {
      name: string;
      value: string;
    };
    context: Record<string, string>;
  };
}
