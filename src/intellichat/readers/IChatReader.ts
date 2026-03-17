export interface ITool {
  id: string;
  name: string;
  args?: any;
  rawFunctionCall?: Record<string, any>;
}

export interface IReadResult {
  content: string;
  reasoning?: string;
  tool?: ITool | null;
  inputTokens?: number;
  outputTokens?: number;
}
export default interface IChatReader {
  read({
    onError,
    onProgress,
    onToolCalls,
  }: {
    onError: (error: any) => void;
    onProgress: (chunk: string, reasoning?: string) => void;
    onToolCalls: (toolCalls: any) => void;
  }): Promise<IReadResult>;
}
