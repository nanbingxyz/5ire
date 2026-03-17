import type { ContentBlock as MCPContentBlock } from "@modelcontextprotocol/sdk/types.js";
import Debug from "debug";
import {
  type FinalContentBlock,
  ContentBlockConverter as MCPContentBlockConverter,
} from "intellichat/mcp/ContentBlockConverter";
import AnthropicReader from "intellichat/readers/AnthropicReader";
import type { ITool } from "intellichat/readers/IChatReader";
import type {
  IAnthropicTool,
  IChatContext,
  IChatMessage,
  IChatRequestMessage,
  IChatRequestMessageContent,
  IChatRequestPayload,
  IMCPTool,
  IOpenAITool,
  StructuredPrompt,
} from "intellichat/types";
import { getBase64, removeAdditionalProperties, splitByImg, stripHtmlTags, urlJoin } from "utils/util";
import { isBlank } from "utils/validators";
import Anthropic from "../../providers/Anthropic";
import type INextChatService from "./INextCharService";
import NextChatService from "./NextChatService";

// eslint-disable-next-line import/order
// import { isPlainObject, omit } from 'lodash';

const debug = Debug("5ire:intellichat:AnthropicChatService");
const EMPTY_TOOL_RESULT_FALLBACK = "[Tool returned empty content]";

/**
 * Chat service implementation for Anthropic API integration.
 * Extends NextChatService to provide Anthropic-specific functionality for chat interactions.
 */
export default class AnthropicChatService extends NextChatService implements INextChatService {
  /**
   * Creates a new AnthropicChatService instance.
   * @param {string} name - The name identifier for this chat service
   * @param {IChatContext} context - The chat context containing configuration and state
   */
  constructor(name: string, context: IChatContext) {
    super({
      name,
      context,
      provider: Anthropic,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  private normalizeAnthropicContentParts(content: IChatRequestMessageContent[]): IChatRequestMessageContent[] {
    const normalized: IChatRequestMessageContent[] = [];

    content.forEach((item) => {
      if (item.type === "text") {
        if (typeof item.text === "string" && item.text.trim().length > 0) {
          normalized.push({
            type: "text",
            text: item.text,
          });
        } else {
          debug("Warning: Empty text content block dropped for Anthropic payload");
        }
        return;
      }

      if (item.type === "image_url") {
        const url = item.image_url?.url?.trim();
        if (!url) {
          debug("Warning: image_url content without url dropped for Anthropic payload");
          return;
        }
        normalized.push({
          type: "image",
          source: {
            type: "url",
            url,
          },
        } as unknown as IChatRequestMessageContent);
        return;
      }

      if (item.type === "image") {
        normalized.push(item);
        return;
      }

      if (item.type === "tool_use") {
        if (!item.id || !item.name) {
          debug("Warning: tool_use content without id/name dropped for Anthropic payload");
          return;
        }
        normalized.push({
          type: "tool_use",
          id: item.id,
          name: item.name,
          input: item.input ?? {},
        });
        return;
      }

      if (item.type === "tool_result") {
        if (!item.tool_use_id) {
          debug("Warning: tool_result content without tool_use_id dropped for Anthropic payload");
          return;
        }

        let toolResultContent = item.content;
        if (typeof toolResultContent === "string" && toolResultContent.trim().length === 0) {
          toolResultContent = EMPTY_TOOL_RESULT_FALLBACK;
        }

        normalized.push({
          type: "tool_result",
          tool_use_id: item.tool_use_id,
          content: toolResultContent,
        });
        return;
      }

      if (item.type === "audio") {
        debug("Warning: Audio content type is not supported for Anthropic payload, dropped");
        return;
      }

      debug(`Warning: Unknown content type '${item.type}', dropped for Anthropic payload`);
    });

    return normalized;
  }

  /**
   * Creates tool messages for Anthropic API format.
   * Converts tool execution results into the message format expected by Anthropic.
   * Note: mimeType is not supported in tool inputs and will be removed.
   * @param {ITool} tool - The tool that was executed
   * @param {any} toolResult - The result returned from tool execution
   * @param {string} [content] - Optional additional content to include in the assistant message
   * @returns {IChatRequestMessage[]} Array of messages representing the tool use and result
   */
  // eslint-disable-next-line class-methods-use-this
  protected async makeToolMessages(tool: ITool, toolResult: any, content?: string): Promise<IChatRequestMessage[]> {
    /**
     * Note：not supported tool's inputs
     * 1.mimeType
     */
    // if (isPlainObject(toolResult.content)) {
    //   delete toolResult.content.mimeType;
    // } else if (Array.isArray(toolResult.content)) {
    //   toolResult.content = toolResult.content.map((item: any) => {
    //     return omit(item, ['mimeType']);
    //   });
    // }

    const parts = [];

    if (typeof toolResult === "string") {
      const toolResultText = toolResult.trim().length > 0 ? toolResult : EMPTY_TOOL_RESULT_FALLBACK;
      parts.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: toolResultText,
      });
    }

    if (toolResult.isError) {
      parts.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: JSON.stringify(toolResult.error),
      });
    }

    if (!toolResult.isError && toolResult.content) {
      const contentParts = Array.isArray(toolResult.content) ? toolResult.content : [];

      const convertedBlocks: FinalContentBlock[] = [];

      await Promise.all(
        contentParts.map(async (block: MCPContentBlock) => {
          convertedBlocks.push(
            await MCPContentBlockConverter.convert(block, (uri) => {
              return window.electron.mcp.readResource(tool.name.split("--")[0], uri).then((result) => {
                if (result.isError) {
                  return [];
                }

                return result.contents;
              });
            }),
          );
        }),
      );

      if (convertedBlocks.every((item) => item.type === "text")) {
        const toolResultText = convertedBlocks
          .map((item) => item.text)
          .filter((text) => text.trim().length > 0)
          .join("\n\n\n");

        parts.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: toolResultText || EMPTY_TOOL_RESULT_FALLBACK,
        });
      } else {
        parts.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: `NOTE: This tool output is only a placeholder. See the following parts of this message for the actual tool result. Please use that for processing.`,
        });

        // eslint-disable-next-line no-restricted-syntax
        for (const item of convertedBlocks) {
          parts.push(MCPContentBlockConverter.contentBlockToLegacyMessageContent(item));
        }
      }
    }

    const result = [
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: tool.id,
            name: tool.name,
            input: tool.args ?? {},
          },
        ],
      },
      {
        role: "user",
        content: parts,
      },
    ] as IChatRequestMessage[];
    if (content && content.trim().length > 0) {
      (result[0].content as any[]).unshift({
        type: "text",
        text: content,
      });
    }
    return result;
  }

  /**
   * Converts an MCP tool definition to Anthropic tool format.
   * Transforms the tool schema to match Anthropic's expected structure.
   * @param {IMCPTool} tool - The MCP tool definition to convert
   * @returns {IOpenAITool | IAnthropicTool} The tool in Anthropic format
   */
  // eslint-disable-next-line class-methods-use-this
  protected makeTool(tool: IMCPTool): IOpenAITool | IAnthropicTool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: tool.inputSchema.type,
        properties: removeAdditionalProperties(tool.inputSchema.properties) || {},
        required: tool.inputSchema.required || [],
      },
    };
  }

  /**
   * Returns the reader class type for processing Anthropic responses.
   * @returns {typeof AnthropicReader} The AnthropicReader class
   */
  // eslint-disable-next-line class-methods-use-this
  protected getReaderType() {
    return AnthropicReader;
  }

  /**
   * Converts prompt content to the format expected by Anthropic API.
   * Handles both text-only content and multimodal content with images.
   * @param {string} content - The raw content string that may contain HTML and images
   * @returns {Promise<string | IChatRequestMessageContent[]>} Processed content as string or structured content array
   * @throws {Error} When an unknown message type is encountered during processing
   */
  protected async convertPromptContent(content: string): Promise<string | IChatRequestMessageContent[]> {
    if (this.context.getModel().capabilities.vision?.enabled) {
      const items = splitByImg(content);
      const promises = items.map(async (item) => {
        if (item.type === "image") {
          let data = "";
          if (item.dataType === "URL") {
            data = await getBase64(item.data);
          } else {
            [, data] = item.data.split(","); // remove data:image/png;base64,
          }
          return {
            type: "image",
            source: {
              type: "base64",
              media_type: item.mimeType as string,
              data,
            },
          };
        }
        if (item.type === "text") {
          return {
            type: "text",
            text: item.data,
          };
        }
        throw new Error("Unknown message type");
      });

      const result = (await Promise.all(promises)) as IChatRequestMessageContent[];
      return result;
    }
    return stripHtmlTags(content);
  }

  /**
   * Prepares messages for the Anthropic API request.
   * Combines context messages with new messages and processes tool-related content.
   * @param {IChatRequestMessage[]} messages - The new messages to process
   * @param {string} [msgId] - Optional message ID for context retrieval
   * @returns {Promise<IChatRequestMessage[]>} Array of processed messages ready for API request
   */
  protected async makeMessages(messages: IChatRequestMessage[], msgId?: string): Promise<IChatRequestMessage[]> {
    const result = this.context.getCtxMessages(msgId).reduce((acc: IChatRequestMessage[], msg: IChatMessage) => {
      const msgs: IChatRequestMessage[] = [];

      if (msg.structuredPrompts) {
        let strucuredPrompts: StructuredPrompt[];

        try {
          strucuredPrompts = JSON.parse(msg.structuredPrompts);
        } catch (e) {
          throw new Error("Failed to parse structuredPrompts");
        }

        strucuredPrompts.forEach((message) => {
          msgs.push({
            role: message.role,
            content: message.content,
          });
        });
      } else {
        msgs.push({
          role: "user",
          content: msg.prompt,
        });
      }

      msgs.push({
        role: "assistant",
        content: msg.reply,
      });

      return [...acc, ...msgs] as IChatRequestMessage[];
    }, []);

    const processedMessages = (
      await Promise.all(
        messages.map(async (msg): Promise<IChatRequestMessage | null> => {
          if (msg.role === "tool") {
            if (!msg.tool_call_id) {
              debug("Warning: tool message without tool_call_id dropped for Anthropic payload");
              return null;
            }

            const serializedContent =
              typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? null);

            const toolResultContent =
              serializedContent.trim().length > 0 ? serializedContent : EMPTY_TOOL_RESULT_FALLBACK;

            return {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: msg.tool_call_id,
                  content: toolResultContent,
                },
              ],
            };
          }
          if (msg.role === "assistant" && msg.tool_calls) {
            return msg;
          }
          const { content } = msg;
          if (typeof content === "string") {
            const convertedContent = await this.convertPromptContent(content);
            if (typeof convertedContent === "string") {
              if (convertedContent.trim().length === 0) {
                debug(`Warning: Empty string content dropped for role '${msg.role}' in Anthropic payload`);
                return null;
              }
              return {
                role: msg.role,
                content: convertedContent,
              };
            }

            const normalized = this.normalizeAnthropicContentParts(convertedContent);
            if (normalized.length === 0) {
              debug(`Warning: Empty content parts dropped for role '${msg.role}' in Anthropic payload`);
              return null;
            }

            return {
              role: msg.role,
              content: normalized,
            };
          }

          if (Array.isArray(content)) {
            const normalized = this.normalizeAnthropicContentParts(content);

            if (normalized.length === 0) {
              debug(`Warning: Empty content parts dropped for role '${msg.role}' in Anthropic payload`);
              return null;
            }

            return {
              role: msg.role,
              content: normalized,
            };
          }

          debug(`Warning: Unsupported content format dropped for role '${msg.role}' in Anthropic payload`);

          return null;
        }),
      )
    ).filter((item): item is IChatRequestMessage => item !== null);

    return [...result, ...processedMessages];
  }

  /**
   * Creates the complete payload for Anthropic API requests.
   * Assembles all necessary parameters including model, messages, tools, and configuration.
   * @param {IChatRequestMessage[]} messages - The messages to include in the request
   * @param {string} [msgId] - Optional message ID for context retrieval
   * @returns {Promise<IChatRequestPayload>} Complete payload object for the API request
   */
  protected async makePayload(messages: IChatRequestMessage[], msgId?: string): Promise<IChatRequestPayload> {
    const payload: IChatRequestPayload = {
      model: this.getModelName(),
      messages: await this.makeMessages(messages, msgId),
      temperature: this.context.getTemperature(),
      stream: true,
    };
    const systemMessage = this.context.getSystemMessage();
    if (!isBlank(systemMessage)) {
      payload.system = systemMessage as string;
    }
    if (this.context.getMaxTokens()) {
      payload.max_tokens = this.context.getMaxTokens();
    }
    if (this.isToolsEnabled()) {
      const tools = await window.electron.mcp.listTools();
      if (tools) {
        const unusedTools = tools.tools
          .filter((tool: any) => !this.usedToolNames.includes(tool.name))
          .map((tool: any) => {
            return this.makeTool(tool);
          });
        if (unusedTools.length > 0) {
          payload.tools = unusedTools;
          payload.tool_choice = {
            type: "auto",
            disable_parallel_tool_use: true,
          };
        }
      }
    }
    if (this.context.getMaxTokens()) {
      payload.max_tokens = this.context.getMaxTokens();
    }
    return payload;
  }

  /**
   * Makes an HTTP request to the Anthropic API.
   * Constructs the request with proper headers and authentication for Anthropic's API.
   * @param {IChatRequestMessage[]} messages - The messages to send in the request
   * @param {string} [msgId] - Optional message ID for context retrieval
   * @returns {Promise<Response>} The HTTP response from the Anthropic API
   */
  protected async makeRequest(messages: IChatRequestMessage[], msgId?: string): Promise<Response> {
    const payload = await this.makePayload(messages, msgId);
    debug("About to make a request, payload:\r\n", payload);
    const provider = this.context.getProvider();
    const url = urlJoin("/messages", provider.apiBase.trim());
    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": provider.apiKey.trim(),
    };
    const isStream = this.context.isStream();
    return this.makeHttpRequest(url, headers, payload, isStream);
  }
}
