import type { IChatContext } from "intellichat/types";
import AtlasCloud from "../../providers/AtlasCloud";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class AtlasCloudChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = AtlasCloud;
  }
}
