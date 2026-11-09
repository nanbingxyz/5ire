import Debug from 'debug';
import {
  IChatContext,
  IChatRequestMessage,
  IChatRequestMessageContent,
} from 'intellichat/types';
import OllamaReader from 'intellichat/readers/OllamaChatReader';
import { ITool } from 'intellichat/readers/IChatReader';
import { splitByImg, stripHtmlTags, urlJoin } from 'utils/util';
import { ContentBlockConverter as MCPContentBlockConverter } from 'intellichat/mcp/ContentBlockConverter';
import { getToolErrorText } from 'intellichat/mcp/toolErrorText';
import { ContentBlock as MCPContentBlock } from '@modelcontextprotocol/sdk/types.js';
import OpenAIChatService from './OpenAIChatService';
import INextChatService from './INextCharService';
import Ollama from '../../providers/Ollama';

const debug = Debug('5ire:intellichat:OllamaChatService');
export default class OllamaChatService
  extends OpenAIChatService
  implements INextChatService
{
  constructor(name: string, context: IChatContext) {
    super(name, context);
    this.provider = Ollama;
  }

  protected getReaderType() {
    return OllamaReader;
  }

  protected async convertPromptContent(
    content: string,
  ): Promise<
    string | IChatRequestMessageContent[] | Partial<IChatRequestMessageContent>
  > {
    if (this.context.getModel().capabilities.vision?.enabled) {
      const items = splitByImg(content);
      console.log('items', items);
      const textItems = items.filter((item: any) => item.type === 'text');
      const textContent = textItems.map((item: any) => item.data).join('\n');
      const result: { content: string; images?: string[] } = {
        content: textContent || '',
      };
      const imageItems = items.filter((item: any) => item.type === 'image');
      const localImages =
        imageItems
          .filter((item: any) => item.dataType === 'base64')
          .map((i) => {
            const base64Data = i.data.split(',');
            if (base64Data.length < 2) {
              return i.data;
            }
            // remove data:image/png;base64,
            return base64Data[1];
          }) || [];
      const remoteImageItems = items.filter(
        (item: any) => item.dataType === 'URL',
      );
      if (remoteImageItems.length > 0) {
        const base64Images = await Promise.all(
          remoteImageItems.map(async (item: any) => {
            try {
              const response = await fetch(item.data);
              const blob = await response.blob();
              const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
              return (base64 as string).split(',')[1]; // remove data:image/png;base64,
            } catch (error) {
              console.error('Failed to convert image to base64:', error);
              return null;
            }
          }),
        );
        const validBase64Images = base64Images.filter((img) => img !== null);
        if (validBase64Images.length > 0) {
          result.images = [...localImages, ...validBase64Images];
        }
      } else if (localImages.length > 0) {
        result.images = localImages;
      }
      return result;
    }
    return {
      content: stripHtmlTags(content),
    };
  }

  protected async makeToolMessages(tool: ITool, toolResult: any) {
    let supplement: IChatRequestMessage | undefined;

    const toolMessageContent: IChatRequestMessageContent[] = [];

    if (typeof toolResult === 'string') {
      toolMessageContent.push({
        type: 'text',
        text: toolResult,
      });
    }

    if (toolResult.isError) {
      toolMessageContent.push({
        type: 'text',
        text: getToolErrorText(toolResult),
      });
    }

    if (!toolResult.isError && toolResult.content) {
      const content = Array.isArray(toolResult.content)
        ? toolResult.content
        : [];

      const convertedBlocks = await Promise.all(
        content.map((block: MCPContentBlock) =>
          MCPContentBlockConverter.convert(block, (uri) => {
            return window.electron.mcp
              .readResource(tool.name.split('--')[0], uri)
              .then((result) => {
                if (result.isError) {
                  return [];
                }

                return result.contents;
              });
          }),
        ),
      );

      if (convertedBlocks.every((item) => item.type === 'text')) {
        // eslint-disable-next-line no-restricted-syntax
        for (const block of convertedBlocks) {
          toolMessageContent.push(
            MCPContentBlockConverter.contentBlockToLegacyMessageContent(block),
          );
        }
      } else {
        toolMessageContent.push({
          type: 'text',
          text: JSON.stringify({
            message:
              'NOTE: This tool output is only a placeholder. The actual result from the tool is included in the next message with role "user". Please use that for processing.',
          }),
        });

        supplement = {
          role: 'user',
          content: convertedBlocks.map((item) => {
            return MCPContentBlockConverter.contentBlockToLegacyMessageContent(
              item,
            );
          }),
        };
      }
    }

    const result: IChatRequestMessage[] = [
      {
        role: 'assistant',
        tool_calls: [
          {
            id: tool.id,
            type: 'function',
            function: {
              arguments: tool.args, // unlike openai, ollama tool args is not a string
              name: tool.name,
            },
          },
        ],
      },
      {
        role: 'tool',
        name: tool.name,
        content: toolMessageContent,
        tool_call_id: tool.id,
      },
    ];

    if (supplement) {
      result.push(supplement);
    }

    return result;
  }

  protected async makeMessages(
    messages: IChatRequestMessage[],
    msgId?: string,
  ): Promise<IChatRequestMessage[]> {
    const result = await super.makeMessages(messages, msgId);
    const visionEnabled =
      this.context.getModel().capabilities.vision?.enabled ?? false;
    const processedMessages: IChatRequestMessage[] = [];

    await Promise.all(
      result.map(async (message) => {
        if (typeof message.content === 'string') {
          processedMessages.push(message);
        }

        if (Array.isArray(message.content)) {
          const texts = message.content
            .filter((item) => item.type === 'text')
            .map((item) => item.text);

          const images = message.content.flatMap((item) => {
            if (item.image_url?.url) {
              return [item.image_url.url];
            }

            return item.images || [];
          });

          if (visionEnabled) {
            await Promise.all(
              images.map(async (image, index) => {
                if (image.startsWith('data:')) {
                  // eslint-disable-next-line prefer-destructuring
                  images[index] = images[index].split(',')[1];
                } else if (
                  image.startsWith('http:') ||
                  image.startsWith('https:') ||
                  image.startsWith('blob:')
                ) {
                  try {
                    const bytes = await fetch(image)
                      .then((res) => res.arrayBuffer())
                      .then((buffer) => new Uint8Array(buffer));

                    let binary = '';

                    // eslint-disable-next-line no-plusplus
                    for (let i = 0; i < bytes.byteLength; i++) {
                      binary += String.fromCharCode(bytes[i]);
                    }

                    images[index] = btoa(binary);
                  } catch (error) {
                    console.error('Failed to convert image to base64:', error);
                    images[index] = '';
                  }
                } else {
                  images[index] = '';
                }
              }),
            );
          }

          processedMessages.push({
            ...message,
            content: texts.join('\n\n\n'),
            // @ts-ignore Ollama requires that all image content be placed separately in the images field.
            images: visionEnabled ? images.filter(Boolean) : undefined,
          });
        }
      }),
    );

    return processedMessages;
  }

  protected async makeRequest(
    messages: IChatRequestMessage[],
    msgId?: string,
  ): Promise<Response> {
    const payload = await this.makePayload(messages, msgId);
    debug('Send Request, payload:\r\n', payload);
    const provider = this.context.getProvider();
    const url = urlJoin('/api/chat', provider.apiBase.trim());
    const headers = {
      'Content-Type': 'application/json',
    } as Record<string, string>;
    if (provider.apiKey && provider.apiKey.trim()) {
      headers.Authorization = `Bearer ${provider.apiKey.trim()}`;
    }
    const isStream = this.context.isStream();
    return this.makeHttpRequest(url, headers, payload, isStream);
  }
}
