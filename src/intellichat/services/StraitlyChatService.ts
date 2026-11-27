import type { IChatContext } from "intellichat/types";
import Straitly from "../../providers/Straitly";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class StraitlyChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = Straitly;
  }
}
