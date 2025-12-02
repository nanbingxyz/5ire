import { createStore } from "zustand/vanilla";
import type { Bridge } from "@/main/internal/bridge";

/**
 * Options for creating a stream store
 * @template T - The type of data in the stream
 */
export type StreamStoreOptions<T> = {
  /**
   * A function that returns a promise resolving to a readable stream proxy
   */
  streamLoader: () => Promise<Bridge.ReadableStreamProxy<T>>;
  /**
   * Optional callback function that is called when the stream is done
   */
  onDone?: () => void;
  /**
   * Optional callback function that is called when there is an error reading a chunk
   * @param error - The error that occurred while reading a chunk
   */
  onReadChunkError?: (error: unknown) => void;
};

/**
 * Creates a state stream store from a stream loader
 *
 * @template T - The type of data in the stream
 * @param options - Configuration options for the stream store
 * @returns A promise that resolves to an object containing the store instance and stream
 *
 * @throws {Error} If the initial state from the stream is empty
 */
export const createStateStreamStore = async <T>(options: StreamStoreOptions<T>) => {
  const stream = await options.streamLoader();
  const initial = await stream.next();

  if (initial.done) {
    throw new Error("Initial state is empty");
  }

  const instance = createStore(() => {
    return initial.value;
  });

  const setState = instance.setState.bind(instance);

  Promise.resolve().then(async () => {
    while (true) {
      try {
        const chunk = await stream.next();

        if (chunk.done) {
          break;
        }

        setState(() => chunk.value, true);
      } catch (error) {
        await stream
          .stop()
          .catch(() => {})
          .finally(() => {
            options.onReadChunkError?.(error);
          });
      }
    }

    options.onDone?.();
  });

  return { instance, stream };
};
