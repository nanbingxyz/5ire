import type { IServiceProvider } from "./types";

const chatModels = [
  {
    id: "kimi-k2-thinking-turbo",
    name: "kimi-k2-thinking-turbo",
    contextWindow: 262144,
    maxTokens: 262100,
    inputPrice: 0.008,
    outputPrice: 0.058,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "kimi-k2-thinking",
    name: "kimi-k2-thinking",
    contextWindow: 262144,
    maxTokens: 262100,
    inputPrice: 0.004,
    outputPrice: 0.016,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "kimi-k2-0905-preview",
    name: "kimi-k2-0905-preview",
    contextWindow: 262144,
    maxTokens: 262100,
    inputPrice: 0.004,
    outputPrice: 0.016,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "kimi-k2-0711-preview",
    name: "kimi-k2-0711-preview",
    contextWindow: 131072,
    maxTokens: 131000,
    inputPrice: 0.004,
    outputPrice: 0.016,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "kimi-k2-turbo-preview",
    name: "kimi-k2-turbo-preview",
    contextWindow: 262144,
    maxTokens: 262100,
    isDefault: true,
    inputPrice: 0.016,
    outputPrice: 0.064,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "kimi-latest-8k",
    name: "kimi-latest-8k",
    contextWindow: 8192,
    maxTokens: 8000,
    inputPrice: 0.002,
    outputPrice: 0.01,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "kimi-latest-32k",
    name: "kimi-latest-32k",
    contextWindow: 32768,
    maxTokens: 32000,
    inputPrice: 0.005,
    outputPrice: 0.02,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "kimi-latest-128k",
    name: "kimi-latest-128k",
    contextWindow: 131072,
    maxTokens: 131000,
    inputPrice: 0.01,
    outputPrice: 0.03,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "kimi-thinking-preview",
    name: "kimi-thinking-preview",
    description: "Optimized for complex reasoning tasks",
    contextWindow: 131072,
    maxTokens: 131000,
    inputPrice: 0.2,
    outputPrice: 0.2,
  },
  {
    id: "moonshot-v1-8k",
    name: "moonshot-v1-8k",
    contextWindow: 8192,
    maxTokens: 1024,
    inputPrice: 0.012,
    outputPrice: 0.012,
    capabilities: {
      tools: {
        enabled: true,
      },
    },
  },
  {
    id: "moonshot-v1-32k",
    name: "moonshot-v1-32k",
    contextWindow: 32768,
    maxTokens: 1024,
    inputPrice: 0.024,
    outputPrice: 0.024,
    capabilities: {
      tools: {
        enabled: true,
      },
    },
  },
  {
    id: "moonshot-v1-128k",
    name: "moonshot-v1-128k",
    contextWindow: 128000,
    maxTokens: 1024,
    inputPrice: 0.06,
    outputPrice: 0.06,
    capabilities: {
      tools: {
        enabled: true,
      },
    },
  },
  {
    id: "moonshot-v1-8k-vision-preview",
    name: "moonshot-v1-8k-vision-preview",
    contextWindow: 8192,
    maxTokens: 8000,
    inputPrice: 0.002,
    outputPrice: 0.01,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "moonshot-v1-32k-vision-preview",
    name: "moonshot-v1-32k-vision-preview",
    contextWindow: 32768,
    maxTokens: 32000,
    inputPrice: 0.005,
    outputPrice: 0.02,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "moonshot-v1-128k-vision-preview",
    name: "moonshot-v1-128k-vision-preview",
    contextWindow: 131072,
    maxTokens: 131000,
    inputPrice: 0.01,
    outputPrice: 0.03,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
];

export default {
  name: "Moonshot",
  apiBase: "https://api.moonshot.com/v1",
  currency: "CNY",
  options: {
    apiBaseCustomizable: true,
    apiKeyCustomizable: true,
  },
  chat: {
    apiSchema: ["base", "key", "proxy"],
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 1, default: 0.3 },
    options: {
      modelCustomizable: true,
    },
    models: chatModels,
  },
} as IServiceProvider;
