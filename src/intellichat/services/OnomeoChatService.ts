import type { IChatContext } from "intellichat/types";
import Onomeo from "../../providers/Onomeo";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class OnomeoChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = Onomeo;
  }
}
