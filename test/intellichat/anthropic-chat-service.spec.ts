import { describe, expect, test } from "@jest/globals";
import type { ITool } from "../../src/intellichat/readers/IChatReader";
import AnthropicChatService from "../../src/intellichat/services/AnthropicChatService";
import type { IChatContext, IChatRequestMessage } from "../../src/intellichat/types";

jest.mock("renderer/components/MCPServerApprovalPolicyDialog", () => ({
  __esModule: true,
  default: {
    open: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock("stores/useInspectorStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      trace: jest.fn(),
    }),
  },
}));

jest.mock("stores/useMCPStore", () => ({
  __esModule: true,
  default: {
    getState: () => ({
      config: {
        mcpServers: {},
      },
    }),
  },
}));

class TestAnthropicChatService extends AnthropicChatService {
  public async makeMessagesPublic(messages: IChatRequestMessage[]) {
    return this.makeMessages(messages);
  }

  public async makeToolMessagesPublic(tool: ITool, toolResult: any, content?: string) {
    return this.makeToolMessages(tool, toolResult, content);
  }
}

function createContext(): IChatContext {
  return {
    getActiveChat: () => ({ id: "chat-1" }) as any,
    getProvider: () =>
      ({
        apiBase: "https://api.anthropic.com/v1",
        apiKey: "test-api-key",
        proxy: "",
      }) as any,
    getModel: () =>
      ({
        name: "claude-3-7-sonnet-latest",
        capabilities: {
          tools: { enabled: true },
          vision: { enabled: false },
        },
      }) as any,
    getSystemMessage: () => null,
    getTemperature: () => 0.7,
    getMaxTokens: () => 0,
    getChatContext: () => "",
    getCtxMessages: () => [],
    isStream: () => true,
    isReady: () => true,
  };
}

describe("intellichat/services/AnthropicChatService", () => {
  test("preserves tool_use and tool_result blocks without creating empty text blocks", async () => {
    const service = new TestAnthropicChatService("anthropic", createContext());
    const messages = await service.makeMessagesPublic([
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: "toolu_123",
            name: "notion--fetch_page",
            input: {
              page_id: "abc",
            },
          } as any,
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "toolu_123",
            content: '{"ok":true}',
          } as any,
        ],
      },
    ]);

    expect(messages).toHaveLength(2);
    expect((messages[0].content as any[])[0]).toMatchObject({
      type: "tool_use",
      id: "toolu_123",
      name: "notion--fetch_page",
    });

    const emptyTextBlocks = messages
      .flatMap((msg) => (Array.isArray(msg.content) ? msg.content : []))
      .filter((block: any) => block.type === "text" && block.text === "");

    expect(emptyTextBlocks).toHaveLength(0);
  });

  test("maps role=tool messages to Anthropic user tool_result format", async () => {
    const service = new TestAnthropicChatService("anthropic", createContext());
    const messages = await service.makeMessagesPublic([
      {
        role: "tool",
        tool_call_id: "toolu_456",
        content: "",
      } as any,
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect((messages[0].content as any[])[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "toolu_456",
    });
    expect((((messages[0].content as any[])[0]?.content || "") as string).trim().length).toBeGreaterThan(0);
  });

  test("uses non-empty fallback text for empty tool result text", async () => {
    const service = new TestAnthropicChatService("anthropic", createContext());
    const messages = await service.makeToolMessagesPublic(
      {
        id: "toolu_789",
        name: "fetch--resource",
        args: {},
      } as ITool,
      {
        isError: false,
        content: [
          {
            type: "text",
            text: "",
          },
        ],
      },
      "",
    );

    expect(messages).toHaveLength(2);
    const toolResultBlocks = (messages[1].content as any[]).filter((item: any) => item.type === "tool_result");
    expect(toolResultBlocks).toHaveLength(1);
    expect((toolResultBlocks[0].content as string).trim().length).toBeGreaterThan(0);
  });
});
