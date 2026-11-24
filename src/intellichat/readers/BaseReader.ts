/**
 * BaseReader provides base functionality for reading and parsing streaming chat responses.
 * It handles stream decoding and content aggregation, while leaving specific message
 * parsing logic to child classes.
 */
import { IChatResponseMessage } from 'intellichat/types';
import { merge } from 'lodash';
import IChatReader, { IReadResult, ITool } from './IChatReader';

export default abstract class BaseReader implements IChatReader {
  /** The stream reader for processing incoming data chunks */
  protected streamReader: ReadableStreamDefaultReader<Uint8Array>;

  /**
   * Creates a new BaseReader instance.
   * @param reader - The readable stream reader for processing data chunks
   */
  constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.streamReader = reader;
  }

  /**
   * Parse tool calls from a response message.
   * Base implementation looks for tool_calls array and returns the first tool call if found.
   * Override this method for different tool call formats.
   * @param respMsg - The response message to parse tools from
   * @returns The first tool call found, or null if none exist
   */
  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (!respMsg.toolCalls || respMsg.toolCalls.length === 0) {
      return null;
    }
    const toolCall = respMsg.toolCalls[0];
    return {
      id: toolCall.id || '',
      name: toolCall.function?.name || '',
      args: toolCall.function?.arguments || '',
    };
  }

  /**
   * Parse tool arguments from a response message.
   * Base implementation assumes arguments are JSON strings that can be concatenated.
   * Override this method for different argument formats.
   * @param respMsg - The response message to parse tool arguments from
   * @returns Object containing argument index and args string, or null if no tool calls
   */
  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    if (!respMsg.toolCalls || respMsg.toolCalls.length === 0) {
      return null;
    }

    const toolCall = respMsg.toolCalls[0];
    return {
      index: 0, // Default to first argument position
      args: toolCall.function?.arguments || '',
    };
  }

  /**
   * Parse a raw chunk into a structured message.
   * Base implementation assumes chunks are JSON strings.
   * Override this method for different message formats.
   * @param chunk - The raw chunk string to parse
   * @returns Parsed chat response message
   */
  protected parseReply(chunk: string): IChatResponseMessage {
    try {
      return JSON.parse(chunk);
    } catch (e) {
      // If parsing fails, treat the chunk as plain text content
      return {
        content: chunk,
        toolCalls: [],
        inputTokens: 0,
        outputTokens: chunk.length / 4, // Rough estimate
      };
    }
  }

  /**
   * Process a chunk of data and determine if it completes a message.
   * Base implementation treats each chunk as a complete message.
   * Override this method for streaming or multi-part messages.
   *
   * Different providers have different streaming formats:
   * - Anthropic: Each chunk is a complete JSON message with different types
   * - OpenAI: Each chunk is a complete JSON message with choices[0].delta
   * - Fire: Raw text chunks that don't need JSON parsing
   *
   * Some providers may split JSON messages across chunks, requiring combination
   * before parsing. Override shouldCombineChunks() and getCombinedChunk() to
   * implement custom combining logic.
   *
   * @param chunk - The current chunk of data to process
   * @returns A complete message if one is ready, null otherwise
   */
  protected processChunk(chunk: string): IChatResponseMessage | null {
    if (!chunk || chunk.trim() === '') {
      return null;
    }

    // Default implementation treats each chunk as a complete message
    // Subclasses should override this to handle their specific streaming format
    return this.parseReply(chunk);
  }

  /**
   * Array to store incomplete chunks that need to be combined.
   * Used when chunks are split across multiple reads and need reassembly.
   */
  private incompleteChunks: string[] = [];

  /**
   * Check if a chunk can be parsed as valid JSON.
   * Returns true if parsing fails, indicating chunks need to be combined.
   *
   * @param chunk - The chunk to check
   * @returns True if chunk should be combined with others, false if it's complete
   */
  protected shouldCombineChunks(chunk: string): boolean {
    try {
      JSON.parse(chunk);
      return false;
    } catch (e) {
      return true;
    }
  }

  /**
   * Combine chunks until we have valid JSON or reach max attempts.
   * Returns the combined chunk and whether it forms valid JSON.
   *
   * @param chunk - Current chunk to process
   * @returns Object containing the combined chunk and completion status
   */
  protected getCombinedChunk(chunk: string): {
    combinedChunk: string;
    isComplete: boolean;
  } {
    this.incompleteChunks.push(chunk);

    // Keep only last 5 chunks
    if (this.incompleteChunks.length > 5) {
      this.incompleteChunks = this.incompleteChunks.slice(-5);
    }

    const combined = this.incompleteChunks.join('');

    try {
      JSON.parse(combined);
      // Clear chunks if we successfully parsed
      this.incompleteChunks = [];
      return {
        combinedChunk: combined,
        isComplete: true,
      };
    } catch (e) {
      return {
        combinedChunk: combined,
        isComplete: false,
      };
    }
  }

  /**
   * Read and process the stream data, calling appropriate callbacks during processing.
   * @param callbacks - Object containing callback functions for error handling, progress updates, and tool calls
   * @returns Promise resolving to the final read result containing content, reasoning, tools, and token counts
   */
  public async read({
    onError,
    onProgress,
    onToolCalls,
  }: {
    onError: (error: any) => void;
    onProgress: (chunk: string) => void;
    onToolCalls: (toolCalls: any) => void;
  }): Promise<IReadResult> {
    const decoder = new TextDecoder('utf-8');
    const state = {
      content: '',
      reasoning: '',
      inputTokens: 0,
      outputTokens: 0,
      currentTool: null as any,
      toolArguments: [] as string[],
      messageIndex: 0,
    };

    try {
      await this.processStreamData(decoder, state, { onProgress, onToolCalls });

      // Finalize tool arguments if a tool was being processed
      if (state.currentTool) {
        state.currentTool.args = this.finalizeToolArguments(
          state.toolArguments,
        );
      }
      return {
        content: state.content,
        reasoning: state.reasoning,
        tool: state.currentTool,
        inputTokens: state.inputTokens,
        outputTokens: state.outputTokens,
      };
    } catch (error) {
      console.error('Stream reading error:', error);
      onError(error);
      return {
        content: state.content,
        reasoning: state.reasoning,
        tool: state.currentTool,
        inputTokens: state.inputTokens,
        outputTokens: state.outputTokens,
      };
    }
  }

  /**
   * Process the stream data by reading chunks and handling them appropriately.
   * @param decoder - Text decoder for converting bytes to strings
   * @param state - Current processing state containing content, tokens, and tool information
   * @param callbacks - Callback functions for progress updates and tool calls
   */
  private async processStreamData(
    decoder: TextDecoder,
    state: {
      content: string;
      reasoning: string;
      inputTokens: number;
      outputTokens: number;
      currentTool: any;
      toolArguments: string[];
      messageIndex: number;
    },
    callbacks: {
      onProgress: (chunk: string, reasoning?: string) => void;
      onToolCalls: (toolCalls: any) => void;
    },
  ): Promise<void> {
    let isStreamDone = false;

    while (!isStreamDone) {
      const { value, done } = await this.streamReader.read();
      if (done) break;

      const decodedValue = decoder.decode(value, { stream: true });
      const lines = this.splitIntoLines(decodedValue);

      for (const line of lines) {
        const chunks = this.extractDataChunks(line);

        for (const chunk of chunks) {
          if (chunk === '[DONE]') {
            isStreamDone = true;
            break;
          }

          // Handle chunk combining if needed
          const shouldCombine = this.shouldCombineChunks(chunk);
          const { combinedChunk, isComplete } = shouldCombine
            ? this.getCombinedChunk(chunk)
            : { combinedChunk: chunk, isComplete: true };

          // Only process the chunk if we have a complete message
          if (isComplete) {
            const completeMessage = this.processChunk(combinedChunk);
            if (completeMessage) {
              await this.processResponse(completeMessage, state, callbacks);
            }
          }
        }
      }
    }
  }

  /**
   * Split decoded stream value into individual lines, filtering out event lines.
   * @param value - The decoded string value to split
   * @returns Array of trimmed, non-empty lines
   */
  private splitIntoLines(value: string): string[] {
    return value
      .split('\n')
      .filter((line) => !line.includes('event:'))
      .map((line) => line.trim())
      .filter((line) => line !== '');
  }

  /**
   * Extract data chunks from a line by splitting on 'data:' markers.
   * @param line - The line to extract chunks from
   * @returns Array of trimmed data chunks
   */
  private extractDataChunks(line: string): string[] {
    return line
      .split('data:')
      .filter((chunk) => chunk !== '')
      .map((chunk) => chunk.trim());
  }

  /**
   * Process a complete response message and update the current state.
   * @param response - The response message to process
   * @param state - Current processing state to update
   * @param callbacks - Callback functions for progress and tool call notifications
   * @returns Promise that resolves when processing is complete
   */
  private async processResponse(
    response: IChatResponseMessage,
    state: {
      content: string;
      reasoning: string;
      inputTokens: number;
      outputTokens: number;
      currentTool: any;
      toolArguments: string[];
      messageIndex: number;
    },
    callbacks: {
      onProgress: (chunk: string) => void;
      onToolCalls: (toolCalls: any) => void;
    },
  ): Promise<void> {
    if (response.content === null && !response.toolCalls) return;

    if (state.currentTool === null) {
      const tool = this.parseTools(response);
      if (tool) {
        state.currentTool = tool;
        callbacks.onToolCalls(tool.name);
      } else {
        state.currentTool = null;
        callbacks.onToolCalls(null);
      }
    }
    if (state.currentTool) {
      this.processToolArguments(response, state);
    } else {
      this.processContentResponse(response, state, callbacks);
    }

    this.updateTokenCounts(response, state);
    state.messageIndex++;
  }

  /**
   * Process tool arguments from a response and update the state.
   * @param response - The response message containing tool arguments
   * @param state - State object containing tool arguments array and message index
   */
  private processToolArguments(
    response: IChatResponseMessage,
    state: {
      toolArguments: string[];
      messageIndex: number;
    },
  ): void {
    const argument = this.parseToolArgs(response);
    if (argument) {
      const { index } = argument;
      const arg =
        typeof argument.args === 'string'
          ? argument.args
          : JSON.stringify(argument.args);
      if (!state.toolArguments[index]) {
        state.toolArguments[index] = '';
      }
      state.toolArguments[index] += arg;
    }
  }

  /**
   * Process content response and update state with content and reasoning.
   * @param response - The response message containing content
   * @param state - State object to update with content and reasoning
   * @param callbacks - Callback functions for progress notifications
   */
  private processContentResponse(
    response: IChatResponseMessage,
    state: { content: string; reasoning: string },
    callbacks: { onProgress: (chunk: string, reasoning?: string) => void },
  ): void {
    state.content += response.content;
    state.reasoning += response.reasoning || '';
    callbacks.onProgress(response.content || '', response.reasoning || '');
  }

  /**
   * Update token counts in the state based on the response.
   * @param response - The response message containing token information
   * @param state - State object to update with token counts
   */
  private updateTokenCounts(
    response: IChatResponseMessage,
    state: { inputTokens: number; outputTokens: number },
  ): void {
    if (response.outputTokens) {
      state.outputTokens += response.outputTokens;
    }
    if (response.inputTokens) {
      state.inputTokens = response.inputTokens;
    }
  }

  /**
   * Finalize tool arguments by parsing and merging them into a single object.
   * @param toolArguments - Array of tool argument strings to finalize
   * @returns Merged object containing all parsed tool arguments
   */
  private finalizeToolArguments(toolArguments: string[]): any {
    const parsedArgs = toolArguments.map((arg) => JSON.parse(arg));
    return merge({}, ...parsedArgs);
  }
}
