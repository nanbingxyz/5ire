import { default as emitter, type WildcardHandler } from "mitt";

export class Emitter<T extends Record<string, any>> {
  #emitter = emitter<T>();

  on<E extends keyof T>(event: E, handler: (payload: T[E]) => void) {
    this.#emitter.on(event, handler);

    return () => {
      this.#emitter.off(event, handler);
    };
  }

  all(handler: WildcardHandler<T>) {
    this.#emitter.on("*", handler);

    return () => {
      this.#emitter.off("*", handler);
    };
  }

  emit<E extends keyof T>(event: E, payload: T[E]) {
    this.#emitter.emit(event, payload);
  }

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

  static create<T extends Record<string, any>>() {
    return new Emitter<T>();
  }
}

export namespace Emitter {
  export type WildcardEventChunk<T extends Record<string, any>> = {
    [K in keyof T]: {
      event: K;
      payload: T[K];
    };
  }[keyof T];
}
