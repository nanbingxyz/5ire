import { z } from "zod/v4";
import { Openai } from "@/main/llm/adapters/openai";
import type { Model } from "@/main/llm/model";
import { Provider } from "@/main/llm/provider";

const DEFAULT_API_ENDPOINT = "https://aiproxy-swedencentral-01.openai.azure.com/";

export class Azure extends Provider {
  #status: Provider.Status;
  #models: Model[];
  #parameters: Azure.Parameters;

  get #apiEndpoint() {
    return this.#parameters.API_ENDPOINT || DEFAULT_API_ENDPOINT;
  }

  get #apiKey() {
    return this.#parameters.API_KEY;
  }

  get #apiURL() {
    const developer = this.#parameters.DEVELOPER_ID;
    const version = this.#parameters.API_VERSION;

    return new URL(`/openai/deployments/${developer}/chat/completions?api-version=${version}`, this.#apiEndpoint);
  }

  constructor(context: Provider.Context) {
    super();

    this.#status = {
      type: "loading",
    };
    this.#models = [];

    const parameters = Azure.ParametersSchema.safeParse(context.config.parameters);

    if (parameters.success) {
      this.#parameters = parameters.data;
      this.#status = {
        type: "ready",
      };

      const openai = new Openai({
        ...context,
        ...{
          parameters: {
            API_KEY: parameters.data.API_KEY,
            API_ENDPOINT: parameters.data.API_ENDPOINT,
          },
          fetch: (_, init) => {
            const headers = new Headers(init.headers);

            headers.set("Api-Key", this.#apiKey);
            headers.delete("Authorization");

            return context.fetch(this.#apiURL, {
              ...init,
              ...{
                headers,
              },
            });
          },
        },
      });

      if (openai.status.type === "ready") {
        this.#models = openai.models;
      } else {
        this.#status = openai.status;
      }
    } else {
      this.#parameters = {
        API_KEY: "",
        API_ENDPOINT: "",
        API_VERSION: "",
        DEVELOPER_ID: "",
      };
      this.#status = {
        type: "error",
        message: "",
      };
    }
  }

  get models() {
    return this.#models;
  }

  get capabilities() {
    return {
      customModel: false,
    };
  }

  get status() {
    return this.#status;
  }

  static readonly parameters: Provider.Parameter[] = [
    {
      key: "API_KEY",
      label: "API Key",
      description: "Your Azure API key",
      secret: true,
      required: true,
    },
    {
      key: "API_ENDPOINT",
      label: "API Endpoint",
      description: "The endpoint to use for Azure API requests",
      default: DEFAULT_API_ENDPOINT,
    },
    {
      key: "API_VERSION",
      label: "API Version",
      description: "The version of the Azure API to use",
      default: "2024-12-01-preview",
      required: true,
    },
    {
      key: "DEVELOPER_ID",
      label: "Developer ID",
      description: "The developer ID to use for Azure API requests",
      default: "chat",
      required: true,
    },
  ];
}

const _: Provider.Constructor = Azure;

export namespace Azure {
  export const ParametersSchema = z.object({
    API_KEY: z.string().nonempty(),
    API_ENDPOINT: z.url().optional(),
    API_VERSION: z.string().nonempty(),
    DEVELOPER_ID: z.string().nonempty(),
  });

  export type Parameters = z.infer<typeof ParametersSchema>;
}
