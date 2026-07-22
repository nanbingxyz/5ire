import { basename, resolve } from "node:path";
import { app } from "electron";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { Logger } from "@/main/services/logger";

/**
 * Allowlist of commands permitted when an MCP server config is delivered via a
 * deep link (e.g. `5ire://install-server/#<base64>`). Deep links may originate
 * from arbitrary web pages or emails and are therefore treated as untrusted
 * input. Restricting the executable to a small, well-known set of package
 * runners prevents a malicious link from silently proposing an arbitrary
 * binary (e.g. `sh`, `powershell`, `rm`) to the user.
 *
 * Users can still configure any command manually inside the app — this
 * restriction only applies to configs sourced from deep links.
 */
const DEEP_LINK_ALLOWED_COMMANDS = new Set<string>([
  "npx",
  "npx.cmd",
  "node",
  "node.exe",
  "python",
  "python3",
  "python.exe",
  "python3.exe",
  "uv",
  "uv.exe",
  "uvx",
  "uvx.exe",
  "bun",
  "bunx",
  "deno",
]);

/**
 * Args that clearly re-introduce arbitrary command execution even when the
 * outer command is on the allowlist (e.g. `node -e '<code>'`).
 */
const DEEP_LINK_FORBIDDEN_ARG_PATTERNS: RegExp[] = [
  /^-e$/i, // node -e / python -e / deno -e
  /^--eval(=.*)?$/i,
  /^-c$/i, // python -c / sh -c
  /^--command(=.*)?$/i,
];

const isSafeCommand = (command: unknown): command is string => {
  if (typeof command !== "string" || command.length === 0) {
    return false;
  }
  // Reject shell metacharacters outright — a legitimate runner name never
  // contains these, and their presence indicates an attempt to break out via
  // the endpoint parser used downstream.
  if (/[;&|`$<>\n\r"'\\]/.test(command)) {
    return false;
  }
  // Normalize to the basename so an attacker can't smuggle an absolute path
  // like `/usr/bin/sh` that isn't in the allowlist as-is.
  const base = basename(command).toLowerCase();
  return DEEP_LINK_ALLOWED_COMMANDS.has(base);
};

const areSafeArgs = (args: unknown): args is string[] => {
  if (args === undefined || args === null) {
    return true;
  }
  if (!Array.isArray(args)) {
    return false;
  }
  for (const arg of args) {
    if (typeof arg !== "string") {
      return false;
    }
    for (const pattern of DEEP_LINK_FORBIDDEN_ARG_PATTERNS) {
      if (pattern.test(arg)) {
        return false;
      }
    }
  }
  return true;
};

/**
 * Validates an MCP server config that originated from an untrusted deep link.
 * Returns true only when the config either (a) describes a remote HTTP(S)
 * endpoint, or (b) describes a local command from a small allowlist of
 * package runners with no obviously-dangerous args.
 */
const isSafeDeepLinkServerConfig = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const cfg = value as Record<string, unknown>;

  // Remote server: only allow http(s) URLs.
  if (typeof cfg.url === "string") {
    try {
      const parsed = new URL(cfg.url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  // Local server: enforce command allowlist and arg pattern checks.
  if ("command" in cfg) {
    return isSafeCommand(cfg.command) && areSafeArgs(cfg.args);
  }

  return false;
};

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

      // Deep links are attacker-controllable (a malicious web page can trigger
      // `5ire://install-server/#<base64>`). Reject configs whose executable is
      // not on the allowlist of package runners, or whose args re-introduce
      // arbitrary code execution (e.g. `node -e`). Without this check, the
      // install dialog would offer to run anything the attacker chose the
      // moment the user clicks "install".
      if (!isSafeDeepLinkServerConfig(json)) {
        logger.error(`Rejected install-server deep link with unsafe config: ${url}`);
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
