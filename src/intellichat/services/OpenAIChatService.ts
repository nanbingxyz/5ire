import type { ContentBlock as MCPContentBlock } from "@modelcontextprotocol/sdk/types.js";
import Debug from "debug";
import { ContentBlockConverter as MCPContentBlockConverter } from "intellichat/mcp/ContentBlockConverter";
import type { ITool } from "intellichat/readers/IChatReader";
import OpenAIReader from "intellichat/readers/OpenAIReader";
import type {
  IAnthropicTool,
  IChatContext,
  IChatMessage,
  IChatRequestMessage,
  IChatRequestMessageContent,
  IChatRequestPayload,
  IGoogleTool,
  IMCPTool,
  IOpenAITool,
  StructuredPrompt,
} from "intellichat/types";
import Ollama from "providers/Ollama";
import { splitByImg, stripHtmlTags, urlJoin } from "utils/util";
import { isBlank } from "utils/validators";
import OpenAI from "../../providers/OpenAI";
import type INextChatService from "./INextCharService";
import NextChatService from "./NextChatService";

const debug = Debug("5ire:intellichat:OpenAIChatService");

const MODEL_PREFIX_USES_MAX_COMPLETION_TOKENS = ["gpt-5", "o1", "o3", "o4"];
export default class OpenAIChatService extends NextChatService implements INextChatService {
  constructor(name: string, context: IChatContext) {
    super({
      name,
      context,
      provider: OpenAI,
    });
  }

  // eslint-disable-next-line class-methods-use-this
  protected getReaderType() {
    return OpenAIReader;
  }

  protected async convertPromptContent(
    content: string,
  ): Promise<string | IChatRequestMessageContent[] | Partial<IChatRequestMessageContent>> {
    if (this.context.getModel().capabilities.vision?.enabled) {
      const items = splitByImg(content);
      const result: IChatRequestMessageContent[] = [];
      items.forEach((item: any) => {
        if (item.type === "image") {
          result.push({
            type: "image_url",
            image_url: {
              url: item.data,
            },
          });
        } else if (item.type === "text") {
          result.push({
            type: "text",
            text: item.data,
          });
        } else {
          throw new Error("Unknown message type");
        }
      });
      return result;
    }
    return stripHtmlTags(content);
  }

  /**
   * Filter out image content from the messages if vision is not enabled
   *
   * @param {IChatRequestMessage[]} messages - Array of messages
   * @returns {Promise<IChatRequestMessage[]>} Array of messages with image content filtered if vision is not enabled
   */
  private async filterMessagesByCapabilities(messages: IChatRequestMessage[]) {
    const isVisionEnabled = Boolean(this.context.getModel().capabilities.vision?.enabled);

    const sanitized = messages.map((message) => {
      let { content } = message;

      if (Array.isArray(content)) {
        content = content.filter((item) => {
          if (item.type === "text") {
            return true;
          }

          if (item.type === "image" || item.type === "image_url") {
            return isVisionEnabled;
          }

          return false;
        });
      }

      return { ...message, content };
    });

    return sanitized;
  }

  // eslint-disable-next-line class-methods-use-this
  protected async makeMessages(messages: IChatRequestMessage[], msgId?: string): Promise<IChatRequestMessage[]> {
    const result = [];
    const model = this.context.getModel();
    const systemMessage = this.context.getSystemMessage();
    let sysRole = this.getSystemRoleName();
    if (["o1", "o3"].some((prefix) => model.name.startsWith(prefix))) {
      sysRole = "user"; // right now, o1, o3 models are not compatible with the system message
    }
    if (!isBlank(systemMessage)) {
      result.push({
        role: sysRole,
        content: systemMessage,
      });
    }
    this.context.getCtxMessages(msgId).forEach((msg: IChatMessage) => {
      if (msg.structuredPrompts) {
        let strucuredPrompts: StructuredPrompt[];

        try {
          strucuredPrompts = JSON.parse(msg.structuredPrompts);
        } catch (e) {
          throw new Error("Failed to parse structuredPrompts");
        }

        strucuredPrompts.forEach((message) => {
          result.push({
            role: message.role,
            content: message.content,
          });
        });
      } else {
        result.push({
          role: "user",
          content: msg.prompt,
        });
      }
      result.push({
        role: "assistant",
        content: msg.reply,
      });
    });

    const processedMessages = await Promise.all(
      messages.map(async (msg) => {
        if (msg.role === "tool") {
          // Helper function to format tool message content
          const formatToolMsgContent = (content: any): string => {
            if (typeof content === "string") {
              return content;
            }

            if (Array.isArray(content)) {
              return content
                .map((item) => {
                  if (typeof item === "string") return item;
                  if (item && typeof item === "object") {
                    if (item.type === "text" && typeof item.text === "string") {
                      return item.text;
                    }
                    return JSON.stringify(item);
                  }

                  return String(item);
                })
                .join(" ");
            }

            if (content && typeof content === "object") {
              if ("type" in content && content.type === "text" && typeof content.text === "string") {
                return content.text;
              }
            }

            return String(content);
          };

          return {
            role: "tool",
            content: formatToolMsgContent(msg.content),
            name: msg.name,
            tool_call_id: msg.tool_call_id,
          };
        }
        if (msg.role === "assistant" && msg.tool_calls) {
          return msg;
        }
        const { content } = msg;
        if (typeof content === "string") {
          const formattedContent = await this.convertPromptContent(content);
          // Note: Ollama's API requires the content to be in a specific format
          if (this.name === Ollama.name) {
            return {
              role: "user",
              ...(formattedContent as Partial<IChatRequestMessageContent>),
            };
          }
          return {
            role: "user",
            content: formattedContent,
          };
        }

        if (Array.isArray(content)) {
          return {
            role: msg.role,
            content: content.map((item) => {
              if (item.type === "text") {
                return {
                  type: "text",
                  text: item.text ?? "",
                };
              }

              if (item.type === "image_url") {
                return {
                  type: "image_url",
                  image_url: item.image_url,
                };
              }

              if (item.type === "audio") {
                const fmt = item.source?.media_type ? item.source.media_type.split("/")[1] : "mpeg";

                return {
                  type: "input_audio",
                  input_audio: {
                    data: item.source?.data || "",
                    format: fmt,
                  },
                };
              }

              debug(`Warning: Unknown content type '${item.type}', converting to empty text`);
              return {
                type: "text",
                text: "",
              };
            }),
          };
        }

        console.log("msg", msg);

        return {
          role: msg.role,
          content: "",
        };
      }),
    );

    result.push(...processedMessages);

    return this.filterMessagesByCapabilities(result as IChatRequestMessage[]);
  }

  // eslint-disable-next-line class-methods-use-this
  protected makeTool(tool: IMCPTool): IOpenAITool | IAnthropicTool | IGoogleTool {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description?.substring(0, 1000), // some models have a limit on the description length, like gpt series, so we truncate it
        parameters: {
          type: tool.inputSchema.type,
          properties: tool.inputSchema.properties || {},
          required: tool.inputSchema.required || [],
          additionalProperties: tool.inputSchema.additionalProperties || false,
        },
      },
    };
  }

  // eslint-disable-next-line class-methods-use-this
  protected async makeToolMessages(tool: ITool, toolResult: any): Promise<IChatRequestMessage[]> {
    let supplement: IChatRequestMessage | undefined;

    const toolMessageContent: IChatRequestMessageContent[] = [];

    console.log("tool", tool);

    if (typeof toolResult === "string") {
      toolMessageContent.push({
        type: "text",
        text: toolResult,
      });
    }

    if (toolResult.isError) {
      toolMessageContent.push({
        type: "text",
        text: JSON.stringify(toolResult.content?.[0] || toolResult.content),
      });
    }

    if (!toolResult.isError && toolResult.content) {
      const content = Array.isArray(toolResult.content) ? toolResult.content : [];

      const convertedBlocks = await Promise.all(
        content.map((block: MCPContentBlock) =>
          MCPContentBlockConverter.convert(block, (uri) => {
            return window.electron.mcp.readResource(tool.name.split("--")[0], uri).then((result) => {
              if (result.isError) {
                return [];
              }

              return result.contents;
            });
          }),
        ),
      );

      if (convertedBlocks.every((item) => item.type === "text")) {
        // eslint-disable-next-line no-restricted-syntax
        for (const block of convertedBlocks) {
          toolMessageContent.push(MCPContentBlockConverter.contentBlockToLegacyMessageContent(block));
        }
      } else {
        toolMessageContent.push({
          type: "text",
          text: JSON.stringify({
            message:
              'NOTE: This tool output is only a placeholder. The actual result from the tool is included in the next message with role "user". Please use that for processing.',
          }),
        });

        supplement = {
          role: "user",
          content: convertedBlocks.map((item) => {
            return MCPContentBlockConverter.contentBlockToLegacyMessageContent(item);
          }),
        };
      }
    }

    const result: IChatRequestMessage[] = [
      {
        role: "assistant",
        tool_calls: [
          {
            id: tool.id,
            type: "function",
            function: {
              arguments: JSON.stringify(tool.args),
              name: tool.name,
            },
          },
        ],
      },
      {
        role: "tool",
        name: tool.name,
        content: toolMessageContent,
        tool_call_id: tool.id,
      },
    ];

    if (supplement) {
      result.push(supplement);
    }

    console.log("tool messages", result);

    return result;
  }

  protected async makePayload(message: IChatRequestMessage[], msgId?: string): Promise<IChatRequestPayload> {
    const model = this.context.getModel();
    const payload: IChatRequestPayload = {
      model: model.name,
      messages: await this.makeMessages(message, msgId),
      temperature: this.context.getTemperature(),
      stream: !model.noStreaming,
    };
    if (this.isToolsEnabled()) {
      const tools = await window.electron.mcp.listTools();
      if (tools) {
        const $tools = tools.tools.map((tool: any) => {
          return this.makeTool(tool);
        });
        if ($tools.length > 0) {
          payload.tools = $tools;
          payload.tool_choice = "auto";
        }
      }
    }
    const maxTokens = this.context.getMaxTokens();
    if (maxTokens) {
      // OpenAI's new API use max_completion_tokens, while others still use max_tokens
      if (this.name.toLocaleLowerCase() === "openai") {
        payload.max_completion_tokens = maxTokens;
      } else if (MODEL_PREFIX_USES_MAX_COMPLETION_TOKENS.some((prefix) => model.name.startsWith(prefix))) {
        payload.max_completion_tokens = maxTokens;
      } else {
        payload.max_tokens = maxTokens;
      }
    }

    if (model.name.startsWith("o1") || model.name.startsWith("o3")) {
      payload.temperature = 1; // o1 and o3 models require temperature to be 1
    }
    return payload;
  }

  protected async makeRequest(messages: IChatRequestMessage[], msgId?: string): Promise<Response> {
    const payload = await this.makePayload(messages, msgId);
    const provider = this.context.getProvider();
    const url = urlJoin("/chat/completions", provider.apiBase.trim());

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey.trim()}`,
    };
    const isStream = this.context.isStream();
    return this.makeHttpRequest(url, headers, payload, isStream);
  }
}
