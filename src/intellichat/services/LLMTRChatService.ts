import type { IChatContext } from "intellichat/types";
import LLMTR from "../../providers/LLMTR";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class LLMTRChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = LLMTR;
  }
}
