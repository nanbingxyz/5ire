import { default as ElectronStore } from "electron-store";
import { applyPatches, type Draft, enablePatches, freeze, type Patch, produceWithPatches } from "immer";
import { pack, unpack } from "msgpackr";

enablePatches();

/**
 * A generic observable state container base class.
 *
 * - Uses **Immer** internally to manage immutable state.
 * - Supports subscription to state changes.
 * - Allows transactional state updates with change tracking.
 * - Can apply external patches (`Patch[]`) for synchronization.
 *
 * @template T The shape of the state object (must be a record-like object).
 */
export abstract class Store<T extends Record<string, any>> {
  #state: T;
  #initialState: T;

  #subscribers: Set<Store.Subscriber<T>>;

  /**
   * @param initializer A function that returns the initial state.
   * The result is deeply frozen using `immer.freeze()` to ensure immutability.
   */
  protected constructor(initializer: () => T) {
    this.#initialState = freeze(initializer(), true);
    this.#state = this.#initialState;

    this.#subscribers = new Set();
  }

  /**
   * The current immutable state.
   *
   * @readonly
   */
  get state() {
    return this.#state;
  }

  /**
   * The immutable initial state defined at construction.
   *
   * @readonly
   */
  get initialState() {
    return this.#initialState;
  }

  /**
   * Updates the state using an Immer `draft`.
   *
   * This method wraps `immer.produceWithPatches` to create a new state version
   * and generates forward/inverse patches automatically.
   * All subscribers are notified after each update.
   *
   * @param producer A callback that receives a mutable draft of the state.
   * @example
   * ```ts
   * store.update((draft) => {
   *   draft.count += 1;
   * });
   * ```
   */
  protected update(producer: (draft: Draft<T>) => void) {
    const prev = this.state;
    const next = produceWithPatches(prev, producer);

    this.#state = next[0];

    for (const subscriber of this.#subscribers) {
      subscriber(prev, next[0], [next[1], next[2]]);
    }
  }

  /**
   * Subscribes to state changes.
   *
   * The callback is invoked whenever the state changes,
   * receiving:
   * - `prev`: the previous state,
   * - `next`: the next state,
   * - `patches`: a tuple of `[forward, inverse]` patches.
   *
   * @param subscriber A subscriber callback function.
   * @returns A function that unsubscribes the listener.
   *
   * @example
   * ```ts
   * const unsubscribe = store.subscribe((prev, next) => {
   *   console.log("State changed:", next);
   * });
   *
   * // Later...
   * unsubscribe();
   * ```
   */
  subscribe(subscriber: Store.Subscriber<T>) {
    this.#subscribers.add(subscriber);

    return () => {
      this.#subscribers.delete(subscriber);
    };
  }

  /**
   * Applies a set of Immer patches (`Patch[]`) to the current state.
   *
   * Typically used to synchronize state with remote updates or history playback.
   *
   * @param patches An array of Immer patches.
   * @example
   * ```ts
   * store.apply(patches);
   * ```
   */
  apply(patches: Patch[]) {
    this.update((draft) => {
      applyPatches(draft, patches);
    });
  }

  stream(): ReadableStream<Store.StreamChunk<T>>;
  stream<O>(transform: (state: T) => O): ReadableStream<O>;

  stream<O>(transform?: (state: T) => O) {
    const abort = new AbortController();

    return new ReadableStream<Store.StreamChunk<T> | O>({
      cancel: () => {
        abort.abort();
      },
      start: (controller) => {
        if (transform) {
          controller.enqueue(transform(this.state));
        } else {
          controller.enqueue([this.state]);
        }

        const unsubscribe = this.subscribe((_, next, patches) => {
          if (transform) {
            controller.enqueue(transform(next));
          } else {
            controller.enqueue([
              next,
              {
                forward: patches[0],
                inverse: patches[1],
              },
            ]);
          }
        });

        abort.signal.addEventListener("abort", unsubscribe);
      },
    });
  }
}

export namespace Store {
  /**
   * A tuple containing forward and inverse patches.
   *
   * - `[0]`: forward patches (applied to move state forward)
   * - `[1]`: inverse patches (used for rollback or undo)
   */
  export type Patches = [Patch[], Patch[]];

  export type StreamChunk<T extends Record<string, any>> = [
    state: T,
    patches?: {
      forward: Patch[];
      inverse: Patch[];
    },
  ];

  /**
   * The signature of a state change subscriber function.
   *
   * @template T The shape of the state.
   * @param prev The previous state.
   * @param next The updated state.
   * @param patches The `[forward, inverse]` patch pair.
   */
  export type Subscriber<T extends Record<string, any>> = (prev: T, next: T, patches: Patches) => void;

  /**
   * An abstract store class with built-in persistence support.
   *
   * - Uses `electron-store` for disk persistence.
   * - Serializes data with `msgpackr` for compact storage.
   * - Automatically writes to disk when the state changes.
   * - Uses `.store` as the file extension by default.
   *
   * Useful for building application stores with automatic persistence.
   *
   * @template T The shape of the persisted state.
   */
  export abstract class Persistable<T extends Record<string, any>> extends Store<T> {
    /**
     * @param options Persistence options.
     *
     * - `directory`: the directory to store data files.
     * - `name`: the base name of the store file.
     * - `defaults`: the default initial state.
     *
     * @example
     * ```ts
     * class SettingsStore extends Store.Persistable<{ theme: string }> {
     *   constructor() {
     *     super({
     *       directory: app.getPath("userData"),
     *       name: "settings",
     *       defaults: { theme: "light" },
     *     });
     *   }
     * }
     * ```
     */
    protected constructor(options: Store.Persistable.Options<T>) {
      const persistor = new ElectronStore<T>({
        defaults: options.defaults,
        name: options.name,
        cwd: options.directory,
        serialize: (value) => {
          return Buffer.from(pack(value)).toString("hex");
        },
        deserialize: (value) => {
          return unpack(Buffer.from(value, "hex"));
        },
        fileExtension: "store",
      });

      super(() => {
        return persistor.store;
      });

      // Automatically persist state changes to disk
      this.subscribe((_, state) => {
        persistor.set(state);
      });
    }
  }

  export namespace Persistable {
    /**
     * Configuration options for a `Store.Persistable` instance.
     *
     * @template T The shape of the state.
     */
    export type Options<T extends Record<string, any>> = {
      /**
       * The absolute path to the persistence directory.
       */
      directory: string;
      /**
       * The base name of the persistence file.
       */
      name: string;
      /**
       * The default initial state object.
       */
      defaults: T;
    };
  }
}
