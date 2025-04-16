import useAuthStore from 'stores/useAuthStore';
import { ProviderType, IServiceProvider } from './types';
import Azure from './Azure';
import Baidu from './Baidu';
import OpenAI from './OpenAI';
import Google from './Google';
import Moonshot from './Moonshot';
import ChatBro from './ChatBro';
import Anthropic from './Anthropic';
import Fire from './Fire';
import Ollama from './Ollama';
import LMStudio from './LMStudio';
import Doubao from './Doubao';
import Grok from './Grok';
import DeepSeek from './DeepSeek';
import Mistral from './Mistral';

export const providers: { [key: string]: IServiceProvider } = {
  OpenAI,
  Anthropic,
  Azure,
  Google,
  Grok,
  Baidu,
  Mistral,
  Moonshot,
  ChatBro,
  Ollama,
  Doubao,
  DeepSeek,
  LMStudio,
  '5ire': Fire,
};

// TODO: about to remove
export function getProvider(providerName: ProviderType): IServiceProvider {
  return providers[providerName];
}

export function getBuiltInProviders(): IServiceProvider[] {
  const { session } = useAuthStore.getState();
  return Object.values(providers).filter((provider: IServiceProvider) => {
    return !!session || !provider.isPremium;
  });
}

export function getChatAPISchema(providerName: string): string[] {
  const provider = providers[providerName];
  if (!provider) {
    return OpenAI.chat.apiSchema; // Fallback to OpenAI if provider not found
  }
  return provider.chat.apiSchema;
}
