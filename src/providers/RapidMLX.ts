import type { IServiceProvider } from "./types";

export default {
  name: "Rapid-MLX",
  apiBase: "http://localhost:8000/v1",
  currency: "USD",
  options: {
    apiBaseCustomizable: true,
    isApiKeyOptional: true,
    modelsEndpoint: "/models",
  },
  chat: {
    apiSchema: ["base", "key", "model", "proxy"],
    docs: {
      temperature:
        "Higher values will make the output more creative and unpredictable, while lower values will make it more precise.",
      presencePenalty:
        "Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
      topP: "An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with topP probability mass.",
    },
    placeholders: {
      base: "localhost:8000/v1",
    },
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 1, default: 0.9 },

    options: {
      modelCustomizable: true,
    },
    models: [],
  },
  embedding: {
    apiSchema: ["base"],
    placeholders: {
      base: "localhost:8000/v1",
    },
    options: {
      modelCustomizable: true,
    },
    models: [],
  },
} as IServiceProvider;
