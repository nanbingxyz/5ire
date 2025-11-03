import { asError } from "catch-unknown";
import { default as logger } from "electron-log";

/**
 * Logger class is used to handle application log recording functions
 * Provides log output and error capture functions at different levels
 */
export class Logger {
  #scope = "";

  /**
   * Record info level logs
   * @param args Log content parameters
   */
  info(...args: unknown[]) {
    logger.info(`[${this.#scope}]`, ...args);
  }

  /**
   * Record debug level logs
   * @param args Log content parameters
   */
  debug(...args: unknown[]) {
    logger.debug(`[${this.#scope}]`, ...args);
  }

  /**
   * Record warning level logs
   * @param args Log content parameters
   */
  warning(...args: unknown[]) {
    logger.warn(`[${this.#scope}]`, ...args);
  }

  /**
   * Record error level logs
   * @param args Log content parameters
   */
  error(...args: unknown[]) {
    logger.error(`[${this.#scope}]`, ...args);
  }

  /**
   * Record silly level logs (most detailed log level)
   * @param args Log content parameters
   */
  silly(...args: unknown[]) {
    logger.silly(`[${this.#scope}]`, ...args);
  }

  /**
   * Record verbose level logs (detailed log level)
   * @param args Log content parameters
   */
  verbose(...args: unknown[]) {
    logger.verbose(`[${this.#scope}]`, ...args);
  }

  /**
   * Capture and record error information
   * @param error Error object
   * @param message Error description message
   * @param options Capture options, can specify log level
   */
  capture(error: unknown, message: string, options?: Logger.CaptureOptions) {
    const level = options?.level || "error";

    if (level === "error") {
      this.error(message, asError(error));
    } else {
      this.warning(message, asError(error));
    }

    // TODO: Add error reporting logic
  }

  /**
   * Create a new Logger instance with the specified scope
   * @param scope Scope name
   * @returns New Logger instance
   */
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
  /**
   * Error capture options
   * Defines configuration parameters for capturing errors
   */
  export type CaptureOptions = {
    /**
     * Log level
     * Optional values are "error" or "warning", default is "error"
     */
    level?: "error" | "warning";
  };
}
