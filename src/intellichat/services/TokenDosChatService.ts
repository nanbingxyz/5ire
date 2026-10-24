import type { IChatContext } from "intellichat/types";
import TokenDos from "../../providers/TokenDos";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class TokenDosChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = TokenDos;
  }
}
