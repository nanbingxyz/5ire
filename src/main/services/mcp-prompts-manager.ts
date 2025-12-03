import { type Prompt, PromptListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { asError } from "catch-unknown";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { Logger } from "@/main/services/logger";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";
import { MCPContentConverter } from "@/main/services/mcp-content-converter";

/**
 * Maximum number of pages to fetch when retrieving prompts from an MCP server.
 */
const MAX_PROMPTS_PAGE = 16;

/**
 * Manage prompts from Model Context Protocol (MCP) servers.
 *
 * This class manages the retrieval, storage, and processing of prompts from MCP connections.
 * It maintains collections of prompts for each connected server and provides methods to
 * fetch and retrieve prompt content with proper formatting and error handling.
 */
export class MCPPromptsManager extends Stateful<MCPPromptsManager.State> {
  #logger = Container.inject(Logger).scope("MCPPromptManager");
  #connectionsManager = Container.inject(MCPConnectionsManager);
  #contentConverter = Container.inject(MCPContentConverter);

  #formatPromptURI(connectionId: string, prompt: Prompt) {
    return `prompt:${connectionId}/${encodeURIComponent(prompt.name)}`;
  }

  #parsePromptURI(uri: string) {
    const logger = this.#logger.scope("ParsePromptURI");

    try {
      const { protocol, hostname, pathname } = new URL(uri);

      if (protocol === "prompt:") {
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

    logger.warning("Invalid prompt URI", uri);

    return null;
  }

  /**
   * Fetches prompts from an MCP server connection and updates the local collection.
   *
   * @param id - The connection ID identifying which MCP server to fetch prompts from
   * @param connection - The active MCP server connection object with client access
   */
  #fetchPrompts(id: string, connection: Extract<MCPConnectionsManager.Connection, { status: "connected" }>) {
    const logger = this.#logger.scope("FetchPrompts");
    const collection = this.state.collections.get(id);

    if (!collection) {
      return logger.warning("Prompt collection not found for ID:", id);
    }

    if (collection.status === "loading") {
      collection.abortController.abort();
    }

    const abortController = new AbortController();
    const promise = Promise.resolve()
      .then(async () => {
        let page = 0;
        let cursor: string | undefined;

        const prompts: MCPPromptsManager.PromptEnhanced[] = [];

        while (true) {
          abortController.signal.throwIfAborted();

          if (page > MAX_PROMPTS_PAGE) {
            logger.error(`Too many prompt pages (${page}), stopping fetch with ${prompts.length} prompts loaded`);
            break;
          }

          const result = await connection.client.listPrompts(
            {
              cursor,
            },
            {
              signal: abortController.signal,
            },
          );

          prompts.push(
            ...result.prompts.map((prompt) => {
              return {
                ...prompt,
                ...{
                  uri: this.#formatPromptURI(id, prompt),
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

        return prompts;
      })
      .then((prompts) => {
        this.update((draft) => {
          if (draft.collections.get(id)) {
            draft.collections.set(id, {
              status: "loaded",
              prompts,
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
   * Gets all loaded prompts from the state.
   */
  get #loadedPrompts() {
    return Array.from(this.state.collections.values())
      .filter((collection) => collection.status === "loaded")
      .flatMap((collection) => collection.prompts);
  }

  /**
   * Retrieves a prompt from an MCP server by its URI and processes its content.
   *
   * This method parses the provided URI to extract the connection ID and prompt name,
   * fetches the prompt from the corresponding MCP server, and converts any structured
   * content into a standardized format.
   *
   * @param options - The options for retrieving a prompt, including the prompt URI and arguments
   */
  async get(options: MCPPromptsManager.GetOptions) {
    const promptURI = this.#parsePromptURI(options.uri);

    if (!promptURI) {
      throw new Error("Invalid prompt uri format.");
    }

    const connection = this.#connectionsManager.getConnectedOrThrow(promptURI.connectionId);

    if (!this.#loadedPrompts.find((prompt) => prompt.uri === options.uri)) {
      throw new Error("Prompt not found.");
    }

    return connection.client.getPrompt({ name: promptURI.name, arguments: options.arguments }).then((result) => {
      return {
        description: result.description,
        messages: result.messages.map((message) => {
          let content = this.#contentConverter.convert(message.content, promptURI.connectionId);

          // Some models or providers may throw errors when receiving messages with empty content
          if (content.type === "text" && !content.text.trim()) {
            content = {
              type: "text",
              text: "<tip>The previous message had empty content.</tip>",
            };
          }

          return {
            role: message.role,
            content,
          };
        }),
      };
    });
  }

  constructor() {
    super(() => {
      return {
        collections: new Map(),
      };
    });

    this.#connectionsManager.emitter.on("server-connected", ({ id, connection }) => {
      if (!connection.capabilities.prompts) {
        return;
      }

      if (connection.capabilities.prompts.listChanged) {
        connection.client.setNotificationHandler(PromptListChangedNotificationSchema, () => {
          this.#fetchPrompts(id, connection);
        });
      }

      this.#fetchPrompts(id, connection);
    });

    // When a server disconnects, we need to cancel any pending prompt collection requests
    // and clean up the associated resources to prevent memory leaks and unnecessary operations.
    this.#connectionsManager.emitter.on("server-disconnected", ({ id }) => {
      const collection = this.state.collections.get(id);

      if (collection?.status === "loading") {
        collection.abortController.abort();
      }

      this.update((draft) => {
        draft.collections.delete(id);
      });
    });
  }
}

export namespace MCPPromptsManager {
  export type PromptEnhanced = Prompt & {
    /**
     * The URI of the prompt.
     */
    uri: string;
  };

  /**
   * Represents a collection of prompts from an MCP server connection.
   */
  export type PromptCollection =
    | {
        /**
         * The prompts from the MCP server are loaded.
         */
        status: "loaded";
        /**
         * The prompts in the collection.
         */
        prompts: PromptEnhanced[];
      }
    | {
        /**
         * The prompts from the MCP server are loading.
         */
        status: "loading";
        /**
         * The promise that resolves when the prompt collection is loaded.
         */
        promise: Promise<void>;
        /**
         * The abort controller that can be used to cancel the prompt collection load.
         */
        abortController: AbortController;
      }
    | {
        /**
         * Failed to load prompts from the MCP server.
         */
        status: "error";
        /**
         * The error message.
         */
        message: string;
      };

  /**
   * The state of the prompt manager service.
   */
  export type State = {
    /**
     * The prompt collections. The key is the server ID.
     */
    collections: Map<string, PromptCollection>;
  };

  /**
   * Options for getting a prompt from an MCP server.
   */
  export type GetOptions = {
    /**
     * The URI of the prompt to get.
     */
    uri: string;
    /**
     * The arguments to pass to the prompt.
     */
    arguments?: Record<string, string>;
  };
}
