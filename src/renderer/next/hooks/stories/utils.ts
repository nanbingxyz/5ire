import { createStore } from "zustand/vanilla";
import type { Bridge } from "@/main/internal/bridge";

export type StreamStoreOptions<T> = {
  streamLoader: () => Promise<Bridge.ReadableStreamProxy<T>>;
  signal?: AbortSignal;
};

export const createStreamStore = async <T>(options: StreamStoreOptions<T>) => {
  const stream = await options.streamLoader();
  const initial = await stream.next();

  if (initial.done) {
    throw new Error("Initial state is empty");
  }

  const instance = createStore(() => {
    return initial.value;
  });

  const setState = instance.setState.bind(instance);

  Promise.resolve()
    .then(async () => {
      while (true) {
        try {
          const chunk = await stream.next();

          if (chunk.done) {
            break;
          }

          setState(() => chunk.value, true);
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    })
    .catch(() => {
      //
    });

  if (options.signal) {
    options.signal.addEventListener("abort", () => {
      stream.stop().catch(() => {});
    });

    if (options.signal.aborted) {
      stream.stop().catch(() => {});
    }
  }

  return instance;
};
