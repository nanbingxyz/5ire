import { describe, expect, jest, test } from "@jest/globals";
import DeepSeekChatService from "../../src/intellichat/services/DeepSeekChatService";
import OpenAIChatService from "../../src/intellichat/services/OpenAIChatService";
import type { IChatContext, IChatMessage, IChatRequestMessage, IChatRequestPayload } from "../../src/intellichat/types";

jest.mock("renderer/components/MCPServerApprovalPolicyDialog", () => ({
  __esModule: true,
  default: {
    open: jest.fn(async () => true),
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

const toolCallResponse = [
  'data: {"choices":[{"delta":{"reasoning_content":"I should "}}]}',
  'data: {"choices":[{"delta":{"reasoning_content":"look this up."}}]}',
  'data: {"choices":[{"delta":{"content":"Let me check."}}]}',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_123","type":"function","function":{"name":"weather--lookup","arguments":"{\\"city\\":\\""}}]}}]}',
  'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Paris\\"}"}}]}}]}',
  "data: [DONE]",
].join("\n");

const finalResponse = ['data: {"choices":[{"delta":{"content":"It is sunny."}}]}', "data: [DONE]"].join("\n");

class TestDeepSeekChatService extends DeepSeekChatService {
  public readonly payloads: IChatRequestPayload[] = [];

  private readonly responses = [toolCallResponse, finalResponse];

  public async makeMessagesPublic(messages: IChatRequestMessage[]) {
    return this.makeMessages(messages);
  }

  protected async makeRequest(messages: IChatRequestMessage[], msgId?: string): Promise<Response> {
    this.payloads.push(await this.makePayload(messages, msgId));
    const body = this.responses.shift();
    if (!body) {
      throw new Error("Unexpected DeepSeek request");
    }
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }
}

class TestOpenAIChatService extends OpenAIChatService {
  public async makeMessagesPublic(messages: IChatRequestMessage[]) {
    return this.makeMessages(messages);
  }
}

function createContext(ctxMessages: IChatMessage[] = []): IChatContext {
  return {
    getActiveChat: () => ({ id: "chat-1" }) as any,
    getProvider: () =>
      ({
        apiBase: "https://api.deepseek.com/v1",
        apiKey: "test-api-key",
        proxy: "",
      }) as any,
    getModel: () =>
      ({
        name: "deepseek-v4-flash",
        capabilities: {
          tools: { enabled: true },
          vision: { enabled: false },
        },
      }) as any,
    getSystemMessage: () => null,
    getTemperature: () => 0.7,
    getMaxTokens: () => 0,
    getChatContext: () => "",
    getCtxMessages: () => ctxMessages,
    isStream: () => true,
    isReady: () => true,
  };
}

describe("intellichat/services/DeepSeekChatService", () => {
  test("passes reasoning_content back in the assistant tool-call message on the next request", async () => {
    const callTool = jest.fn().mockResolvedValue({
      isError: false,
      content: [{ type: "text", text: '{"temperature":24}' }],
    } as never);

    (global as any).window = {
      electron: {
        mcp: {
          callTool,
          cancelToolCall: jest.fn(),
          listTools: jest.fn().mockResolvedValue({
            tools: [
              {
                name: "weather--lookup",
                description: "Look up weather",
                inputSchema: {
                  type: "object",
                  properties: { city: { type: "string" } },
                  required: ["city"],
                },
              },
            ],
          } as never),
        },
      },
    };

    const service = new TestDeepSeekChatService("DeepSeek", createContext());
    service.onReading(jest.fn());
    service.onToolCalls(jest.fn());
    service.onError(jest.fn());
    service.onComplete(async () => {});

    await service.chat([{ role: "user", content: "What is the weather?" }]);

    expect(callTool).toHaveBeenCalledWith(
      expect.objectContaining({
        client: "weather",
        name: "lookup",
        args: { city: "Paris" },
      }),
    );
    expect(service.payloads).toHaveLength(2);

    const assistantToolCall = service.payloads[1].messages?.find(
      (message) => message.role === "assistant" && message.tool_calls,
    );
    expect(assistantToolCall).toMatchObject({
      role: "assistant",
      content: "Let me check.",
      reasoning_content: "I should look this up.",
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: {
            name: "weather--lookup",
            arguments: '{"city":"Paris"}',
          },
        },
      ],
    });
  });

  test("restores persisted assistant reasoning as reasoning_content", async () => {
    (global as any).window = {
      electron: {
        mcp: {
          listTools: jest.fn().mockResolvedValue({ tools: [] } as never),
        },
      },
    };

    const persistedMessage = {
      id: "message-1",
      chatId: "chat-1",
      prompt: "Why?",
      reply: "Because.",
      reasoning: "A persisted chain of thought.",
      model: "deepseek-v4-flash",
      temperature: 0.7,
      maxTokens: null,
      inputTokens: 1,
      outputTokens: 1,
      createdAt: 1,
      isActive: true,
    } as IChatMessage;
    const service = new TestDeepSeekChatService("DeepSeek", createContext([persistedMessage]));

    const messages = await service.makeMessagesPublic([]);

    expect(messages).toEqual([
      { role: "user", content: "Why?" },
      {
        role: "assistant",
        content: "Because.",
        reasoning_content: "A persisted chain of thought.",
      },
    ]);
  });

  test("does not add DeepSeek reasoning_content to OpenAI history", async () => {
    const persistedMessage = {
      id: "message-1",
      chatId: "chat-1",
      prompt: "Why?",
      reply: "Because.",
      reasoning: "Provider-private reasoning.",
      model: "gpt-4o",
      temperature: 0.7,
      maxTokens: null,
      inputTokens: 1,
      outputTokens: 1,
      createdAt: 1,
      isActive: true,
    } as IChatMessage;
    const service = new TestOpenAIChatService("OpenAI", createContext([persistedMessage]));

    const messages = await service.makeMessagesPublic([]);

    expect(messages).toEqual([
      { role: "user", content: "Why?" },
      { role: "assistant", content: "Because." },
    ]);
  });
});
