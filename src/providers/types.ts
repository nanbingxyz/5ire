export type ProviderType =
  | "OpenAI"
  | "Google"
  | "Azure"
  | "Baidu"
  | "Anthropic"
  | "Moonshot"
  | "Mistral"
  | "DeepSeek"
  | "Ollama"
  | "LMStudio"
  | "ChatBro"
  | "5ire"
  | "Doubao"
  | "Grok"
  | "302.AI"
  | "Zhipu"
  | "Perplexity"
  | "LiteLLM";

export interface INumberRange {
  min: number;
  max: number;
  default: number | null;
  interval?: {
    leftOpen: boolean;
    rightOpen: boolean;
  };
}
export interface IVersionCapability {
  enabled: boolean;
  allowUrl?: boolean;
  allowBase64?: boolean;
  allowedMimeTypes?: string[];
}
export interface IChatModel {
  id: string;
  label?: string;
  name: string;
  description?: string | null;
  maxTokens?: number | null;
  defaultMaxTokens?: number | null;
  contextWindow: number | null;
  isDefault?: boolean;
  inputPrice: number;
  outputPrice: number;
  noStreaming?: boolean;
  extras?: { [key: string]: string };
  capabilities?: {
    json?: { enabled: boolean };
    tools?: { enabled: boolean };
    vision?: IVersionCapability;
  };
}

export interface IChatConfig {
  apiSchema: string[];
  modelExtras?: string[];
  /**
   *  Positive values penalize new tokens based on whether they appear
   *  in the text so far, increasing the model's likelihood to talk about new topics.
   */
  presencePenalty: INumberRange;
  /**
   * An alternative to sampling with temperature, called nucleus sampling,
   * where the model considers the results of the tokens with top_p probability mass.
   */
  topP: INumberRange;
  /**
   * What sampling temperature to use,
   * Higher values will make the output more random,
   * while lower values make it more focused and deterministic.
   */
  temperature: INumberRange;
  models: IChatModel[];
  docs?: { [key: string]: string };
  placeholders?: { [key: string]: string };
  options: {
    modelCustomizable?: boolean;
    streamCustomizable?: boolean;
  };
}

export interface IEmbeddingModel {
  name?: string;
  label?: string;
  price: number;
  dimension?: number;
  description?: string;
  maxTokens?: number;
  maxChars?: number;
  isDefault?: boolean;
}

export interface IEmbeddingConfig {
  apiSchema: string[];
  docs?: { [key: string]: string };
  placeholders?: { [key: string]: string };
  models: IEmbeddingModel[];
  options?: {
    modelCustomizable?: boolean;
  };
}

export interface IServiceProvider {
  name: ProviderType;
  description?: string;
  referral?: string;
  disabled?: boolean;
  isPremium?: boolean;
  isBuiltIn?: boolean;
  apiBase: string;
  apiKey?: string;
  apiVersion?: string;
  currency: "USD" | "CNY";
  options: {
    apiBaseCustomizable?: boolean;
    apiKeyCustomizable?: boolean;
    modelsEndpoint?: string;
    isApiKeyOptional?: boolean;
  };
  chat: IChatConfig;
  embedding?: IEmbeddingConfig;
}

export interface IChatModelConfig {
  id: string;
  name: string;
  label?: string;
  description?: string | null;
  maxTokens?: number | null;
  defaultMaxTokens?: number | null;
  contextWindow: number | null;
  noStreaming?: boolean;
  isDefault?: boolean;
  isBuiltIn?: boolean;
  isPremium?: boolean;
  isReady: boolean;
  isFromApi?: boolean;
  inputPrice: number;
  outputPrice: number;
  capabilities: {
    json?: { enabled: boolean };
    tools?: { enabled: boolean };
    vision?: IVersionCapability;
  };
  disabled?: boolean;
  extras?: {
    [key: string]: string;
  };
}

export interface IChatProviderConfig {
  name: string;
  referral?: string;
  schema: string[];
  description?: string;
  temperature: INumberRange;
  topP: INumberRange;
  presencePenalty: INumberRange;
  disabled: boolean;
  isBuiltIn: boolean;
  isDefault: boolean;
  isPremium: boolean;
  isReady: boolean;
  apiBase: string;
  apiKey: string;
  apiSecret?: string;
  apiVersion?: string;
  currency: "USD" | "CNY";
  modelExtras?: string[];
  modelsEndpoint?: string;
  models: IChatModelConfig[];
  proxy?: string;
}
