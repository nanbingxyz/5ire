import { IChatModel, IServiceProvider } from 'providers/types';

export interface IChatResponseMessage {
  reasoning?: string;
  content?: string;
  function?: {
    id: string;
    name: string;
    args: any;
  };
  isEnd?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  toolCalls?: any;
  error?: {
    code?: number;
    type?: string;
    message: string;
  };
}

export interface IMCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: any;
    required: any;
    additionalProperties: any;
  };
}

export interface IOpenAITool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: any;
      required: any;
      additionalProperties: any;
    };
  };
}

export interface IAnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: any;
    required: any;
    additionalProperties: any;
  };
}

export interface IGoogleTool {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties?: any;
    required?: any;
  };
}

export interface IChatRequestMessageContent {
  type:
    | 'text'
    | 'image_url'
    | 'image'
    | 'document'
    | 'function'
    | 'tool_result'
    | 'tool_use';
  id?: string;
  name?: string;
  input?: any;
  tool_use_id?: string;
  text?: string;
  content?: any;
  image_url?: {
    url: string;
  };
  function?: {
    name: string;
    description?: string;
    parameters?: any;
  };
  source?: {
    type: string;
    media_type: string;
    data: string;
  };
}

export interface IGeminiChatRequestMessagePart {
  text?: string;
  inline_data?: {
    mimeType: string;
    data: string;
  };
  functionCall?: any;
  functionResponse?: any;
}

export interface IChatRequestMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'model';
  name?: string;
  content?: string | IChatRequestMessageContent[];
  tool_call_id?: string;
  parts?: IGeminiChatRequestMessagePart[];
  tool_calls?: any;
}

export interface IChatRequestPayload {
  model?: string;
  temperature?: number;
  max_tokens?: number | null;
  max_completion_tokens?: number | null;
  presence_penalty?: number;
  top_p?: number;
  stream?: boolean;
  prompt?: string; //ollama
  context?: number[]; // ollama
  system?: string; // baidu, anthropic, ollama
  options?: {
    temperature?: number;
    max_tokens?: number | null;
  };
  messages?: IChatRequestMessage[];
  contents?: IChatRequestMessage[];
  generationConfig?: {
    maxOutputTokens?: number;
    top_p?: number;
    temperature?: number;
  };
  tools?: any;
  tool_choice?: any;
  parallel_tool_calls?: boolean;
  tool_config?: any;
}

export type ModelGroup =
  | 'GPT-3.5'
  | 'GPT-4'
  | 'Gemini'
  | 'ERNIE'
  | 'Moonshot'
  | 'Open Source';

export interface IChatContext {
  getActiveChat: () => IChat;
  getProvider: () => IServiceProvider;
  getModel: () => IChatModel;
  getSystemMessage: () => string | null;
  getTemperature: () => number;
  getMaxTokens: () => number;
  getChatContext: () => string;
  getCtxMessages: () => IChatMessage[];
  isStream: () => boolean;
  isToolEnabled: () => boolean;
}

export interface IChat {
  id: string;
  summary: string;
  model?: string;
  systemMessage?: string | null;
  maxCtxMessages?: number;
  temperature?: number;
  stream?: boolean;
  context?: string | null;
  maxTokens?: number | null;
  createdAt: number | null;
  prompt: IPrompt | string | null;
  input: string | null;
  isPersisted?: boolean;
}

export interface IChatMessage {
  id: string;
  bookmarkId?: string | null;
  chatId: string;
  systemMessage?: string | null;
  prompt: string;
  reply: string;
  reasoning?: string;
  model: string;
  temperature: number;
  maxTokens: number | null;
  inputTokens: number;
  outputTokens: number;
  memo?: string;
  createdAt: number;
  isActive: boolean | 0 | 1;
  citedFiles?: string;
  citedChunks?: string;
}

export interface IPromptDef {
  id: string;
  name: string;
  systemMessage: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
  systemVariables?: string[];
  userVariables?: string[];
  models?: string[] | null;
  createdAt: number;
  updatedAt: number;
  pinedAt: number | null;
}

export interface IPrompt {
  id: string;
  name: string;
  systemMessage: string;
  userMessage: string;
  maxTokens?: number;
  temperature?: number;
}

export interface IStage {
  chatId: string;
  model: string;
  systemMessage?: string | null;
  prompt?: IPrompt | null;
  input?: string;
  temperature?: number;
  maxTokens?: number | null;
  maxCtxMessages?: number;
  stream?:boolean
}
