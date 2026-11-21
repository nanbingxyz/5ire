import type { IChatContext } from "intellichat/types";
import AIGROW from "../../providers/AIGROW";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class AIGROWChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = AIGROW;
  }
}
