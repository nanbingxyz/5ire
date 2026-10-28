import type { IChatContext } from "intellichat/types";
import Obscurify from "../../providers/Obscurify";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class ObscurifyChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = Obscurify;
  }
}
