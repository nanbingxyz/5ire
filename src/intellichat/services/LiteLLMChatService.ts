import type { IChatContext } from "intellichat/types";
import LiteLLM from "../../providers/LiteLLM";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class LiteLLMChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = LiteLLM;
  }
}
