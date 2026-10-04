import type { IChatContext } from "intellichat/types";
import CheaperInference from "../../providers/CheaperInference";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class CheaperInferenceChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = CheaperInference;
  }
}
