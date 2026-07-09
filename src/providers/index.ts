import AI302 from "./AI302";
import Anthropic from "./Anthropic";
import Azure from "./Azure";
import Baidu from "./Baidu";
import DeepSeek from "./DeepSeek";
import Doubao from "./Doubao";
import Fire from "./Fire";
import Google from "./Google";
import Grok from "./Grok";
import LiteLLM from "./LiteLLM";
import LMStudio from "./LMStudio";
import Mistral from "./Mistral";
import Moonshot from "./Moonshot";
import Ollama from "./Ollama";
import OpenAI from "./OpenAI";
import Perplexity from "./Perplexity";
import type { IServiceProvider, ProviderType } from "./types";
import UnoRouter from "./UnoRouter";
import Zhipu from "./Zhipu";

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
  "302.AI": AI302,
  "5ire": Fire,
  LiteLLM,
  UnoRouter,
};

export function getBuiltInProvider(providerName: ProviderType): IServiceProvider {
  return providers[providerName];
}

export function getBuiltInProviders(): IServiceProvider[] {
  return Object.values(providers);
}

export function getChatAPISchema(providerName: string): string[] {
  const provider = providers[providerName];
  if (!provider) {
    return OpenAI.chat.apiSchema; // Fallback to OpenAI if provider not found
  }
  return provider.chat.apiSchema;
}
