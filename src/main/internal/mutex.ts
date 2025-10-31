export class Mutex {
  #acquired = false;
  #resolvers = [] as (() => void)[];

  async acquire() {
    if (!this.#acquired) {
      this.#acquired = true;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.#resolvers.push(resolve);
    });
  }

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

  static create() {
    return new Mutex();
  }
}
