import { AsyncLocalStorage } from "node:async_hooks";

const INVOKE_EVENTS_STORAGE = new AsyncLocalStorage<Electron.IpcMainInvokeEvent>();

/**
 * Bridge class for exposing services to IPC and handling communication between main and renderer processes
 * @template T Bridge actions type
 */
export class Bridge<T extends Bridge.Actions = Bridge.Actions> {
  #streams: Map<string, ReadableStreamDefaultReader<unknown>>;

  /**
   * Create a Bridge instance
   * @param prefix - Namespace prefix for the bridge
   * @param build - Function that returns the actions to expose
   */
  constructor(
    private readonly prefix: string,
    private readonly build: () => T,
  ) {
    this.#streams = new Map();
  }

  /**
   * Expose bridge actions to IPC
   * @param ipc - Electron IPC main instance
   */
  expose(ipc: Electron.IpcMain) {
    const prefix = `bridge::${this.prefix}`;

    const setup = (prefix: string, actions: Bridge.Actions) => {
      for (const [action, handler] of Object.entries(actions)) {
        if (typeof handler === "function") {
          ipc.handle(`${prefix}::${action}`, async (event, ...args) => {
            return INVOKE_EVENTS_STORAGE.run(event, async () => {
              const result = handler(...args);

              if (result instanceof Promise) {
                return await result;
              }

              if (result instanceof ReadableStream) {
                const id = `${prefix}::${action}::${crypto.randomUUID()}`;
                const reader = result.getReader();

                this.#streams.set(id, reader);

                event.sender.once("destroyed", () => {
                  const reader = this.#streams.get(id);

                  if (reader) {
                    reader.cancel().catch(() => {});
                  }
                });

                return {
                  $$STREAM_READER_ID: id,
                };
              }

              throw new Error(
                `Invalid result from service action '${action}' in namespace '${prefix}': ${JSON.stringify(result)}`,
              );
            });
          });
        } else {
          setup(`${prefix}::${action}`, handler);
        }
      }
    };

    setup(prefix, this.build());

    ipc.handle(`bridge:stream:next::${this.prefix}`, async (_, readerId: string) => {
      const reader = this.#streams.get(readerId);

      if (!reader) {
        throw new Error(`Stream reader ${readerId} not found`);
      }

      return reader.read();
    });

    ipc.handle(`bridge:stream:stop::${this.prefix}`, async (_, readerId: string) => {
      const reader = this.#streams.get(readerId);

      if (!reader) {
        throw new Error(`Stream reader ${readerId} not found`);
      }

      return await reader.cancel().finally(() => {
        this.#streams.delete(readerId);
      });
    });
  }

  /**
   * Get current IPC invoke event
   * @returns Current Electron IPC main invoke event
   * @throws Error when called outside of a bridge action context
   */
  static getCurrentInvokeEvent() {
    const event = INVOKE_EVENTS_STORAGE.getStore();

    if (!event) {
      throw new Error("Can't get current event");
    }

    return event;
  }

  /**
   * Define a new Bridge subclass with specific actions
   * @template T Bridge actions type
   * @param prefix - Namespace prefix for the bridge
   * @param build - Function that returns the actions to expose
   * @returns Defined Bridge subclass
   */
  static define<T extends Bridge.Actions>(prefix: string, build: () => T) {
    return class DefinedBridge extends Bridge<T> {
      constructor() {
        super(prefix, build);
      }
    };
  }
}

export namespace Bridge {
  /**
   * Type for next value from a readable stream proxy
   * @template O Output type
   */
  export type ReadableStreamProxyNextValue<O> =
    | {
        done: false;
        value: O;
      }
    | {
        done: true;
      };

  /**
   * Proxy for a readable stream with next and stop methods
   * @template O Output type
   */
  export type ReadableStreamProxy<O = void> = {
    next: () => Promise<ReadableStreamProxyNextValue<O>>;
    stop: () => Promise<void>;
  };

  /**
   * Asynchronous action type
   * @template A Arguments type
   * @template O Output type
   */
  export type AsyncAction<A extends any[] = any[], O = any> = (...args: A) => Promise<O>;

  /**
   * Stream action type
   * @template A Arguments type
   * @template O Output type
   */
  export type StreamAction<A extends any[] = any[], O = any> = (...args: A) => ReadableStream<O>;

  /**
   * Action type which can be either async or stream
   * @template A Arguments type
   * @template O Output type
   */
  export type Action<A extends any[] = any[], O = any> = AsyncAction<A, O> | StreamAction<A, O>;

  /**
   * Collection of actions that can be exposed through the bridge
   */
  export type Actions = {
    [key: string]: Action | Actions;
  };

  /**
   * Shape type describing the structure of actions
   * @template T Actions type
   */
  export type Shape<T extends Actions> = {
    [K in keyof T]: T[K] extends Action
      ? ReturnType<T[K]> extends Promise<unknown>
        ? "async"
        : "stream"
      : T[K] extends Actions
        ? Shape<T[K]>
        : never;
  };

  /**
   * Proxy type for actions
   * @template T Actions type
   */
  export type Proxy<T extends Actions> = {
    [K in keyof T]: T[K] extends Action
      ? T[K] extends StreamAction<infer A, infer O>
        ? AsyncAction<A, ReadableStreamProxy<O>>
        : T[K]
      : T[K] extends Actions
        ? Proxy<T[K]>
        : never;
  };
}
