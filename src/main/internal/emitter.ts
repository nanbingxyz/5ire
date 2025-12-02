import { default as emitter, type WildcardHandler } from "mitt";

/**
 * Event emitter class that provides type-safe event subscription and publishing functionality
 * @template T Event mapping type that defines the mapping between event names and their payload types
 */
export class Emitter<T extends Record<string, any>> {
  /**
   * Internal mitt instance
   * @private
   */
  #emitter = emitter<T>();

  /**
   * Subscribe to a specific event
   * @template E Event name type
   * @param event - Event name to subscribe to
   * @param handler - Event handler function
   * @returns Function to unsubscribe
   */
  on<E extends keyof T>(event: E, handler: (payload: T[E]) => void) {
    this.#emitter.on(event, handler);

    return () => {
      this.#emitter.off(event, handler);
    };
  }

  /**
   * Subscribe to all events
   * @param handler - Wildcard event handler function that receives event name and payload as parameters
   * @returns Function to unsubscribe
   */
  all(handler: WildcardHandler<T>) {
    this.#emitter.on("*", handler);

    return () => {
      this.#emitter.off("*", handler);
    };
  }

  /**
   * Emit an event
   * @template E Event name type
   * @param event - Event name to publish
   * @param payload - Event payload data
   */
  emit<E extends keyof T>(event: E, payload: T[E]) {
    this.#emitter.emit(event, payload);
  }

  /**
   * Create a readable stream for listening to all events
   * @returns ReadableStream containing all events
   */
  createStream() {
    const abort = new AbortController();

    return new ReadableStream<Emitter.WildcardEventChunk<T>>({
      start: (controller) => {
        const unlisten = this.all((event, payload) => {
          controller.enqueue({ event, payload });
        });

        abort.signal.addEventListener("abort", unlisten);
      },
      cancel: () => {
        abort.abort();
      },
    });
  }

  /**
   * Create a readable stream for listening to a specific event
   * @template K Event name type
   * @param event - Event name to listen to
   * @returns ReadableStream containing the specified event
   */
  createStreamFor<K extends keyof T>(event: K) {
    const abort = new AbortController();

    return new ReadableStream<T[K]>({
      start: (controller) => {
        const unlisten = this.on(event, (payload) => {
          controller.enqueue(payload);
        });

        abort.signal.addEventListener("abort", unlisten);
      },
      cancel: () => {
        abort.abort();
      },
    });
  }

  /**
   * Static method to create an Emitter instance
   * @template T Event mapping type
   * @returns New Emitter instance
   */
  static create<T extends Record<string, any>>() {
    return new Emitter<T>();
  }
}

/**
 * Emitter namespace
 */
export namespace Emitter {
  /**
   * Wildcard event chunk type representing all possible event and payload combinations
   * @template T Event mapping type
   */
  export type WildcardEventChunk<T extends Record<string, any>> = {
    [K in keyof T]: {
      event: K;
      payload: T[K];
    };
  }[keyof T];
}
