import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

/**
 * Coordinates the shutdown process by managing and executing
 * registered shutdown callbacks in a controlled manner.
 *
 * This service allows different parts of the application to register
 * cleanup functions that need to be executed when the application
 * is shutting down, ensuring proper resource cleanup and graceful
 * termination.
 */
export class ShutdownCoordinator {
  #logger = Container.inject(Logger).scope("ShutdownCoordinator");

  #callbacks = new Set<ShutdownCoordinator.Callback>();
  #shutdownInProgress = false;

  /**
   * Get a boolean indicating whether a shutdown operation is currently in progress.
   */
  get shutdownInProgress() {
    return this.#shutdownInProgress;
  }

  /**
   * Throw an error if a shutdown operation is already in progress.
   */
  throwIfShutdownInProgress() {
    if (this.#shutdownInProgress) {
      throw new Error("Shutdown in progress. Operation not allowed during shutdown sequence.");
    }
  }

  /**
   * Register a callback to be executed during the shutdown process.
   *
   * @param callback - The callback function to be registered.
   */
  register(callback: ShutdownCoordinator.Callback) {
    this.throwIfShutdownInProgress();
    this.#callbacks.add(callback);
  }

  /**
   * Unregister a callback from the shutdown process.
   *
   * @param callback - The callback function to be unregistered.
   */
  unregister(callback: ShutdownCoordinator.Callback) {
    this.throwIfShutdownInProgress();
    this.#callbacks.delete(callback);
  }

  /**
   * Execute all registered shutdown callbacks.
   *
   * This method executes all the registered shutdown callbacks in
   * the order they were registered. It is intended to be called
   * during the shutdown process to ensure all necessary cleanup
   * tasks are performed.
   */
  async shutdown() {
    this.#shutdownInProgress = true;

    const logger = this.#logger.scope("Shutdown");

    if (this.#callbacks.size === 0) {
      return logger.info("No shutdown callbacks registered.");
    }

    logger.info(`Executing ${this.#callbacks.size} shutdown callback(s).`);

    return Promise.all(
      Array.from(this.#callbacks).map(async (callback) => {
        return callback().catch((error) => {
          this.#logger.error(error);
        });
      }),
    );
  }
}

export namespace ShutdownCoordinator {
  /**
   * A callback function to be executed during the shutdown process.
   */
  export type Callback = () => Promise<void>;
}
