import { asc, eq } from "drizzle-orm";
import { readFile } from "fs-extra";
import { COMMON_TEXTUAL_FILE_MIMETYPES } from "@/main/constants";
import { Database } from "@/main/database";
import type { Conversation, Project, Turn, TurnPrompt } from "@/main/database/types";
import { Container } from "@/main/internal/container";
import type { Message, Part } from "@/main/model/content-specification";
import { DocumentManager } from "@/main/services/document-manager";
import { Logger } from "@/main/services/logger";
import { URLParser } from "@/main/services/url-parser";

const CLIENT_INFORMATION = `
# [CLIENT_INFORMATION]

- name: 5ire
- version: 0.0.1
`.trim();

const FORMAT_PROTOCOL = `
# [FORMAT_PROTOCOL]

## 输入识别规范

5ire 会将模型无法处理的内容或资源引用以 XML 元数据的形式内嵌在消息文本中，包括：
1. 资源定义：\`<5ire.resource title="" url="" mimetype="" description="" />\`
2. 资源引用：\`<5ire.reference title="" url="" mimetype="" description="" />\`

## 协议处理逻辑

所有 \`url\` 均包含有效地址，支持以下协议：
- \`external:\` MCP resource，原始 URL 编码于 \`query.origin\`
- \`document:\` 知识库文档
- \`document+fragment:\` 知识库片段
- \`http/https:\` 网络标准协议

## 输出渲染要求

1. 禁止在回复中原样输出任何 \`5ire.resource\` 或 \`5ire.reference\` 形式的 XML 标签。
2. 所有引用必须转换为标准 Markdown 链接格式：\`[title](url)\`。
3. 在不支持 Markdown 的格式中，必须原样贴出 \`url\`。
`.trim();

const CONVERSATION_STATE = `
# [CONVERSATION_STATE]

## Conversation: 当前聊天目标
- 这一组对话的当前进展：{{Conversation_Goal}}
- 关键上下文记录：{{Recent_Context_Summary}}
`.trim();

const ACTION_INSTRUCTION = `
# [ACTION_INSTRUCTION]

# UserPrompt: 当前核心任务
{{UserPrompt}}
`;

const CONTEXT_FRAMEWORK = `
# Project: 项目背景与目标
- 当前项目：{{Project_Name}}
- 项目目标：{{Project_Description}}

# Profile & Memory: 用户画像与长期记忆
- 用户偏好：{{Profile_Preferences}}
- 核心记忆：{{Memory_Key_Points}}
`;

export class ConversationContextBuilder {
  #logger = Container.inject(Logger).scope("ConversationContextBuilder");
  #urlParser = Container.inject(URLParser);
  #documentsManager = Container.inject(DocumentManager);

  async #queryKnowledgeChunks(context: ConversationContextBuilder.BuildContext, text: string) {
    const associatedCollections = await this.#documentsManager.listAssociatedCollections({
      type: "conversation",
      target: context.conversation.id,
    });

    if (associatedCollections.length) {
      return await this.#documentsManager.queryChunks({
        text,
        collections: associatedCollections.map((collection) => collection.id),
      });
    }

    return [];
  }

  /**
   * 处理必须作为资源嵌入到上下文中的引用；这些资源根据 URL 的类型进行解析；
   * 1. 当引用的 URL 是文件时，表示该资源是一个用户在本地选择的文件或缓存的文件内容；必须恢复到上下文中；
   * 2. 当引用的 URL 是 inline 时，转换为资源；
   * 3. 当引用的 URL 是 document-fragment 时，表示该资源是一个用户选择的知识库文档切片；必须恢复到上下文中；
   * @param reference
   * @private
   */
  async #resolveRequiredReference(reference: Part.Reference) {
    const url = this.#urlParser.parse(reference.url);

    if (url.type === "file") {
      try {
        const content = await readFile(url.path);

        if (reference.mimetype) {
          if (
            Object.values(COMMON_TEXTUAL_FILE_MIMETYPES).some((mimetype) => reference.mimetype?.startsWith(mimetype))
          ) {
            const resource: Part.Resource = {
              mimetype: reference.mimetype,
              url: reference.url,
              type: "resource",
              content: content.toString(),
            };

            return resource;
          }
        }

        const resource: Part.Resource = {
          mimetype: "application/octet-stream",
          url: reference.url,
          type: "resource",
          content: content,
        };

        return resource;
      } catch {
        const text: Part.Text = {
          type: "text",
          text: `Failed to read resource: ${reference.url}`,
        };

        return text;
      }
    }

    if (url.type === "inline") {
      const resource: Part.Resource = {
        mimetype: url.mimetype,
        url: reference.url,
        type: "resource",
        content: url.data,
      };

      return resource;
    }

    if (url.type === "document-fragment") {
      const text: Part.Text = {
        type: "text",
        text: `Failed to resolve document fragment: ${reference.url}`,
      };

      return text;
    }

    return reference;
  }

  async #finalizeSystemMessage(context: ConversationContextBuilder.BuildContext) {}

  async #trimMessagesToLimit(context: ConversationContextBuilder.BuildContext, limit: number) {
    const messages = context.messages.toReversed();
    const result: typeof messages = [];

    for (const message of messages) {
      if (limit <= 0) {
        break;
      }

      if (message.role === "user") {
        limit--;
      }

      result.push(message);
    }

    context.messages = result.reverse();
  }

  async #appendTurnToContextMessages(context: ConversationContextBuilder.BuildContext, turn: Turn) {
    await this.#appendTurnPromptToContextMessages(context, turn.prompt).then(async () => {
      context.messages.push({
        role: "assistant",
        content: await Promise.all(
          turn.reply.map(async (part) => {
            if (part.type === "reference") {
              return this.#resolveRequiredReference(part);
            }

            return part;
          }),
        ),
      });
    });
  }

  async #appendTurnPromptToContextMessages(context: ConversationContextBuilder.BuildContext, prompt: TurnPrompt) {
    switch (prompt.type) {
      case "user-prompt": {
        context.messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: prompt.instruction,
            },
          ],
        });

        break;
      }
      case "external-prompt": {
        for (const message of prompt.messages) {
          const content = await Promise.all(
            message.content.map(async (part) => {
              if (part.type === "reference") {
                return this.#resolveRequiredReference(part);
              }

              return part;
            }),
          );

          context.messages.push({
            role: message.role,
            content,
          });
        }
        break;
      }
      case "tool-completion": {
        const content = await Promise.all(
          prompt.results.map(async (item) => {
            return {
              ...item,
              ...{
                result: await Promise.all(
                  item.result.map(async (part) => {
                    if (part.type === "reference") {
                      return this.#resolveRequiredReference(part);
                    }

                    return part;
                  }),
                ),
              },
            };
          }),
        );

        context.messages.push({
          role: "tool",
          content,
        });

        break;
      }
      case "user-input": {
        const content = await Promise.all(
          prompt.content.map(async (part) => {
            if (part.type === "reference") {
              return this.#resolveRequiredReference(part);
            }

            return part;
          }),
        );

        context.messages.push({
          role: "user",
          content,
        });
      }
    }
  }

  async build(options: ConversationContextBuilder.BuildOptions) {
    const { turns, project, conversation } = options;

    const context: ConversationContextBuilder.BuildContext = {
      conversation,
      project,
      prompt: options.prompt,
      systemPrompts: [],
      messages: [],
    };

    for (const turn of turns) {
      await this.#appendTurnToContextMessages(context, turn);
    }

    await this.#trimMessagesToLimit(context, conversation.config.maxContextMessages);
    await this.#appendTurnPromptToContextMessages(context, context.prompt);
    await this.#finalizeSystemMessage(context);

    return context.messages;
  }
}

export namespace ConversationContextBuilder {
  export type BuildOptions = {
    /**
     * Conversation ID
     */
    id: string;
    /**
     * The current turn prompt to be processed
     */
    prompt: TurnPrompt;
    /**
     *
     */
    project?: Project;
    conversation: Conversation;
    turns: Turn[];
  };

  export type BuildContext = {
    /**
     * Conversation
     */
    conversation: Conversation;
    /**
     * Project associated with the conversation
     */
    project?: Project;
    /**
     * The current turn prompt to be processed
     */
    prompt: TurnPrompt;
    /**
     * System message content
     */
    systemPrompts: {
      content: Array<Part.Text | Part.Reference>;
      source: SystemPromptSource;
    }[];
    /**
     *
     */
    messages: Exclude<Message, { role: "system" }>[];
  };

  export type SystemPromptSource =
    // 客户端能力描述
    | "client"
    // 用户的基本偏好
    | "profile"
    // 当前项目的目标、特定领域知识 (应该在此处包含项目关联的知识库、知识文档的引用)。
    | "project"
    // 当前项目层面的记忆（当前项目中其他对话中聊过什么，提及到了哪些概念）
    // | "memory"
    // 当前会话的提示词（表示当前会话要做什么）
    | "conversation"
    // 当 Prompt 是一个 UserInput 是，则会包含当前项目所关联的知识库、知识文档中可能关联的知识切片。
    // | "knowledge" // TODO: 应该作为 UserInput 的一部分尾随 User Message ？
    // 通过 UserPrompt 触发的命令。 它和 conversation 处于同一个级别，如果发现已激活的命令，则会替换掉 conversation。
    | "user-prompt/replace"
    | "user-prompt/merge";
}
