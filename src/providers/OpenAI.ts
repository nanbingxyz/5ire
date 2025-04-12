import { IServiceProvider } from './types';

export default {
  name: 'OpenAI',
  apiBase: 'https://api.openai.com/v1',
  currency: 'USD',
  options: {
    apiBaseCustomizable: true,
    apiKeyCustomizable: true,
  },
  chat: {
    apiSchema: ['base', 'key', 'model'],
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 2, default: 1 },
    options: {
      modelCustomizable: true,
    },
    models: {
      o1: {
        label: 'o1',
        contextWindow: 200000,
        maxTokens: 100000,
        inputPrice: 0.015,
        outputPrice: 0.05,
        capabilities: {
          vision: {
            enabled: true,
            allowBase64: true,
            allowUrl: true,
          },
        },
        description: `The o1 reasoning model is designed to solve hard problems across domains`,
      },
      'o1-mini': {
        label: 'o1-mini',
        contextWindow: 128000,
        maxTokens: 65536,
        defaultMaxTokens: 60000,
        inputPrice: 0.0011,
        outputPrice: 0.004,
        capabilities: {
          vision: {
            enabled: true,
            allowBase64: true,
            allowUrl: true,
          },
        },
        description: `o1-mini is a faster and more affordable reasoning model`,
      },
      'o3-mini': {
        label: 'o3-mini',
        contextWindow: 200000,
        maxTokens: 100000,
        defaultMaxTokens: 100000,
        inputPrice: 0.0011,
        outputPrice: 0.004,
        capabilities: {
          tools: {
            enabled: true,
          },
        },
        isDefault: false,
        description: `o3-mini is OpenAI's most recent small reasoning model, providing high intelligence at the same cost and latency targets of o1-min`,
      },
      'gpt-4o': {
        label: 'gpt-4o',
        contextWindow: 128000,
        maxTokens: 4096,
        defaultMaxTokens: 4000,
        inputPrice: 0.005,
        outputPrice: 0.015,
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
        isDefault: true,
        description: `GPT-4o it's most advanced multimodal model of OpenAI that’s faster and cheaper than GPT-4 Turbo with stronger vision capabilities`,
      },
      'gpt-4o-mini': {
        label: 'gpt-4o-mini',
        contextWindow: 128000,
        maxTokens: 16384,
        defaultMaxTokens: 16000,
        inputPrice: 0.00015,
        outputPrice: 0.0006,
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
        description: `GPT-4o mini (“o” for “omni”) is OpenAI's advanced model in the small models category, and it's cheapest model yet. It is multimodal (accepting text or image inputs and outputting text), has higher intelligence than gpt-3.5-turbo but is just as fast. It is meant to be used for smaller tasks, including vision tasks.`,
      },
      'gpt-4-turbo': {
        label: 'gpt-4-turbo',
        contextWindow: 128000,
        maxTokens: 4096,
        defaultMaxTokens: 4000,
        inputPrice: 0.005,
        outputPrice: 0.015,
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
        description: `The latest GPT-4 Turbo model with vision capabilities.
        Vision requests can now use JSON mode and function calling.
        Currently points to gpt-4-turbo-2024-04-09.`,
      },
      'gpt-4': {
        label: 'gpt-4',
        contextWindow: 8129,
        maxTokens: 8129,
        defaultMaxTokens: 8000,
        inputPrice: 0.03,
        outputPrice: 0.06,
        capabilities: {
          tools: {
            enabled: true,
          },
        },
        description: `Snapshot of gpt-4 from June 13th 2023 with improved function calling support`,
      },
      'gpt-3.5-turbo': {
        label: 'gpt-3.5-turbo',
        contextWindow: 16385,
        maxTokens: 4096,
        defaultMaxTokens: 4000,
        inputPrice: 0.0005,
        outputPrice: 0.0015,
        capabilities: {
          tools: {
            enabled: true,
          },
        },
        description: `The latest GPT-3.5 Turbo model with higher accuracy at responding in requested formats
        and a fix for a bug which caused a text encoding issue for non-English language function calls`,
      },
    },
  },
  embedding: {
    apiSchema: ['base', 'key', 'model'],
    models: {
      'text-embedding-3-large': {
        label: 'text-embedding-3-large',
        dimension: 3072,
        price: 0.00013,
        maxTokens: 8191,
        description:
          'Most capable embedding model for both english and non-english tasks',
        isDefault: true,
      },
      'text-embedding-3-small': {
        label: 'text-embedding-3-small',
        dimension: 1536,
        price: 0.00002,
        maxTokens: 8191,
        description:
          'Increased performance over 2nd generation ada embedding model',
      },
      'text-embedding-ada-002': {
        label: 'text-embedding-ada-002',
        dimension: 1536,
        price: 0.0001,
        maxTokens: 8191,
        description:
          'Most capable 2nd generation embedding model, replacing 16 first generation models',
      },
    },
  },
} as IServiceProvider;
