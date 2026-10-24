import type { IChatContext } from "intellichat/types";
import APIRoute from "../../providers/APIRoute";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class APIRouteChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = APIRoute;
  }
}
