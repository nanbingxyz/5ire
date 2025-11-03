/**
 * Dependency injection container class for managing dependency registration and resolution
 */
export class Container {
  /**
   * Map storing registered dependencies
   * @private
   */
  #registry: Map<Container.Injectable, Container.Entry>;

  /**
   * Private constructor to prevent direct instantiation
   * @private
   */
  private constructor() {
    this.#registry = new Map();
  }

  /**
   * Register a singleton dependency, same token will only create one instance
   * @template T Dependency type
   * @param token - Dependency identifier
   * @param factory - Dependency factory function
   */
  singleton<T>(token: Container.Injectable<T>, factory: () => T) {
    this.#registry.set(token, { factory, singleton: true });
  }

  /**
   * Register a transient dependency, new instance created on each injection
   * @template T Dependency type
   * @param token - Dependency identifier
   * @param factory - Dependency factory function
   */
  transient<T>(token: Container.Injectable<T>, factory: () => T) {
    this.#registry.set(token, { factory, singleton: false });
  }

  /**
   * Inject dependency
   * @template T Dependency type
   * @param token - Dependency identifier
   * @param must - Whether resolution must succeed, defaults to true
   * @returns Dependency instance or undefined (when must is false and dependency is not registered)
   * @throws Error when must is true and dependency is not registered
   */
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

  /**
   * Global container instance
   * @private
   */
  static #global = new Container();

  /**
   * Create dependency identifier Token
   * @template T Dependency type
   * @param name - Token name
   * @returns Newly created Token instance
   */
  static createToken<T>(name: string) {
    return new Container.Token<T>(name);
  }

  /**
   * Global inject method binding
   */
  static inject = Container.#global.inject.bind(Container.#global);

  /**
   * Global singleton registration method binding
   */
  static singleton = Container.#global.singleton.bind(Container.#global);

  /**
   * Global transient registration method binding
   */
  static transient = Container.#global.transient.bind(Container.#global);
}

/**
 * Container namespace containing related type definitions
 */
export namespace Container {
  /**
   * Private Symbol used to mark Token generic types
   * @private
   */
  const TOKEN_TYPE_SYMBOL = Symbol("token-type");

  /**
   * Dependency identifier Token class for type-safe dependency identification
   * @template T Dependency type
   */
  export class Token<T = unknown> {
    /**
     * Private property used to help TypeScript correctly infer types
     * @private
     */
    [TOKEN_TYPE_SYMBOL]?: T;

    /**
     * Create Token instance
     * @param name - Token name
     */
    constructor(readonly name: string) {}
  }

  /**
   * Abstract constructor type
   * @template T Instance type
   */
  export type AbstractConstructable<T = unknown> = CallableFunction & {
    prototype: T;
  };

  /**
   * Constructor type
   * @template T Instance type
   */
  export type Constructable<T = unknown> = new (...args: any[]) => T;

  /**
   * Injectable dependency identifier type
   * @template T Dependency type
   */
  export type Injectable<T = unknown> = Token<T> | AbstractConstructable<T> | Constructable<T>;

  /**
   * Dependency registration entry type
   * @template T Dependency type
   */
  export type Entry<T = unknown> = {
    factory: () => T;
    singleton: boolean;
    instance?: { value: T };
  };
}
