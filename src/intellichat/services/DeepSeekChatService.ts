import type { IChatContext, IChatRequestMessage } from "intellichat/types";
import { urlJoin } from "utils/util";
import DeepSeek from "../../providers/DeepSeek";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

/**
 * Chat service implementation for DeepSeek AI provider.
 * Extends OpenAIChatService to provide DeepSeek-specific functionality.
 */
export default class DeepSeekChatService extends OpenAIChatService implements INextChatService {
  /**
   * Creates a new DeepSeekChatService instance.
   * @param name - The name identifier for this chat service
   * @param chatContext - The chat context containing configuration and state
   */
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = DeepSeek;
  }

  /**
   * Formats chat request messages to ensure they are in the expected format for DeepSeek API.
   *
   * @param messages - Array of chat request messages to format
   * @param msgId - Optional message ID for context tracking
   * @returns Promise that resolves to the formatted chat request messages
   */
  protected async makeMessages(messages: IChatRequestMessage[], msgId?: string): Promise<IChatRequestMessage[]> {
    const result = await super.makeMessages(messages, msgId);

    const formated = result
      .map((msg) => {
        if (Array.isArray(msg.content)) {
          return {
            ...msg,
            content: msg.content.map((part) => part.text || "").join("\n"),
          };
        }

        return msg;
      })
      .filter(Boolean) as IChatRequestMessage[];

    return formated;
  }

  /**
   * Makes an HTTP request to the DeepSeek API for chat completions.
   * Constructs the request URL, headers, and payload specific to DeepSeek's API requirements.
   * @param messages - Array of chat request messages to send
   * @param msgId - Optional message ID for context tracking
   * @returns Promise that resolves to the HTTP response from DeepSeek API
   */
  protected async makeRequest(messages: IChatRequestMessage[], msgId?: string): Promise<Response> {
    const provider = this.context.getProvider();
    const url = urlJoin("/chat/completions", provider.apiBase.trim());
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey.trim()}`,
    };
    const isStream = this.context.isStream();
    const payload = await this.makePayload(messages, msgId);
    return this.makeHttpRequest(url, headers, payload, isStream);
  }
}
