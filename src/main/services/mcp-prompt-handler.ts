import {
  type Prompt,
  PromptListChangedNotificationSchema,
  type PromptMessage,
} from "@modelcontextprotocol/sdk/types.js";
import { asError } from "catch-unknown";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { Logger } from "@/main/services/logger";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";
import { MCPContentConverter } from "@/main/services/mcp-content-converter";

const MAX_PROMPTS_PAGE = 16;

export class MCPPromptHandler extends Stateful<MCPPromptHandler.State> {
  #logger = Container.inject(Logger).scope("MCPPromptHandler");
  #connectionsManager = Container.inject(MCPConnectionsManager);
  #contentConverter = Container.inject(MCPContentConverter);

  #fetchPrompts(id: string, connection: Extract<MCPConnectionsManager.Connection, { status: "connected" }>) {
    const logger = this.#logger.scope("FetchPrompts");
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

        const prompts: Prompt[] = [];

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

          prompts.push(...result.prompts);

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
          if (draft.bundles.get(id)) {
            draft.bundles.set(id, {
              status: "loaded",
              prompts,
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
  }

  async getPrompt(options: MCPPromptHandler.GetPromptOptions) {
    return this.#connectionsManager
      .getConnectedOrThrow(options.connectionId)
      .client.getPrompt({ name: options.name, arguments: options.arguments })
      .then((result) => {
        return {
          description: result.description,
          messages: result.messages.map((message) => {
            let content = this.#contentConverter.convert(message.content, options.connectionId);

            if (content.type === "text" && !content.text.trim()) {
              content = {
                type: "text",
                text: "null",
                format: "json",
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
        bundles: new Map(),
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

export namespace MCPPromptHandler {
  export type PromptBundle =
    | {
        status: "loaded";
        prompts: Prompt[];
      }
    | {
        status: "loading";
        promise: Promise<void>;
        abortController: AbortController;
      }
    | {
        status: "error";
        message: string;
      };

  export type State = {
    bundles: Map<string, PromptBundle>;
  };

  export type GetPromptOptions = {
    connectionId: string;
    name: string;
    arguments?: Record<string, string>;
  };
}
