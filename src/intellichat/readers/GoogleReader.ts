import Debug from 'debug';
import { IChatResponseMessage } from 'intellichat/types';
import { extractFirstLevelBrackets } from 'utils/util';
import BaseReader from './BaseReader';
import { IReadResult, ITool } from './IChatReader';

const debug = Debug('5ire:intellichat:GoogleReader');

/**
 * GoogleReader handles streaming responses from Google's Gemini API.
 * It parses Google's specific response format which uses a candidates array
 * and functionCall structure for tool calls.
 */
export default class GoogleReader extends BaseReader {
  /**
   * Parses a Google API response chunk into a structured message.
   * Google responses contain a candidates array with content parts and usage metadata.
   * Returns empty content with token counts if no candidates are present.
   * @param chunk - The JSON string chunk to parse
   * @returns Parsed chat response message with content, tokens, and tool calls
   */
  protected parseReply(chunk: string): IChatResponseMessage {
    const _chunk = chunk.trim();
    try {
      const data = JSON.parse(_chunk);
      if (data.candidates) {
        const firstCandidate = data.candidates[0];
        return {
          content: firstCandidate.content.parts[0].text || '',
          isEnd: firstCandidate.finishReason,
          inputTokens: data.usageMetadata.promptTokenCount,
          outputTokens: data.usageMetadata.candidatesTokenCount,
          toolCalls: firstCandidate.content.parts[0].functionCall,
        };
      }
      return {
        content: '',
        isEnd: false,
        inputTokens: data.usageMetadata?.promptTokenCount,
        outputTokens: data.usageMetadata?.candidatesTokenCount,
      };
    } catch (err) {
      console.error('Error parsing JSON:', err);
      return {
        content: '',
        isEnd: false,
      };
    }
  }

  /**
   * Extracts tool information from Google's functionCall format.
   * Google uses a single functionCall object instead of an array of tool calls.
   * Returns null if no functionCall is present in the response.
   * @param respMsg - The response message containing potential tool calls
   * @returns Tool object with id, name, and args, or null if no tool call exists
   */
  protected parseTools(respMsg: IChatResponseMessage): ITool | null {
    if (respMsg.toolCalls) {
      return {
        id: '',
        name: respMsg.toolCalls.name,
        args: respMsg.toolCalls.args,
      };
    }
    return null;
  }

  /**
   * Extracts tool arguments from Google's functionCall structure.
   * Returns the arguments with index 0 since Google only supports single tool calls.
   * @param respMsg - The response message containing tool call arguments
   * @returns Object with index and args string, or null if no tool calls exist
   */
  protected parseToolArgs(respMsg: IChatResponseMessage): {
    index: number;
    args: string;
  } | null {
    if (respMsg.toolCalls) {
      return {
        index: 0,
        args: respMsg.toolCalls.args,
      };
    }
    return null;
  }

  /**
   * Reads and processes the Google API stream with buffer accumulation.
   * Google's streaming format may split JSON objects across chunks, so this method
   * accumulates data in a buffer and uses extractFirstLevelBrackets to extract
   * complete JSON objects. Processes each complete object and updates the buffer
   * to retain only unprocessed data. Handles any remaining buffer data at stream end.
   * @param callbacks - Object containing error handler, progress callback, and tool calls callback
   * @returns Promise resolving to the final read result with content, tool, and token counts
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
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let done = false;
    let tool = null;
    let buffer = '';

    try {
      while (!done) {
        /* eslint-disable no-await-in-loop */
        const data = await this.streamReader.read();

        done = data.done || false;
        const value = decoder.decode(data.value);

        buffer += value;

        try {
          const items = extractFirstLevelBrackets(buffer);
          if (items.length > 0) {
            for (const item of items) {
              const response = this.parseReply(item);
              content += response.content;
              if (response.inputTokens) {
                inputTokens = response.inputTokens;
              }
              if (response.outputTokens) {
                outputTokens += response.outputTokens;
              }
              if (response.toolCalls) {
                tool = this.parseTools(response);
                onToolCalls(response.toolCalls.name);
              }
              onProgress(response.content || '');
            }

            const lastItemEnd = buffer.lastIndexOf('}') + 1;
            if (lastItemEnd > 0) {
              buffer = buffer.substring(lastItemEnd);
            }
          }
        } catch (parseErr) {
          debug('JSON parsing incomplete, continuing to collect more data', parseErr);
        }
      }

      if (buffer.trim()) {
        debug('Processing remaining buffer at end of stream');
        try {
          const items = extractFirstLevelBrackets(buffer);
          for (const item of items) {
            const response = this.parseReply(item);
            content += response.content;
            if (response.inputTokens) {
              inputTokens = response.inputTokens;
            }
            if (response.outputTokens) {
              outputTokens += response.outputTokens;
            }
            if (response.toolCalls) {
              tool = this.parseTools(response);
              onToolCalls(response.toolCalls.name);
            }
            onProgress(response.content || '');
          }
        } catch (finalParseErr) {
          debug('Failed to parse remaining buffer', finalParseErr);
        }
      }
    } catch (err) {
      console.error('Read error:', err);
      onError(err);
    } finally {
      return {
        content,
        tool,
        inputTokens,
        outputTokens,
      };
    }
  }
}
