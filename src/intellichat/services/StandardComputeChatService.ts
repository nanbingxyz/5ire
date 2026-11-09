import type { IChatContext } from "intellichat/types";
import StandardCompute from "../../providers/StandardCompute";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class StandardComputeChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = StandardCompute;
  }
}
