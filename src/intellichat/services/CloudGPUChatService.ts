import type { IChatContext } from "intellichat/types";
import CloudGPU from "../../providers/CloudGPU";
import type INextChatService from "./INextCharService";
import OpenAIChatService from "./OpenAIChatService";

export default class CloudGPUChatService extends OpenAIChatService implements INextChatService {
  constructor(name: string, chatContext: IChatContext) {
    super(name, chatContext);
    this.provider = CloudGPU;
  }
}
