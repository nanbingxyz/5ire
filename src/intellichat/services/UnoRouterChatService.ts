import type { IChatContext } from "intellichat/types";
import UnoRouter from "../../providers/UnoRouter";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class UnoRouterChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = UnoRouter;
  }
}
