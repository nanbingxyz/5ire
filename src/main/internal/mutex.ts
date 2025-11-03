/**
 * Mutex class used to ensure only one operation can access shared resources at a time
 */
export class Mutex {
  /**
   * Indicates whether the lock has been acquired
   * @private
   */
  #acquired = false;

  /**
   * Queue of callback functions waiting to acquire the lock
   * @private
   */
  #resolvers = [] as (() => void)[];

  /**
   * Acquire the lock, wait if the lock is already occupied
   * @param signal - Optional AbortSignal for controlling timeout or manual cancellation
   * @returns Promise<void> - Resolves when lock is acquired, rejects when cancelled
   */
  async acquire(signal?: AbortSignal) {
    // Check if signal is already aborted
    if (signal?.aborted) {
      return Promise.reject(new Error("Acquire operation was aborted"));
    }

    if (!this.#acquired) {
      this.#acquired = true;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      // If signal is provided, set up abort event listener
      if (signal) {
        const abortHandler = () => {
          // Remove current resolve function from waiting queue
          const index = this.#resolvers.indexOf(resolve);
          if (index !== -1) {
            this.#resolvers.splice(index, 1);
          }
          reject(new Error("Acquire operation was aborted"));
        };

        if (signal.aborted) {
          // If signal is already aborted, reject immediately
          reject(new Error("Acquire operation was aborted"));
          return;
        }

        signal.addEventListener("abort", abortHandler, { once: true });
      }

      this.#resolvers.push(resolve);
    });
  }

  /**
   * Release the lock, allowing the next waiter to acquire the lock
   * @throws {Error} Throws error when trying to release an unacquired lock
   */
  async release() {
    if (!this.#acquired) {
      throw new Error(`Cannot release an unacquired lock`);
    }

    const next = this.#resolvers.shift();

    if (next) {
      return next();
    }

    this.#acquired = false;
  }

  /**
   * Static method to create a Mutex instance
   * @returns Mutex - Newly created Mutex instance
   */
  static create() {
    return new Mutex();
  }
}
