import type { IChatContext } from "intellichat/types";
import TrustedRouter from "../../providers/TrustedRouter";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class TrustedRouterChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = TrustedRouter;
  }
}
