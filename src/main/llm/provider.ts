import type { Model } from "@/main/llm/model";

export abstract class Provider {
  #modelsUpdatedCallbacks: Set<() => void>;

  abstract capabilities: Provider.Capabilities;

  abstract status: Provider.Status;

  abstract models: Model[];

  subscribeStatusUpdated(callback: () => void) {
    this.#modelsUpdatedCallbacks.add(callback);

    return () => {
      this.#modelsUpdatedCallbacks.delete(callback);
    };
  }

  unsubscribeAllStatusUpdated() {
    this.#modelsUpdatedCallbacks.clear();
  }

  protected constructor() {
    this.#modelsUpdatedCallbacks = new Set();
  }

  protected notifyStatusUpdated() {
    for (const callback of this.#modelsUpdatedCallbacks) {
      try {
        callback();
      } catch {}
    }
  }

  static parseParameters = (schema: Provider.Parameter[], parameters: Record<string, string>) => {
    const result: Record<string, string> = {};

    for (const parameter of schema) {
      const value = parameters[parameter.key] || parameter.default;

      if (!value) {
        if (parameter.required) {
          throw new Error(`Parameter ${parameter.key} is required`);
        }
      } else {
        result[parameter.key] = value;
      }
    }

    return result;
  };
}

export namespace Provider {
  export type Config = {
    parameters: Record<string, string>;
    proxy?: string;
    models?: Array<{
      name: string;
      title: string;
      description: string;
      maxContextLength: number;
      maxOutput: number;
      capabilities: Model.Capabilities;
      pricing: Model.Pricing;
    }>;
  };

  export type Context = {
    config: Config;
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  };

  export type Status =
    | {
        type: "ready" | "loading";
      }
    | {
        type: "error";
        message: string;
      };

  export type Parameter = {
    key: string;
    label: string;
    description?: string;
    secret?: boolean;
    required?: boolean;
    default?: string;
  };

  export type Constructor = {
    new (context: Context): Provider;

    parameters: Parameter[];
  };

  export type Capabilities = {
    /**
     * Whether custom models are supported
     */
    readonly customModel: boolean;
  };
}
