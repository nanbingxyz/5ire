import OpenAIChatService from './OpenAIChatService';
import LMStudio from '../../providers/LMStudio';
import { IChatContext } from 'intellichat/types';
import INextChatService from './INextCharService';

export default class LMStudioChatService
  extends OpenAIChatService
  implements INextChatService
{
  constructor(chatContext: IChatContext) {
    super(chatContext);
    this.provider = LMStudio;
  }
}
