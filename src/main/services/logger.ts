import { asError } from "catch-unknown";
import { default as logger } from "electron-log";

export class Logger {
  #scope = "";

  info(...args: unknown[]) {
    logger.info(`[${this.#scope}]`, ...args);
  }

  debug(...args: unknown[]) {
    logger.debug(`[${this.#scope}]`, ...args);
  }

  warning(...args: unknown[]) {
    logger.warn(`[${this.#scope}]`, ...args);
  }

  error(...args: unknown[]) {
    logger.error(`[${this.#scope}]`, ...args);
  }

  silly(...args: unknown[]) {
    logger.silly(`[${this.#scope}]`, ...args);
  }

  verbose(...args: unknown[]) {
    logger.verbose(`[${this.#scope}]`, ...args);
  }

  capture(error: unknown, message: string, options?: Logger.CaptureOptions) {
    const level = options?.level || "error";

    if (level === "error") {
      this.error(message, asError(error));
    } else {
      this.warning(message, asError(error));
    }
  }

  scope(scope: string) {
    const instance = new Logger();

    if (this.#scope) {
      instance.#scope = `${this.#scope}:${scope}`;
    } else {
      instance.#scope = scope;
    }

    return instance;
  }
}

export namespace Logger {
  export type CaptureOptions = {
    level?: "error" | "warning";
  };
}
