import { Container } from "@/main/internal/container";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";

/**
 * Handles completion requests for MCP (Model Completion Protocol) connections.
 *
 * This class manages the communication with connected MCP servers to retrieve
 * completions for prompts or resources based on provided arguments and context.
 */
export class MCPCompletionHandler {
  #connectionsManager = Container.inject(MCPConnectionsManager);

  /**
   * Complete a prompt or resource argument.
   *
   * @param options - Options for completing a prompt or resource.
   */
  async complete(options: MCPCompletionHandler.CompleteOptions) {
    const connection = this.#connectionsManager.getConnectedOrThrow(options.server);

    if (!connection.capabilities.completions) {
      return [] as string[];
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
        return result.completion.values;
      });
  }
}

export namespace MCPCompletionHandler {
  /**
   * Options for completing a prompt or resource argument.
   */
  export type CompleteOptions = {
    /**
     * Type of completion request. Can be "prompt" or "resource".
     */
    type: "prompt" | "resource";
    /**
     * Server ID to complete against.
     */
    server: string;
    /**
     * Reference to the prompt or resource to complete.
     */
    ref: string;
    /**
     * Argument to complete.
     */
    argument: {
      /**
       * Name of the argument to complete.
       */
      name: string;
      /**
       * Value of the argument to complete.
       */
      value: string;
    };
    /**
     * Context to provide to the completion request.
     */
    context: Record<string, string>;
  };
}
