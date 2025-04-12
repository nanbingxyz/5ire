import { IServiceProvider } from './types';

export default {
  name: 'Mistral',
  apiBase: 'https://api.mistral.ai/v1',
  currency: 'USD',
  options: {
    apiBaseCustomizable: true,
    apiKeyCustomizable: true,
  },
  chat: {
    apiSchema: ['base', 'key', 'model'],
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 1, default: 0.9 },
    options: {
      modelCustomizable: true,
    },
    models: {
      'codestral-latest': {
        label: 'codestral-latest',
        contextWindow: 32000,
        maxTokens: 4096,
        defaultMaxTokens: 2048,
        inputPrice: 0.0003,
        outputPrice: 0.0009,
        capabilities: {
          tools: {
            enabled: true,
          },
        },
        isDefault: true,
        description: `Mistrals's cutting-edge language model for coding with the second version released January 2025, Codestral specializes in low-latency, high-frequency tasks such as fill-in-the-middle (FIM), code correction and test generation.`,
        group: 'Codestral',
      },
      'mistral-large-latest': {
        label: 'mistral-large-latest',
        contextWindow: 131000,
        maxTokens: 4096,
        defaultMaxTokens: 2048,
        inputPrice: 0.002,
        outputPrice: 0.006,
        capabilities: {
          tools: {
            enabled: true,
          },
        },
        description: `Mistrals's top-tier reasoning model for high-complexity tasks with the lastest version released November 2024`,
      },
      'mistral-small-latest': {
        label: 'mistral-small-latest',
        contextWindow: 32000,
        maxTokens: 4096,
        defaultMaxTokens: 2048,
        inputPrice: 0.0001,
        outputPrice: 0.0003,
        capabilities: {
          tools: {
            enabled: true,
          },
        },
        description: `Mistrals's top-tier reasoning model for high-complexity tasks with the lastest version released November 2024`,
      },
      'pixtral-large-latest': {
        label: 'pixtral-large-latest',
        contextWindow: 128000,
        maxTokens: 4096,
        defaultMaxTokens: 2048,
        inputPrice: 0.002,
        outputPrice: 0.006,
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
        description: `Mistrals's frontier-class multimodal model released November 2024.`,
      },
      'ministral-8b-latest': {
        label: 'ministral-8b-latest',
        contextWindow: 128000,
        maxTokens: 4096,
        defaultMaxTokens: 2048,
        inputPrice: 0.0001,
        outputPrice: 0.0001,
        capabilities: {
          tools: {
            enabled: true,
          },
          json: {
            enabled: true,
          },
        },
        description: `Powerful edge model with extremely high performance/price ratio`,
      },
      'ministral-3b-latest': {
        label: 'ministral-3b-latest',
        contextWindow: 128000,
        maxTokens: 4096,
        defaultMaxTokens: 2048,
        inputPrice: 0.00004,
        outputPrice: 0.00004,
        capabilities: {
          tools: {
            enabled: true,
          },
          json: {
            enabled: true,
          },
        },
        description: `World’s best edge model`,
      },
    },
  },
} as IServiceProvider;
