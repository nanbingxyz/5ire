import type { IChatContext } from "intellichat/types";
import Keln from "../../providers/Keln";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class KelnChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = Keln;
  }
}
