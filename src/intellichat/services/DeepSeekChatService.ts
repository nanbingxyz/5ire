import IChatService from './IChatService';
import OpenAIChatService from './OpenAIChatService';
import DeepSeek from '../../providers/DeepSeek'
import { IChatContext } from 'intellichat/types';


export default class DeepSeekChatService
  extends OpenAIChatService
  implements IChatService
{

  constructor(chatContext: IChatContext) {
    super(chatContext);
    this.provider = DeepSeek;
  }

  protected async makeRequest(message: string): Promise<Response> {
    const { base, key } = this.apiSettings;
    const response = await fetch(
      `${base}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify(await this.makePayload(message)),
        signal: this.abortController.signal,
      }
    );
    return response;
  }
}