export type ProviderType =
  | 'OpenAI'
  | 'Google'
  | 'Azure'
  | 'Baidu'
  | 'Anthropic'
  | 'Moonshot'
  | 'Mistral'
  | 'DeepSeek'
  | 'Ollama'
  | 'LMStudio'
  | 'ChatBro'
  | '5ire'
  | 'Doubao'
  | 'Grok'

export interface INumberRange {
  min: number;
  max: number;
  default: number|null;
  interval?: {
    leftOpen: boolean;
    rightOpen: boolean;
  };
}

export type ChatModelGroup =
  | 'O'
  | 'GPT-3.5'
  | 'GPT-4'
  | 'Gemini'
  | 'Grok'
  | 'DeepSeek'
  | 'ERNIE'
  | 'Moonshot'
  | 'Mistral'
  | 'Ministral'
  | 'Codestral'
  | 'Pixtral'
  | 'Claude-3'
  | 'Claude-3.5'
  | 'Doubao-Pro'
  | 'Doubao-Lite'
  | 'Open Source';


export interface IChatModelVision{
  enabled: boolean;
  allowUrl?: boolean;
  allowBase64?: boolean;
  allowedMimeTypes?: string[];
}

export interface IChatModelPdf {
  enabled: boolean;
  allowUrl?: boolean;
  allowBase64?: boolean;
  allowedMimeTypes?: string[];
}

export interface IChatModel {
  label?: string;
  name: string;
  description?: string | null;
  maxTokens?: number | null;
  defaultMaxTokens?: number | null;
  contextWindow: number | null;
  isDefault?: boolean;
  inputPrice: number;
  outputPrice: number;
  jsonModelEnabled?: boolean;
  toolEnabled?: boolean;
  vision?: IChatModelVision;
  pdfSupport? : IChatModelPdf;
  endpoint?: string;
  group: ChatModelGroup;
}

export interface IChatConfig {
  apiSchema: string[];
  /**
   *  Positive values penalize new tokens based on whether they appear
   *  in the text so far, increasing the model's likelihood to talk about new topics.
   */
  presencePenalty?: INumberRange;
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
  models: { [key: string]: IChatModel };
  docs?: { [key: string]: string };
  placeholders?: { [key: string]: string };
  options: {
    modelCustomizable?: boolean;
    streamCustomizable?: boolean;
  };
}

export interface IEmbeddingModel {
  name: string;
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
  models:  { [key: string]: IEmbeddingModel };
  options?: {
    modelCustomizable?: boolean;
  };
}

export interface IServiceProvider {
  name: ProviderType;
  description?: string;
  disabled?: boolean;
  isPremium?: boolean;
  apiBase: string;
  apiKey?: string;
  currency: 'USD' | 'CNY';
  options: {
    apiBaseCustomizable?: boolean;
    apiKeyCustomizable?: boolean;
    modelsEndpoint?:string
  };
  chat: IChatConfig;
  embedding?: IEmbeddingConfig;
}
