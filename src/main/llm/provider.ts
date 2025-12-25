import type { Model } from "@/main/llm/model";
import type { Part } from "@/main/model/content-specification";

export abstract class Provider {
  #modelsUpdatedCallbacks: Set<() => void>;

  abstract models: Provider.Models;

  abstract name: string;

  abstract capabilities: Provider.Capabilities;

  subscribeModelsUpdated(callback: () => void) {
    this.#modelsUpdatedCallbacks.add(callback);

    return () => {
      this.#modelsUpdatedCallbacks.delete(callback);
    };
  }

  protected constructor() {
    this.#modelsUpdatedCallbacks = new Set();
  }

  protected notifyModelsUpdated() {
    for (const callback of this.#modelsUpdatedCallbacks) {
      try {
        callback();
      } catch {}
    }
  }
}

export namespace Provider {
  export type Store = {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => void;
  };

  export type Config = Record<string, unknown>;

  export type Context = {
    config: Config;
    store: Store;
    stringifyReference: (part: Part.Reference) => Promise<string>;
    stringifyResource: (part: Part.Resource) => Promise<string>;
  };

  export type Constructor = new (context: Context) => Provider;

  export type Models =
    | {
        status: "loading";
      }
    | {
        status: "loaded";
        models: Model[];
      }
    | {
        status: "error";
        error: string;
      };

  export type Capabilities = {
    /**
     * 是否可以自定义模型
     */
    readonly customModel: boolean;
    /**
     * 是否可以自定义 API 基础 URL
     */
    readonly customApiBaseURL: boolean;
  };

  export type CustomModelConfig = {
    name: string;
    title: string;
    capabilities: Model.Capabilities;
  };
}
