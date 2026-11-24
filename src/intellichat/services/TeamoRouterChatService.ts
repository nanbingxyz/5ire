import type { IChatContext } from "intellichat/types";
import TeamoRouter from "../../providers/TeamoRouter";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class TeamoRouterChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = TeamoRouter;
  }
}
