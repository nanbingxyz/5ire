import { resolve } from "node:path";
import { app } from "electron";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { Logger } from "@/main/services/logger";

/**
 * DeepLinkHandler class handles the deep linking functionality of the application
 * Responsible for parsing and handling different types of deep links such as login callbacks and tool installations
 * @extends Stateful<DeepLinkHandler.State>
 */
export class DeepLinkHandler extends Stateful<DeepLinkHandler.State> {
  #environment = Container.inject(Environment);
  #logger = Container.inject(Logger).scope("DeepLinkHandler");

  /**
   * Creates a DeepLinkHandler instance
   * Initializes the state including the list of unhandled deep links
   */
  constructor() {
    super(() => {
      return {
        unhandledDeepLinks: [],
      };
    });
  }

  /**
   * Handles login callback links
   * Parses login callback URLs containing access token and refresh token
   * @param url Login callback URL object
   */
  #handleLogin(url: URL) {
    const logger = this.#logger.scope("HandleLogin");

    try {
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        logger.debug("Received login callback:", { accessToken, refreshToken });

        return this.update((draft) => {
          draft.unhandledDeepLinks.push({
            id: crypto.randomUUID(),
            link: {
              type: "login",
              accessToken,
              refreshToken,
            },
          });
        });
      } else {
        logger.error(`Invalid login callback: ${url.toString()}`);
      }
    } catch {}

    return this.update((draft) => {
      draft.unhandledDeepLinks.push({
        id: crypto.randomUUID(),
        link: {
          type: "error",
          code: "login",
        },
      });
    });
  }

  /**
   * Handles MCP Server installation links
   * Parses installation links containing MCP Server information
   * @param url MCP Server installation URL object
   */
  #handleInstallServer(url: URL) {
    const logger = this.#logger.scope("HandleInstallServer");

    try {
      const data = url.hash.substring(1);
      const text = Buffer.from(data, "base64").toString("utf-8");
      const json = JSON.parse(text);

      return this.update((draft) => {
        draft.unhandledDeepLinks.push({
          id: crypto.randomUUID(),
          link: {
            type: "install-server",
            server: json,
          },
        });
      });
    } catch (e) {
      logger.error(`Invalid install tool callback: ${url}`, e);

      return this.update((draft) => {
        draft.unhandledDeepLinks.push({
          id: crypto.randomUUID(),
          link: {
            type: "error",
            code: "install-tool",
          },
        });
      });
    }
  }

  /**
   * Sets the application as the default client for the protocol
   * Allows the application to handle links with custom protocols
   */
  setAsDefaultProtocolClient() {
    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(this.#environment.deepLinkProtocol, process.execPath, [
          resolve(process.argv[1]),
        ]);
      }
    } else {
      app.setAsDefaultProtocolClient(this.#environment.deepLinkProtocol);
    }
  }

  /**
   * Parses deep links
   * Routes the link to the appropriate handler function based on link type
   * @param link The deep link string to parse
   */
  parse(link: string) {
    let url: URL;

    try {
      url = new URL(link);
    } catch {
      return this.#logger.error("Invalid deep link:", link);
    }

    if (url.protocol !== `${this.#environment.deepLinkProtocol}:`) {
      return this.#logger.error("Invalid deep link protocol:", link);
    }

    if (url.hostname === "login-callback") {
      this.#handleLogin(url);
    } else if (url.hostname === "install-tool" || url.hostname === "install-server") {
      this.#handleInstallServer(url);
    } else {
      this.#logger.error("Invalid deep link:", link);
    }
  }

  /**
   * Marks a deep link as handled
   * Removes the link with the specified ID from the unhandled links list
   * @param id The ID of the link to mark as handled
   */
  handled(id: string) {
    this.update((draft) => {
      const index = draft.unhandledDeepLinks.findIndex((item) => item.id === id);
      if (index !== -1) {
        draft.unhandledDeepLinks.splice(index, 1);
      }
    });
  }
}

export namespace DeepLinkHandler {
  /**
   * Unhandled deep link type definitions
   * Represents different types of deep links that may be received
   */
  export type UnhandledDeepLink =
    | {
        /**
         * Login type link
         */
        type: "login";
        /**
         * Access token
         */
        accessToken: string;
        /**
         * Refresh token
         */
        refreshToken: string;
      }
    | {
        /**
         * MCP Server installation type link
         */
        type: "install-server";
        /**
         * MCP Server information
         */
        server: unknown;
      }
    | {
        /**
         * Error type link
         */
        type: "error";
        /**
         * Error code
         */
        code: "login" | "install-tool";
      };

  /**
   * Complete state definition for DeepLinkHandler
   * Contains all unhandled deep links
   */
  export type State = {
    /**
     * List of unhandled deep links
     */
    unhandledDeepLinks: { id: string; link: UnhandledDeepLink }[];
  };
}
