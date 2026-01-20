import type { IServiceProvider } from "./types";

const chatModels = [
  {
    id: "glm-4.7",
    name: "GLM-4.7",
    contextWindow: 200000,
    maxTokens: 128000,
    defaultMaxTokens: 100000,
    inputPrice: 0.002,
    outputPrice: 0.008,
    isDefault: true,
    description: `GLM-4.7 is Zhipu’s latest flagship model, with major upgrades focused on advanced coding capabilities and more reliable multi-step reasoning and execution. It shows clear gains in complex agent workflows, while delivering a more natural conversational experience and stronger front-end design sensibility.`,
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
    id: "glm-4.6v",
    name: "GLM-4.6V",
    contextWindow: 200000,
    maxTokens: 128000,
    defaultMaxTokens: 100000,
    inputPrice: 0.002,
    outputPrice: 0.008,
    isDefault: true,
    description: ``,
    capabilities: {
      tools: {
        enabled: true,
      },
      json: {
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
    id: "glm-4.5",
    name: "GLM-4.5",
    contextWindow: 128000,
    maxTokens: 96000,
    defaultMaxTokens: 8000,
    inputPrice: 0.002,
    outputPrice: 0.008,
    description: `Our most powerful reasoning model with 355B parameters, supports deep thinking, tool calling, and 128K context`,
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
    id: "glm-4.5-air",
    name: "GLM-4.5-Air",
    contextWindow: 128000,
    maxTokens: 96000,
    defaultMaxTokens: 8000,
    inputPrice: 0.0008,
    outputPrice: 0.002,
    isDefault: false,
    description: `Cost-effective lightweight high-performance model with 106B parameters, supports tool calling and deep thinking`,
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
    id: "glm-4.5-x",
    name: "GLM-4.5-X",
    contextWindow: 128000,
    maxTokens: 96000,
    defaultMaxTokens: 8000,
    inputPrice: 0.008,
    outputPrice: 0.024,
    isDefault: false,
    description: `High-performance strong reasoning with ultra-fast response, optimized for complex reasoning tasks`,
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
    id: "glm-4.5-airx",
    name: "GLM-4.5-AirX",
    contextWindow: 128000,
    maxTokens: 96000,
    defaultMaxTokens: 8000,
    inputPrice: 0.002,
    outputPrice: 0.006,
    isDefault: false,
    description: `Lightweight high-performance ultra-fast response, balancing performance and efficiency`,
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
    id: "glm-4.5-flash",
    name: "GLM-4.5-Flash",
    contextWindow: 128000,
    maxTokens: 96000,
    defaultMaxTokens: 8000,
    inputPrice: 0,
    outputPrice: 0,
    isDefault: false,
    description: `Free efficient multi-functional model, suitable for various scenarios`,
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
    id: "glm-4-plus",
    name: "GLM-4-Plus",
    contextWindow: 128000,
    maxTokens: 4000,
    defaultMaxTokens: 4000,
    inputPrice: 0.005,
    outputPrice: 0.005,
    isDefault: false,
    description: `High-intelligence model with excellent performance in language understanding, logical reasoning, instruction following, and long text processing`,
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
    id: "glm-4-air-250414",
    name: "GLM-4-Air-250414",
    contextWindow: 128000,
    maxTokens: 16000,
    defaultMaxTokens: 8000,
    inputPrice: 0.0005,
    outputPrice: 0.0005,
    isDefault: false,
    description: `Base language model that can quickly execute complex tasks, with enhanced capabilities in tool calling, web search, code and agent tasks`,
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
    id: "glm-4-airx",
    name: "GLM-4-AirX",
    contextWindow: 8000,
    maxTokens: 4000,
    defaultMaxTokens: 4000,
    inputPrice: 0.01,
    outputPrice: 0.01,
    isDefault: false,
    description: `High-speed version of GLM-4-Air, quickly execute complex tasks`,
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
    id: "glm-4-flashx-250414",
    name: "GLM-4-FlashX-250414",
    contextWindow: 128000,
    maxTokens: 16000,
    defaultMaxTokens: 8000,
    inputPrice: 0.0001,
    outputPrice: 0.0001,
    isDefault: false,
    description: `Ultra-fast inference speed, stronger concurrency guarantee and extreme cost-effectiveness, excellent performance in real-time web retrieval, long context processing, and multilingual support`,
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
    id: "glm-4-flash-250414",
    name: "GLM-4-Flash-250414",
    contextWindow: 128000,
    maxTokens: 16000,
    defaultMaxTokens: 8000,
    inputPrice: 0,
    outputPrice: 0,
    isDefault: false,
    description: `Free language model, basic version of GLM-4-FlashX`,
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
    id: "glm-z1-air",
    name: "GLM-Z1-Air",
    contextWindow: 128000,
    maxTokens: 32000,
    defaultMaxTokens: 8000,
    inputPrice: 0.0005,
    outputPrice: 0.0005,
    isDefault: false,
    description: `Reasoning model with deep thinking capabilities, significantly enhanced mathematical reasoning abilities, suitable for high-frequency calling scenarios`,
    capabilities: {
      json: {
        enabled: true,
      },
    },
  },
  {
    id: "glm-z1-airx",
    name: "GLM-Z1-AirX",
    contextWindow: 32000,
    maxTokens: 30000,
    defaultMaxTokens: 8000,
    inputPrice: 0.005,
    outputPrice: 0.005,
    isDefault: false,
    description: `High-speed version of GLM-Z1-Air with deep thinking capabilities for fast reasoning`,
    capabilities: {
      json: {
        enabled: true,
      },
    },
  },
  {
    id: "glm-z1-flashx",
    name: "GLM-Z1-FlashX",
    contextWindow: 128000,
    maxTokens: 32000,
    defaultMaxTokens: 8000,
    inputPrice: 0.0001,
    outputPrice: 0.0001,
    isDefault: false,
    description: `Ultra-fast inference speed and faster concurrency guarantee, extreme cost-effectiveness, further lowering the threshold for reasoning model usage`,
    capabilities: {
      json: {
        enabled: true,
      },
    },
  },
  {
    id: "glm-z1-flash",
    name: "GLM-Z1-Flash",
    contextWindow: 128000,
    maxTokens: 32000,
    defaultMaxTokens: 8000,
    inputPrice: 0,
    outputPrice: 0,
    isDefault: false,
    description: `Free reasoning model, basic version of GLM-Z1-FlashX`,
    capabilities: {
      json: {
        enabled: true,
      },
    },
  },
  {
    id: "glm-4.1v-thinking-flashx",
    name: "GLM-4.1V-Thinking-FlashX",
    contextWindow: 64000,
    maxTokens: 8000,
    defaultMaxTokens: 4000,
    inputPrice: 0.002,
    outputPrice: 0.002,
    isDefault: false,
    description: `Most powerful visual reasoning model in 10B parameter class, supports chart/video understanding, frontend coding, GUI tasks with chain-of-thought reasoning mechanism`,
    capabilities: {
      json: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "glm-4.1v-thinking-flash",
    name: "GLM-4.1V-Thinking-Flash",
    contextWindow: 64000,
    maxTokens: 8000,
    defaultMaxTokens: 4000,
    inputPrice: 0,
    outputPrice: 0,
    isDefault: false,
    description: `Free visual reasoning model supporting video, image, and text multimodal input with chain-of-thought reasoning capabilities`,
    capabilities: {
      json: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
  {
    id: "glm-4v-plus-0111",
    name: "GLM-4V-Plus-0111",
    contextWindow: 16000,
    maxTokens: 16000,
    defaultMaxTokens: 4000,
    inputPrice: 0.004,
    outputPrice: 0.004,
    isDefault: false,
    description: `Next-generation visual understanding model with capabilities in visual summarization, visual modification, reasoning, multi-turn dialogue, and temporal Q&A, supporting various image and video understanding tasks`,
    capabilities: {
      json: {
        enabled: true,
      },
      vision: {
        enabled: true,
      },
    },
  },
];

export default {
  name: "Zhipu",
  apiBase: "https://open.bigmodel.cn/api/paas/v4",
  currency: "CNY",
  options: {
    apiBaseCustomizable: true,
    apiKeyCustomizable: true,
  },
  chat: {
    apiSchema: ["base", "key", "proxy"],
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 2, default: 1 },
    options: {
      modelCustomizable: true,
    },
    models: chatModels,
  },
} as IServiceProvider;
