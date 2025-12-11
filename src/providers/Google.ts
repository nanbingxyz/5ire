import { IServiceProvider } from './types';

const chatModels = [
  {
    id: 'gemini-3-pro-preview',
    name: 'gemini-3-pro-preview',
    label: 'gemini-3-pro-preview',
    contextWindow: 1048576,
    maxTokens: 65536,
    defaultMaxTokens: 32000,
    inputPrice: 0.002,
    outputPrice: 0.012,
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
    description: `The best model in the world for multimodal understanding, and Google's most powerful agentic and vibe-coding model yet.`,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'gemini-2.5-pro',
    label: 'gemini-2.5-pro',
    contextWindow: 1048576,
    maxTokens: 65536,
    defaultMaxTokens: 32000,
    inputPrice: 0.00125,
    outputPrice: 0.01,
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
    description: `Google's state-of-the-art thinking model, capable of reasoning over complex problems in code, math, and STEM, as well as analyzing large datasets, codebases, and documents using long context.`,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'gemini-2.5-flash-preview-09-2025',
    label: 'gemini-2.5-flash-preview',
    contextWindow: 1048576,
    maxTokens: 65536,
    defaultMaxTokens: 8000,
    inputPrice: 0.0003,
    outputPrice: 0.0025,
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
    description: `Google's best model in terms of price-performance, offering well-rounded capabilities. 2.5 Flash is best for large scale processing, low-latency, high volume tasks that require thinking, and agentic use cases.`,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'gemini-2.5-flash-lite-preview-09-2025',
    label: 'gemini-2.5-flash-lite-preview',
    contextWindow: 1048576,
    maxTokens: 65536,
    defaultMaxTokens: 8000,
    inputPrice: 0.0001,
    outputPrice: 0.0004,
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
    description: `Google's fastest flash model optimized for cost-efficiency and high throughput.`,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'gemini-2.0-flash',
    label: 'gemini-2.0-flash',
    contextWindow: 1048576,
    maxTokens: 8192,
    defaultMaxTokens: 8000,
    inputPrice: 0.0001,
    outputPrice: 0.0004,
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
        allowUrl: false,
      },
    },
    description: `Google's second generation workhorse model, with a 1 million token context window.`,
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'gemini-2.0-flash-lite',
    label: 'gemini-2.0-flash-lite',
    contextWindow: 1048576,
    maxTokens: 8192,
    defaultMaxTokens: 8000,
    inputPrice: 0.000075,
    outputPrice: 0.0003,
    isDefault: true,
    capabilities: {
      tools:{
        enabled: true,
      },
      json: {
        enabled: true,
      },
      vision: {
        enabled: true,
        allowBase64: true,
        allowUrl: false,
      },
    },
    description: `Google's second generation small workhorse model, with a 1 million token context window.`,
  },
];

export default {
  name: 'Google',
  apiBase: 'https://generativelanguage.googleapis.com',
  currency: 'USD',
  options: {
    apiBaseCustomizable: true,
    apiKeyCustomizable: true,
  },
  chat: {
    apiSchema: ['base', 'key', 'proxy'],
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 1, default: 0.9 },
    options: {
      modelCustomizable: true,
      streamCustomizable: false,
    },
    models: chatModels,
  },
} as IServiceProvider;
