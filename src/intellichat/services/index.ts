import Debug from "debug";
import type { IChatContext } from "../types";
import AnthropicChatService from "./AnthropicChatService";
import AzureChatService from "./AzureChatService";
import BaiduChatService from "./BaiduChatService";
import DeepSeekChatService from "./DeepSeekChatService";
import DoubaoChatService from "./DoubaoChatService";
import FireChatService from "./FireChatService";
import GoogleChatService from "./GoogleChatService";
import GrokChatService from "./GrokChatService";
import type INextChatService from "./INextCharService";
import LiteLLMChatService from "./LiteLLMChatService";
import LMStudioChatService from "./LMStudioChatService";
import MistralChatService from "./MistralChatService";
import MoonshotChatService from "./MoonshotChatService";
import OllamaChatService from "./OllamaChatService";
import OpenAIChatService from "./OpenAIChatService";
import PerplexityChatService from "./PerplexityChatService";
import UnoRouterChatService from "./UnoRouterChatService";
import ZhipuChatService from "./ZhipuChatService";

const debug = Debug("5ire:intellichat:ChatService");

export default function createService(chatCtx: IChatContext): INextChatService {
  const provider = chatCtx.getProvider();
  debug("CreateService", provider.name);
  switch (provider.name) {
    case "Anthropic":
      return new AnthropicChatService(provider.name, chatCtx);
    case "OpenAI":
      return new OpenAIChatService(provider.name, chatCtx);
    case "Azure":
      return new AzureChatService(provider.name, chatCtx);
    case "Google":
      return new GoogleChatService(provider.name, chatCtx);
    case "Baidu":
      return new BaiduChatService(provider.name, chatCtx);
    case "Mistral":
      return new MistralChatService(provider.name, chatCtx);
    case "Moonshot":
      return new MoonshotChatService(provider.name, chatCtx);
    case "Ollama":
      return new OllamaChatService(provider.name, chatCtx);
    case "5ire":
      return new FireChatService(provider.name, chatCtx);
    case "Doubao":
      return new DoubaoChatService(provider.name, chatCtx);
    case "Grok":
      return new GrokChatService(provider.name, chatCtx);
    case "DeepSeek":
      return new DeepSeekChatService(provider.name, chatCtx);
    case "LMStudio":
      return new LMStudioChatService(provider.name, chatCtx);
    case "Perplexity":
      return new PerplexityChatService(provider.name, chatCtx);
    case "Zhipu":
      return new ZhipuChatService(provider.name, chatCtx);
    case "LiteLLM":
      return new LiteLLMChatService(provider.name, chatCtx);
    case "UnoRouter":
      return new UnoRouterChatService(provider.name, chatCtx);
    default:
      return new OpenAIChatService(provider.name, chatCtx);
  }
}
