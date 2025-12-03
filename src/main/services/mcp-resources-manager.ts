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

/**
 * Maximum number of pages to fetch when retrieving resources from an MCP server.
 */
const MAX_RESOURCES_PAGE = 20;

/**
 * Maximum number of pages to fetch when retrieving resource templates from an MCP server.
 */
const MAX_RESOURCE_TEMPLATES_PAGE = 4;

/**
 * Error code returned by the MCP server when a resource is not found
 */
const RESOURCE_NOT_FOUND_ERROR_CODE = -32002;

/**
 * Manages resources from Model Context Protocol (MCP) servers.
 *
 * This class handles fetching, storing, and reading resources and resource templates
 * from connected MCP servers. It maintains a collection of resources for each
 * server connection and provides methods to access them.
 */
export class MCPResourcesManager extends Stateful<MCPResourcesManager.State> {
  #logger = Container.inject(Logger).scope("MCPResourcesManager");
  #connectionsManager = Container.inject(MCPConnectionsManager);
  #contentConverter = Container.inject(MCPContentConverter);
  #urlParser = Container.inject(URLParser);

  /**
   * Fetches resources and resource templates from an MCP server connection and updates the local collection.
   *
   * @param id - The connection ID
   * @param connection - The active MCP server connection object with client access
   */
  #fetchResources(id: string, connection: Extract<MCPConnectionsManager.Connection, { status: "connected" }>) {
    const logger = this.#logger.scope("FetchResources");
    const bundle = this.state.collections.get(id);

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
          if (draft.collections.get(id)) {
            draft.collections.set(id, {
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

  constructor() {
    super(() => {
      return {
        collections: new Map(),
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
      const bundle = this.state.collections.get(id);

      if (bundle?.status === "loading") {
        bundle.abortController.abort();
      }

      this.update((draft) => {
        draft.collections.delete(id);
      });
    });
  }

  /**
   * Reads a resource from an MCP server connection.
   *
   * @param options - The options for reading a resource
   */
  async read(options: MCPResourcesManager.ReadOptions) {
    const url = this.#urlParser.parse(options.uri);

    if (url?.type !== "external") {
      throw new Error("This resource cannot be accessed.");
    }

    const connection = this.#connectionsManager.getConnectedOrThrow(url.server);

    return connection.client.readResource({ uri: url.origin }).then((result) => {
      return this.#contentConverter.convertResourceContent(
        result.content as TextResourceContents | BlobResourceContents,
        url.server,
        url.origin,
      );
    });
  }

  /**
   * Reads a resource from an MCP server connection safely.
   * Unlike {@link read}, this method returns null instead of throwing an error when the resource is not found.
   *
   * @param options - The options for reading a resource
   */
  async readSafely(options: MCPResourcesManager.ReadOptions) {
    try {
      return await this.read(options);
    } catch (error) {
      // Check if the error is a resource not found error
      if (error instanceof Error && "code" in error && error.code === RESOURCE_NOT_FOUND_ERROR_CODE) {
        return null;
      }
      // Re-throw other errors
      throw error;
    }
  }
}

export namespace MCPResourcesManager {
  /**
   * Represents a collection of resources and resource templates from an MCP server connection.
   */
  export type ResourceCollection =
    | {
        /**
         * The resources and resource templates from the MCP server are loaded.
         */
        status: "loaded";
        /**
         * The resources in the collection.
         */
        resources: Resource[];
        /**
         * The resource templates in the collection.
         */
        resourceTemplates: ResourceTemplate[];
      }
    | {
        /**
         * The prompts from the MCP server are loading.
         */
        status: "loading";
        /**
         * The promise that resolves when the collection is loaded.
         */
        promise: Promise<void>;
        /**
         * The abort controller that can be used to cancel the collection load.
         */
        abortController: AbortController;
      }
    | {
        /**
         * Failed to load resources and resource templates from the MCP server.
         */
        status: "error";
        /**
         * The error message.
         */
        message: string;
      };

  /**
   * The state of the resource manager service.
   */
  export type State = {
    /**
     * The collections of resources and resource templates from MCP server connections.
     */
    collections: Map<string, ResourceCollection>;
  };

  /**
   * Options for reading a resource.
   */
  export type ReadOptions = {
    /**
     * The URI of the resource to read.
     */
    uri: string;
  };
}
