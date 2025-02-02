import { IServiceProvider, IChatModel } from './types';

export interface IOllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface IOllamaModelsResponse {
  models: IOllamaModel[];
}

let cachedModels: Record<string, IChatModel> = {};

// Load cached models from electron store on initialization
const storedModels = window.electron.store.get('settings.ollama.models', {});
cachedModels = storedModels;

export async function syncOllamaModels(base: string): Promise<Record<string, IChatModel>> {
  try {
    const response = await fetch(`${base}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Ollama models: ${response.statusText}`);
    }
    const data = await response.json() as IOllamaModelsResponse;
    
    // Convert to the format expected by the provider
    const models: Record<string, IChatModel> = {};
    data.models.forEach(model => {
      models[model.name] = {
        name: model.name,
        description: `${model.details.parameter_size} parameters, ${model.details.quantization_level} quantization`,
        contextWindow: 4096, // Default context window
        maxTokens: 4096,
        group: 'Open Source',
        inputPrice: 0,
        outputPrice: 0,
      };
    });
    cachedModels = models; // Update cached models
    
    // Store models in electron store
    window.electron.store.set('settings.ollama.models', models);
    
    return models;
  } catch (error) {
    console.error('Error syncing Ollama models:', error);
    throw error;
  }
}

export default {
  name: 'Ollama',
  apiBase: '',
  currency: 'USD',
  options: {
    apiBaseCustomizable: true,
  },
  chat: {
    apiSchema: ['base', 'model'],
    docs: {
      temperature:
        'Higher values will make the output more creative and unpredictable, while lower values will make it more precise.',
      presencePenalty:
        "Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.",
      topP: 'An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with topP probability mass.',
    },
    placeholders: {
      base: 'http://127.0.0.1:11434',
    },
    presencePenalty: { min: -2, max: 2, default: 0 },
    topP: { min: 0, max: 1, default: 1 },
    temperature: { min: 0, max: 1, default: 0.9 },
    options: {
      modelCustomizable: false,
    },
    models: cachedModels, // Use cached models
  },
  embedding: {
    apiSchema: ['base', 'model'],
    placeholders: {
      base: 'http://127.0.0.1:11434',
    },
    options: {
      modelCustomizable: false,
    },
    models: {} // Embedding models not supported yet
  },
  syncModels: syncOllamaModels, // Expose sync function
} as IServiceProvider;
