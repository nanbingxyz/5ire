import Debug from 'debug';
import {
  IChatContext,
  IChatRequestMessage,
  IChatRequestPayload,
  IChatMessage,
  IChatRequestMessageContent,
  IAnthropicTool,
  IMCPTool,
  IOpenAITool,
} from 'intellichat/types';
import Anthropic from '../../providers/Anthropic';
import { isBlank } from 'utils/validators';
import { getBase64, splitByImg, stripHtmlTags, urlJoin } from 'utils/util';
import INextChatService from './INextCharService';
import AnthropicReader from 'intellichat/readers/AnthropicReader';
import NextChatService from './NextChatService';
import { ITool } from 'intellichat/readers/IChatReader';

const debug = Debug('5ire:intellichat:AnthropicChatService');

export default class AnthropicChatService
  extends NextChatService
  implements INextChatService
{
  constructor(context: IChatContext) {
    super({
      context,
      provider: Anthropic,
    });
  }

  protected makeToolMessages(
    tool: ITool,
    toolResult: any,
  ): IChatRequestMessage[] {
    return [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: tool.id,
            name: tool.name,
            input: tool.args ?? {},
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: tool.id,
            content:
              typeof toolResult === 'string' ? toolResult : toolResult.content,
          },
        ],
      },
    ];
  }

  protected makeTool(tool: IMCPTool): IOpenAITool | IAnthropicTool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: tool.inputSchema.type,
        properties: tool.inputSchema.properties || {},
        required: tool.inputSchema.required || [],
        additionalProperties: tool.inputSchema.additionalProperties || false,
      },
    };
  }

  protected getReaderType() {
    return AnthropicReader;
  }

  protected async convertPromptContent(
    content: string,
  ): Promise<string | IChatRequestMessageContent[]> {
    const model = this.context.getModel();
    if (model.vision?.enabled || model.pdfSupport?.enabled) {
      const items = splitByImg(content);
      const result: IChatRequestMessageContent[] = [];
      for (let item of items) {
        if (item.type === 'image') {
          let data = '';
          if (item.dataType === 'URL') {
            data = await getBase64(item.data);
          } else {
            data = item.data.split(',')[1]; // remove data:image/png;base64,
          }
          result.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: item.mimeType as string,
              data,
            },
          });
        } else if (item.type === 'document') {
          let data = '';
          if (item.dataType === 'URL') {
            data = await getBase64(item.data);
          } else {
            data = item.data.split(',')[1]; // remove data:application/pdf;base64,
          }
          result.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: item.mimeType as string,
              data,
            },
          });
        } else if (item.type === 'text') {
          result.push({
            type: 'text',
            text: item.data,
          });
        } else {
          console.error('Unknown message type', item);
          throw new Error('Unknown message type');
        }
      }
      return result;
    }
    return stripHtmlTags(content);
  }

  protected async makeMessages(
    messages: IChatRequestMessage[],
  ): Promise<IChatRequestMessage[]> {
    const result = [];
    // Process context messages through convertPromptContent to handle media properly
    for (const msg of this.context.getCtxMessages()) {
      result.push({
        role: 'user',
        content: await this.convertPromptContent(msg.prompt),
      });
      result.push({
        role: 'assistant',
        content: await this.convertPromptContent(msg.reply),
      });
    }
    for (const msg of messages) {
      if (msg.role === 'tool') {
        result.push({
          content: JSON.stringify(msg.content),
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
        });
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        result.push(msg);
      } else {
        const content = msg.content;
        if (typeof content === 'string') {
          result.push({
            role: msg.role,
            content: await this.convertPromptContent(content),
          });
        } else {
          result.push({
            role: msg.role,
            content,
          });
        }
      }
    }
    return result as IChatRequestMessage[];
  }

  protected async makePayload(
    messages: IChatRequestMessage[],
  ): Promise<IChatRequestPayload> {
    const payload: IChatRequestPayload = {
      model: this.getModelName(),
      messages: await this.makeMessages(messages),
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
    if (this.context.isToolEnabled()) {
      const tools = await window.electron.mcp.listTools();
      if (tools) {
        const _tools = tools
          .filter((tool: any) => !this.usedToolNames.includes(tool.name))
          .map((tool: any) => {
            return this.makeTool(tool);
          });
        if (_tools.length > 0) {
          payload.tools = _tools;
          payload.tool_choice = {
            type: 'auto',
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

  protected async makeRequest(
    messages: IChatRequestMessage[],
  ): Promise<Response> {
    const payload = await this.makePayload(messages);
    debug('About to make a request, payload:\r\n', payload);
    const { base, key } = this.apiSettings;
    const url = urlJoin('/messages', base);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': key,
      },
      body: JSON.stringify(payload),
      signal: this.abortController.signal,
    });
    return response;
  }
}
