import type { IServiceProvider } from "./types";

const chatModels = [
  {
    id: "grok-4-1-fast-reasoning",
    name: "grok-4-1-fast-reasoning",
    contextWindow: 2000000,
    defaultMaxTokens: 8000,
    maxTokens: 1000000,
    inputPrice: 0.0002,
    outputPrice: 0.00005,
    description: `Grok's A frontier multimodal model optimized specifically for high-performance agentic tool calling.`,
    capabilities: {
      json: {
        enabled: true,
      },
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
        allowBase64: true,
        allowUrl: true,
      },
    },
  },
  {
    id: "grok-4-1-fast-non-reasoning",
    name: "grok-4-1-fast-non-reasoning",
    contextWindow: 2000000,
    defaultMaxTokens: 8000,
    maxTokens: 1000000,
    inputPrice: 0.0002,
    outputPrice: 0.00005,
    description: `Grok's A frontier multimodal model optimized specifically for high-performance agentic tool calling.`,
    capabilities: {
      json: {
        enabled: true,
      },
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
        allowBase64: true,
        allowUrl: true,
      },
    },
  },
  {
    id: "grok-4",
    name: "grok-4",
    contextWindow: 256000,
    defaultMaxTokens: 8000,
    maxTokens: 256000,
    inputPrice: 0.003,
    outputPrice: 0.015,
    description: `Grok's latest and greatest flagship model, offering unparalleled performance in natural language, math and reasoning - the perfect jack of all trades.`,
    capabilities: {
      json: {
        enabled: true,
      },
      tools: {
        enabled: true,
      },
    },
  },
  {
    id: "grok-4-fast",
    name: "grok-4-fast",
    contextWindow: 2000000,
    defaultMaxTokens: 1000000,
    maxTokens: 2000000,
    inputPrice: 0.0002,
    outputPrice: 0.0005,
    description: `Grok's latest advancement in cost-efficient reasoning models.`,
    capabilities: {
      json: {
        enabled: true,
      },
      tools: {
        enabled: true,
      },
    },
  },
  {
    id: "grok-4-fast-non-reasoning",
    name: "grok-4-fast-non-reasoning",
    contextWindow: 2000000,
    defaultMaxTokens: 1000000,
    maxTokens: 2000000,
    inputPrice: 0.0002,
    outputPrice: 0.0005,
    description: `Grok's latest advancement in cost-efficient reasoning models.`,
    capabilities: {
      json: {
        enabled: true,
      },
      tools: {
        enabled: true,
      },
    },
  },
  {
    id: "grok-code-fast",
    name: "grok-code-fast",
    contextWindow: 256000,
    defaultMaxTokens: 8000,
    maxTokens: 256000,
    inputPrice: 0.0003,
    outputPrice: 0.0015,
    description: `a speedy and economical reasoning model that excels at agentic coding.`,
    capabilities: {
      json: {
        enabled: true,
      },
      tools: {
        enabled: true,
      },
    },
  },
  {
    id: "grok-3",
    name: "grok-3",
    contextWindow: 131072,
    defaultMaxTokens: 4000,
    maxTokens: 131072,
    inputPrice: 0.003,
    outputPrice: 0.015,
    description: `Grok's flagship model that excels at enterprise tasks like data extraction, programming, and text summarization.`,
    capabilities: {
      json: {
        enabled: true,
      },
      tools: {
        enabled: true,
      },
    },
  },
  {
    id: "grok-3-fast",
    name: "grok-3-fast",
    contextWindow: 131072,
    defaultMaxTokens: 4000,
    maxTokens: 131072,
    inputPrice: 0.005,
    outputPrice: 0.025,
    isDefault: true,
    description: `Fast mode delivers reduced latency and a quicker time-to-first-token. Scroll down to read more.`,
    capabilities: {
      tools: {
        enabled: true,
      },
      json: {
        enabled: true,
      },
    },
  },
  {
    id: "grok-3-mini",
    name: "grok-3-mini",
    contextWindow: 131072,
    defaultMaxTokens: 4000,
    maxTokens: 131072,
    inputPrice: 0.0003,
    outputPrice: 0.0005,
    isDefault: true,
    description: `A lightweight model that thinks before responding. Excels at quantitative tasks that involve math and reasoning.`,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
        allowBase64: true,
        allowUrl: true,
      },
    },
  },
  {
    id: "grok-3-mini-fast",
    name: "grok-3-mini-fast",
    contextWindow: 131072,
    defaultMaxTokens: 4000,
    maxTokens: 131072,
    inputPrice: 0.0006,
    outputPrice: 0.004,
    isDefault: true,
    description: `Fast mode delivers reduced latency and a quicker time-to-first-token. Scroll down to read more.`,
    capabilities: {
      tools: {
        enabled: true,
      },
    },
  },
  {
    id: "grok-2-vision",
    name: "grok-2-vision",
    contextWindow: 32768,
    defaultMaxTokens: 4000,
    maxTokens: 4096,
    inputPrice: 0.002,
    outputPrice: 0.01,
    capabilities: {
      tools: {
        enabled: true,
      },
      vision: {
        enabled: true,
        allowBase64: true,
        allowUrl: true,
      },
    },
    description: `specialized model for advanced image generation and understanding`,
  },
  {
    id: "grok-2",
    name: "grok-2",
    contextWindow: 128000,
    defaultMaxTokens: 128000,
    maxTokens: 128000,
    inputPrice: 0.002,
    outputPrice: 0.01,
    isDefault: true,
    description: `Comparable performance to Grok 2 but with improved efficiency, speed and capabilities.`,
    capabilities: {
      tools: {
        enabled: true,
      },
    },
  },
];

export default {
  name: "Grok",
  apiBase: "https://api.x.ai/v1",
  currency: "USD",
  options: {
    apiBaseCustomizable: true,
    apiKeyCustomizable: true,
  },
  chat: {
    apiSchema: ["base", "key", "proxy"],
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 2, default: 0.9 },
    options: {
      modelCustomizable: true,
    },
    models: chatModels,
  },
} as IServiceProvider;
