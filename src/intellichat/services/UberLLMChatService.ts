import type { IChatContext } from "intellichat/types";
import UberLLM from "../../providers/UberLLM";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class UberLLMChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = UberLLM;
  }
}
