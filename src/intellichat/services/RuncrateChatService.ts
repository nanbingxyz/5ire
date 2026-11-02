import type { IChatContext } from "intellichat/types";
import Runcrate from "../../providers/Runcrate";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class RuncrateChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = Runcrate;
  }
}
