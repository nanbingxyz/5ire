export class Container {
  #registry: Map<Container.Injectable, Container.Entry>;

  private constructor() {
    this.#registry = new Map();
  }

  singleton<T>(token: Container.Injectable<T>, factory: () => T) {
    this.#registry.set(token, { factory, singleton: true });
  }

  transient<T>(token: Container.Injectable<T>, factory: () => T) {
    this.#registry.set(token, { factory, singleton: false });
  }

  inject<T>(token: Container.Injectable<T>): T;
  inject<T>(token: Container.Injectable<T>, must: false): T | undefined;

  inject<T>(token: Container.Injectable<T>, must = true) {
    const entry = this.#registry.get(token);

    if (entry) {
      if (entry.singleton) {
        if (entry.instance) {
          return entry.instance.value;
        }

        entry.instance = { value: entry.factory() };

        return entry.instance.value;
      } else {
        return entry.factory();
      }
    }

    if (must) {
      throw new Error(`Dependency with name '${token.name}' could not be resolved.`);
    }
  }

  static #global = new Container();

  static createToken<T>(name: string) {
    return new Container.Token<T>(name);
  }

  static inject = Container.#global.inject.bind(Container.#global);

  static singleton = Container.#global.singleton.bind(Container.#global);

  static transient = Container.#global.transient.bind(Container.#global);
}

export namespace Container {
  /**
   * A private Symbol whose sole purpose is to "tag" the generic type `T` on the `Token` class.
   * This is to work around a TypeScript type inference limitation.
   */
  const TOKEN_TYPE_SYMBOL = Symbol("token-type");

  export class Token<T = unknown> {
    /**
     * This property exists to aid TypeScript in correct type inference.
     * In TypeScript, if a class's generic parameter is not used in any of its public properties or methods,
     * the specific type of that generic parameter cannot be inferred from an instance of the class.
     * By using the generic `T` on this private property keyed by a Symbol, we provide a "clue" for TypeScript to infer the type.
     */
    [TOKEN_TYPE_SYMBOL]?: T;

    constructor(readonly name: string) {}
  }

  export type AbstractConstructable<T = unknown> = CallableFunction & {
    prototype: T;
  };

  export type Constructable<T = unknown> = new (...args: any[]) => T;

  export type Injectable<T = unknown> = Token<T> | AbstractConstructable<T> | Constructable<T>;

  export type Entry<T = unknown> = {
    factory: () => T;
    singleton: boolean;
    instance?: { value: T };
  };
}
