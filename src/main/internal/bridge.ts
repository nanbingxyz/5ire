import { AsyncLocalStorage } from "node:async_hooks";

const INVOKE_EVENTS_STORAGE = new AsyncLocalStorage<Electron.IpcMainInvokeEvent>();

export class Bridge<T extends Bridge.Actions = Bridge.Actions> {
  #streams: Map<string, ReadableStreamDefaultReader<unknown>>;

  constructor(
    private readonly prefix: string,
    private readonly build: () => T,
  ) {
    this.#streams = new Map();
  }

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

    ipc.handle(`bridge:stream:next`, async (_, readerId: string) => {
      const reader = this.#streams.get(readerId);

      if (!reader) {
        throw new Error(`Stream reader ${readerId} not found`);
      }

      return reader.read();
    });

    ipc.handle(`bridge:stream:stop`, async (_, readerId: string) => {
      const reader = this.#streams.get(readerId);

      if (!reader) {
        throw new Error(`Stream reader ${readerId} not found`);
      }

      return await reader.cancel().finally(() => {
        this.#streams.delete(readerId);
      });
    });
  }

  static getCurrentInvokeEvent() {
    const event = INVOKE_EVENTS_STORAGE.getStore();

    if (!event) {
      throw new Error("Can't get current event");
    }

    return event;
  }

  static define<T extends Bridge.Actions>(prefix: string, build: () => T) {
    return class DefinedBridge extends Bridge<T> {
      constructor() {
        super(prefix, build);
      }
    };
  }
}

export namespace Bridge {
  export type ReadableStreamProxyNextValue<O> =
    | {
        done: false;
        value: O;
      }
    | {
        done: true;
      };

  export type ReadableStreamProxy<O = void> = {
    next: () => Promise<ReadableStreamProxyNextValue<O>>;
    stop: () => Promise<void>;
  };

  export type AsyncAction<A extends unknown[] = unknown[], O = unknown> = (...args: A) => Promise<O>;

  export type StreamAction<A extends unknown[] = unknown[], O = unknown> = (...args: A) => ReadableStream<O>;

  export type Action<A extends unknown[] = unknown[], O = unknown> = AsyncAction<A, O> | StreamAction<A, O>;

  export type Actions = {
    [key: string]: Action | Actions;
  };

  export type Shape<T extends Actions> = {
    [K in keyof T]: T[K] extends Action
      ? ReturnType<T[K]> extends Promise<unknown>
        ? "async"
        : "stream"
      : T[K] extends Actions
        ? Shape<T[K]>
        : never;
  };

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
