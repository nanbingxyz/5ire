import { asError } from "catch-unknown";
import { eq } from "drizzle-orm";
import { type Dispatcher, EnvHttpProxyAgent, fetch, ProxyAgent } from "undici";
import { Database } from "@/main/database";
import { schema } from "@/main/database/schema";
import type { ProviderConfig, Provider as ProviderData, ProviderKind } from "@/main/database/types";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import { Deepseek } from "@/main/llm/adapters/deepseek";
import type { Provider } from "@/main/llm/provider";
import { Logger } from "@/main/services/logger";

const CONSTRUCTORS = {} as Record<ProviderKind, Provider.Constructor>;

for (const kind of schema.providerKind.enumValues) {
  CONSTRUCTORS[kind] = Deepseek;
}

export class ProvidersManager extends Stateful<ProvidersManager.State> {
  #database = Container.inject(Database);
  #logger = Container.inject(Logger).scope("ProvidersManager");

  constructor() {
    super(() => {
      return {
        providers: new Map(),
      };
    });
  }

  getProviderInstance(id: string) {
    return this.state.providers.get(id);
  }

  getProviderParameters(kind: ProviderKind) {
    return CONSTRUCTORS[kind].parameters;
  }

  #createProviderInstance(kind: ProviderKind, config: ProviderConfig) {
    const logger = this.#logger.scope("CreateProviderInstance");

    let dispatcher: Dispatcher | undefined;

    if (config.proxy) {
      try {
        dispatcher = new ProxyAgent(config.proxy);
      } catch (e) {
        logger.error(`Failed to create proxy agent for proxy ${config.proxy}: ${asError(e).message}`);
      }
    }

    if (!dispatcher) {
      dispatcher = new EnvHttpProxyAgent();
    }

    const instance = new CONSTRUCTORS[kind]({
      config,
      // @ts-expect-error
      fetch: async (input, init) => {
        // @ts-expect-error
        return fetch(input, { ...init, dispatcher });
      },
    });

    instance.subscribeStatusUpdated(() => {
      this.update((draft) => {
        draft.providers = new Map(draft.providers);
      });
    });

    return instance;
  }

  async init() {
    const schema = this.#database.schema;
    const client = this.#database.client;
    const logger = this.#logger.scope("Init");

    const providers = await client.select().from(schema.provider).execute();

    logger.info(`Loaded ${providers.length} providers`);

    for (const provider of providers) {
      const instance = this.#createProviderInstance(provider.kind, provider.config);

      this.update((draft) => {
        draft.providers.set(provider.id, {
          instance,
          data: provider,
        });
      });
    }
  }

  async createProvider(options: ProvidersManager.CreateProviderOptions) {
    const schema = this.#database.schema;
    const client = this.#database.client;

    const provider = await client
      .insert(schema.provider)
      .values({
        kind: options.kind,
        label: options.label,
        config: {
          parameters: options.parameters,
        },
      })
      .returning()
      .execute()
      .then((result) => result[0]);

    this.update((draft) => {
      const instance = this.#createProviderInstance(provider.kind, provider.config);

      draft.providers.set(provider.id, {
        instance,
        data: provider,
      });
    });
  }

  async updateProvider(options: ProvidersManager.UpdateProviderOptions) {
    const schema = this.#database.schema;
    const client = this.#database.client;

    const provider = await client.transaction(async (tx) => {
      const exists = await tx.$count(schema.provider, eq(schema.provider.id, options.id)).then((count) => count > 0);

      if (!exists) {
        throw new Error("Provider does not exist.");
      }

      return tx
        .update(schema.provider)
        .set({
          label: options.label,
          config: {
            parameters: options.parameters,
          },
        })
        .where(eq(schema.project.id, options.id))
        .returning()
        .execute()
        .then((result) => result[0]);
    });

    this.update((draft) => {
      draft.providers.get(provider.id)?.instance.unsubscribeAllStatusUpdated();

      const instance = this.#createProviderInstance(provider.kind, provider.config);

      draft.providers.set(provider.id, {
        instance,
        data: provider,
      });
    });
  }

  async deleteProvider(options: ProvidersManager.DeleteProviderOptions) {
    const schema = this.#database.schema;
    const client = this.#database.client;

    await client.transaction(async (tx) => {
      const exists = await tx.$count(schema.provider, eq(schema.provider.id, options.id)).then((count) => count > 0);

      if (!exists) {
        throw new Error("Provider does not exist.");
      }

      return tx.delete(schema.provider).where(eq(schema.project.id, options.id)).execute();
    });

    this.update((draft) => {
      draft.providers.get(options.id)?.instance.unsubscribeAllStatusUpdated();
      draft.providers.delete(options.id);
    });
  }
}

export namespace ProvidersManager {
  export type State = {
    providers: Map<
      string,
      {
        instance: Provider;
        data: ProviderData;
      }
    >;
  };

  export type CreateProviderOptions = {
    kind: ProviderKind;
    label: string;
    parameters: Record<string, string>;
    proxy?: string;
  };

  export type UpdateProviderOptions = {
    id: string;
    label: string;
    parameters: Record<string, string>;
    proxy?: string;
  };

  export type DeleteProviderOptions = {
    id: string;
  };
}
