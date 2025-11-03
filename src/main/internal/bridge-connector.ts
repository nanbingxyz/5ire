import type { Bridge } from "@/main/internal/bridge";

/**
 * Bridge connector class used to create proxy calls to Bridge services in the main process from the renderer process
 */
export class BridgeConnector {
  /**
   * Create a BridgeConnector instance
   * @param ipc - Electron renderer process IPC object
   */
  constructor(private readonly ipc: Electron.IpcRenderer) {}

  /**
   * Internal connection method that recursively builds proxy objects for Bridge services
   * @template T Bridge type
   * @param namespace - Bridge namespace
   * @param prefix - Current level path prefix
   * @param shape - Bridge shape descriptor object
   * @returns Proxy object that can be used to call remote services
   * @private
   */
  #connect<T extends Bridge>(namespace: string, prefix: string, shape: BridgeConnector.Shape<T>) {
    const proxy = {} as Record<string, unknown>;

    for (const key in shape) {
      const value = shape[key];

      if (typeof value === "object") {
        proxy[key] = this.#connect(namespace, `${prefix}::${key}`, value);
      } else {
        proxy[key] = async (...args: unknown[]) => {
          if (value === "async") {
            return this.ipc.invoke(`bridge::${prefix}::${key}`, ...args);
          }

          const result = await this.ipc.invoke(`bridge::${prefix}::${key}`, ...args);

          if ("$$STREAM_READER_ID" in result && typeof result.$$STREAM_READER_ID === "string") {
            const controller = new AbortController();

            return {
              next: () => {
                return new Promise<Bridge.ReadableStreamProxyNextValue<unknown>>((resolve, reject) => {
                  if (controller.signal.aborted) {
                    return resolve({ done: true });
                  }

                  controller.signal.addEventListener("abort", () => {
                    resolve({ done: true });
                  });

                  this.ipc.invoke(`bridge:stream:next::${namespace}`, result.$$STREAM_READER_ID).then(resolve, reject);
                });
              },
              stop: () => {
                return new Promise<void>((resolve, reject) => {
                  if (controller.signal.aborted) {
                    return resolve();
                  }

                  controller.signal.addEventListener("abort", () => {
                    resolve();
                  });

                  this.ipc
                    .invoke(`bridge:stream:stop::${namespace}`, result.$$STREAM_READER_ID)
                    .then(() => {
                      controller.abort();
                    })
                    .then(resolve, reject);
                });
              },
            };
          }

          throw new Error(
            `Unexpected result from service action '${key}' in namespace '${prefix}': ${JSON.stringify(result)}`,
          );
        };
      }
    }

    return proxy as Bridge.Proxy<BridgeConnector.Actions<T>>;
  }

  /**
   * Connect to Bridge service and create a proxy object for calling remote services
   * @template T Bridge type
   * @param namespace - Bridge namespace
   * @param shape - Bridge shape descriptor object
   * @returns Proxy object that can be used to call remote services
   */
  connect<T extends Bridge>(namespace: string, shape: BridgeConnector.Shape<T>) {
    return this.#connect(namespace, namespace, shape);
  }
}

/**
 * BridgeConnector namespace containing related type definitions
 */
export namespace BridgeConnector {
  /**
   * Extract Bridge action types
   * @template T Bridge type
   */
  export type Actions<T extends Bridge> = T extends Bridge<infer A> ? A : never;

  /**
   * Extract Bridge shape types
   * @template T Bridge type
   */
  export type Shape<T extends Bridge> = T extends Bridge<infer A> ? Bridge.Shape<A> : never;
}
