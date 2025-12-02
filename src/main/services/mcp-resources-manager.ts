import { UriTemplate } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import {
  type BlobResourceContents,
  type Resource,
  ResourceListChangedNotificationSchema,
  type ResourceTemplate,
  type TextResourceContents,
} from "@modelcontextprotocol/sdk/types.js";
import { asError } from "catch-unknown";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { Logger } from "@/main/services/logger";
import { MCPConnectionsManager } from "@/main/services/mcp-connections-manager";
import { MCPContentConverter } from "@/main/services/mcp-content-converter";
import { URLParser } from "@/main/services/url-parser";

const MAX_RESOURCES_PAGE = 20;
const MAX_RESOURCE_TEMPLATES_PAGE = 4;

export class MCPResourcesManager extends Stateful<MCPResourcesManager.State> {
  #logger = Container.inject(Logger).scope("MCPResourcesManager");
  #connectionsManager = Container.inject(MCPConnectionsManager);
  #contentConverter = Container.inject(MCPContentConverter);
  #urlParser = Container.inject(URLParser);

  #fetchResources(id: string, connection: Extract<MCPConnectionsManager.Connection, { status: "connected" }>) {
    const logger = this.#logger.scope("FetchResources");
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

        const resources: Resource[] = [];

        while (true) {
          abortController.signal.throwIfAborted();

          if (page > MAX_RESOURCES_PAGE) {
            logger.error(`Too many resource pages (${page}), stopping fetch with ${resources.length} resources loaded`);
            break;
          }

          const result = await connection.client.listResources(
            {
              cursor,
            },
            {
              signal: abortController.signal,
            },
          );

          resources.push(...result.resources);

          if (!result.nextCursor) {
            break;
          }

          cursor = result.nextCursor;
          page++;
        }

        return resources;
      })
      .then(async (resources) => {
        let page = 0;
        let cursor: string | undefined;

        const resourceTemplates: Array<ResourceTemplate & { variableNames: string[] }> = [];

        while (true) {
          abortController.signal.throwIfAborted();

          if (page > MAX_RESOURCE_TEMPLATES_PAGE) {
            logger.error(
              `Too many resource template pages (${page}), stopping fetch with ${resourceTemplates.length} resource templates loaded`,
            );
            break;
          }

          const result = await connection.client.listResourceTemplates(
            {
              cursor,
            },
            {
              signal: abortController.signal,
            },
          );

          for (const resourceTemplate of result.resourceTemplates) {
            if (!UriTemplate.isTemplate(resourceTemplate.uriTemplate)) {
              logger.error(`Invalid resource template: ${resourceTemplate.uriTemplate}`);
              continue;
            }

            resourceTemplates.push({
              ...resourceTemplate,
              ...{
                variableNames: new UriTemplate(resourceTemplate.uriTemplate).variableNames,
              },
            });
          }

          if (!result.nextCursor) {
            break;
          }

          cursor = result.nextCursor;
          page++;
        }

        return { resources, resourceTemplates };
      })
      .then(({ resources, resourceTemplates }) => {
        this.update((draft) => {
          if (draft.bundles.get(id)) {
            draft.bundles.set(id, {
              status: "loaded",
              resources,
              resourceTemplates,
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

  constructor() {
    super(() => {
      return {
        bundles: new Map(),
      };
    });

    this.#connectionsManager.emitter.on("server-connected", ({ id, connection }) => {
      if (!connection.capabilities.resources) {
        return;
      }

      if (connection.capabilities.resources.listChanged) {
        connection.client.setNotificationHandler(ResourceListChangedNotificationSchema, () => {
          this.#fetchResources(id, connection);
        });
      }

      this.#fetchResources(id, connection);
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

  async readResource(options: MCPResourcesManager.ReadResourceOptions) {
    const url = this.#urlParser.parse(options.uri);

    if (url?.type !== "external") {
      throw new Error("This resource cannot be accessed.");
    }

    return this.#connectionsManager
      .getConnectedOrThrow(url.server)
      .client.readResource({ uri: url.origin })
      .then((result) => {
        return this.#contentConverter.convertResourceContent(
          result.content as TextResourceContents | BlobResourceContents,
          url.server,
          url.origin,
        );
      });
  }
}

export namespace MCPResourcesManager {
  export type ResourcesBundle =
    | {
        status: "loaded";
        resources: Resource[];
        resourceTemplates: Array<ResourceTemplate & { variableNames: string[] }>;
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
    bundles: Map<string, ResourcesBundle>;
  };

  export type ReadResourceOptions = {
    uri: string;
  };
}
