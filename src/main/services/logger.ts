import { join } from "node:path";
import { Axiom } from "@axiomhq/js";
import { captureException, captureMessage, init } from "@sentry/electron/main";
import { asError } from "catch-unknown";
import { default as logger } from "electron-log";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";

const LOGGER_INITIALIZED = false;
let SENTRY_INITIALIZED = false;
let AXIOM_INITIALIZED = false;
let AXIOM_INSTANCE = null as Axiom | null;

/**
 * Logger class is used to handle application log recording functions
 * Provides log output and error capture functions at different levels
 */
export class Logger {
  #scope = "";
  #environment = Container.inject(Environment);

  constructor() {
    if (!LOGGER_INITIALIZED) {
      logger.transports.file.level = "info";
      logger.transports.file.format = "[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";
      logger.transports.file.resolvePath = () => {
        const date = new Date();
        const name = [date.getFullYear(), `0${date.getMonth() + 1}`.slice(-2), `0${date.getDate()}`.slice(-2)].join(
          "-",
        );

        return join(this.#environment.logsFolder, `${name}.log`);
      };
      logger.transports.file.maxSize = Infinity;

      logger.transports.console.useStyles = true;
    }

    if (!SENTRY_INITIALIZED && this.#environment.mode === "production" && this.#environment.sentryDsn) {
      init({
        dsn: this.#environment.sentryDsn,
      });
      SENTRY_INITIALIZED = true;
    }

    if (
      !AXIOM_INITIALIZED &&
      this.#environment.mode === "production" &&
      this.#environment.axiomToken &&
      this.#environment.axiomOrgId
    ) {
      try {
        AXIOM_INSTANCE = new Axiom({
          token: this.#environment.axiomToken,
          orgId: this.#environment.axiomOrgId,
        });
      } catch (e) {
        this.capture(e, { reason: "Failed to initialize Axiom" });
      }
      AXIOM_INITIALIZED = true;
    }
  }

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
   * @param options Capture options, can specify log level
   */
  capture(error: unknown, options?: Logger.CaptureOptions) {
    const level = options?.level || "error";

    if (SENTRY_INITIALIZED) {
      if (level === "error") {
        captureMessage(asError(error).message, {
          extra: {
            scope: this.#scope,
            reason: options?.reason,
            level: level,
          },
        });
      } else {
        captureException(asError(error), {
          extra: {
            scope: this.#scope,
            reason: options?.reason,
            level: level,
          },
        });
      }
    }

    this[level].bind(this)(options?.reason || "", asError(error));
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

  /**
   * Track analytics events
   * @param options Tracking options including event name and properties
   */
  track(options: Logger.TrackOptions) {
    if (AXIOM_INSTANCE) {
      AXIOM_INSTANCE.ingest("5ire", [
        {
          ...options,
          ...{
            timestamp: new Date().toISOString(),
            // legacy
            app: options.event,
          },
        },
      ]);
    }
  }

  /**
   * Flush pending analytics events
   * Ensures all queued events are sent to the analytics service
   */
  flush() {
    AXIOM_INSTANCE?.flush().catch((e) => {
      this.capture(e, { reason: "Failed to flush Axiom" });
    });
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
    /**
     * Error reason
     * Optional, used to provide additional information about the error
     */
    reason?: string;
  };

  /**
   * Analytics event
   */
  export type TrackOptions = {
    /**
     * Event name
     */
    event: string;
    /**
     * Event properties
     */
    properties?: Record<string, string>;
  };
}
