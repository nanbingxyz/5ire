import * as Sentry from '@sentry/electron/main';
import log from 'electron-log';

/**
 * Initializes Sentry error tracking if DSN is configured and not in development mode.
 */
export function init() {
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'development') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
    });
  }
}

/**
 * Logs an error and sends it to Sentry if configured.
 * @param {Error | string} error - The error to capture and log
 */
export function captureException(error: Error | string) {
  log.error(error);
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'development') {
    Sentry.captureException(error);
  }
}

/**
 * Logs a warning and sends it to Sentry as a warning message if configured.
 * @param {any} warning - The warning message to capture and log
 */
export function captureWarning(warning: any) {
  log.warn(warning);
  if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'development') {
    Sentry.captureMessage(warning, 'warning');
  }
}

/**
 * Logs debug messages to the console.
 * @param {...any[]} messages - The debug messages to log
 */
export function debug(...messages: any[]) {
  log.debug(messages);
}

/**
 * Logs informational messages to the console.
 * @param {...any[]} messages - The informational messages to log
 */
export function info(...messages: any[]) {
  log.info(...messages);
}

/**
 * Logs warning messages to the console.
 * @param {...any[]} messages - The warning messages to log
 */
export function warn(...messages: any[]) {
  log.warn(...messages);
}

/**
 * Logs error messages to the console.
 * @param {...any[]} messages - The error messages to log
 */
export function error(...messages: any[]) {
  log.error(...messages);
}
