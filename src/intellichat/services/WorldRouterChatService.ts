import type { IChatContext } from "intellichat/types";
import WorldRouter from "../../providers/WorldRouter";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class WorldRouterChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = WorldRouter;
  }
}
