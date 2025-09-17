import { ProviderType, IServiceProvider } from './types';
import Azure from './Azure';
import Baidu from './Baidu';
import OpenAI from './OpenAI';
import Google from './Google';
import Moonshot from './Moonshot';
import Anthropic from './Anthropic';
import Fire from './Fire';
import Ollama from './Ollama';
import LMStudio from './LMStudio';
import Doubao from './Doubao';
import Grok from './Grok';
import DeepSeek from './DeepSeek';
import Mistral from './Mistral';
import Perplexity from './Perplexity';
import AI302 from './AI302';
import Zhipu from './Zhipu';

/**
 * Registry of all available service providers mapped by their names.
 * Contains implementations for various AI service providers including OpenAI, Anthropic, Google, and others.
 */
export const providers: { [key: string]: IServiceProvider } = {
  OpenAI,
  Anthropic,
  Azure,
  Google,
  Grok,
  Baidu,
  Mistral,
  Moonshot,
  Ollama,
  Doubao,
  DeepSeek,
  LMStudio,
  Zhipu,
  Perplexity,
  '302.AI': AI302,
  '5ire': Fire,
};

/**
 * Retrieves a built-in service provider by name.
 * @param providerName - The name of the provider to retrieve
 * @returns The service provider implementation
 */
export function getBuiltInProvider(
  providerName: ProviderType,
): IServiceProvider {
  return providers[providerName];
}

/**
 * Returns an array of all available built-in service providers.
 * @returns Array containing all registered service provider implementations
 */
export function getBuiltInProviders(): IServiceProvider[] {
  return Object.values(providers);
}

/**
 * Gets the chat API schema for a specific provider.
 * @param providerName - The name of the provider to get the schema for
 * @returns Array of strings representing the API schema, defaults to OpenAI schema if provider not found
 */
export function getChatAPISchema(providerName: string): string[] {
  const provider = providers[providerName];
  if (!provider) {
    return OpenAI.chat.apiSchema; // Fallback to OpenAI if provider not found
  }
  return provider.chat.apiSchema;
}
