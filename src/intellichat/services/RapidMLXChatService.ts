import type { IChatContext } from "intellichat/types";
import RapidMLX from "../../providers/RapidMLX";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class RapidMLXChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = RapidMLX;
  }
}
