import {
  encoding_for_model as encodingForModel,
  TiktokenModel,
  Tiktoken,
} from 'tiktoken';
import { get_encoding as getEncoding } from 'tiktoken/init';
import { IChatRequestMessage } from 'intellichat/types';
import { captureException } from 'renderer/logging';

let llama3Tokenizer: any;
let llamaTokenizer: any;

(async () => {
  llama3Tokenizer = (await import('llama3-tokenizer-js')).default;
  llamaTokenizer = (await import('llama-tokenizer-js')).default;
})();

/**
 * Counts the number of tokens in messages for GPT models using tiktoken encoding.
 * Automatically maps model names to supported tiktoken models and falls back to cl100k_base encoding if needed.
 * 
 * @param {IChatRequestMessage[]} messages - Array of chat messages to count tokens for
 * @param {string} model - The GPT model name (e.g., 'gpt-3.5-turbo', 'gpt-4')
 * @returns {number} Total number of tokens including message overhead and assistant prompt tokens
 */
export function countGPTTokens(messages: IChatRequestMessage[], model: string) {
  let _model = model;
  if (model.startsWith('gpt-3.5') || model.startsWith('gpt-35')) {
    _model = 'gpt-3.5-turbo-0613';
  } else if (model.startsWith('gpt-4')) {
    _model = 'gpt-4-0613';
  }
  let encoding: Tiktoken;
  try {
    encoding = encodingForModel(_model as TiktokenModel);
  } catch (err) {
    console.warn('Model not found. Using cl100k_base encoding.');
    encoding = getEncoding('cl100k_base');
  }
  const tokensPerMessage = 3;
  const tokensPerName = 1;
  let numTokens = 0;

  messages.forEach((msg: any) => {
    numTokens += tokensPerMessage;
    Object.keys(msg).forEach((key: string) => {
      numTokens += encoding.encode(msg[key] as string).length;
      if (key === 'name') {
        numTokens += tokensPerName;
      }
    });
  });
  numTokens += 3; // For assistant prompt
  return numTokens;
}

/**
 * Counts tokens for Gemini models using the official Google API endpoint.
 * Makes a POST request to the Gemini API to get accurate token counts.
 * 
 * @param {IChatRequestMessage[]} messages - Array of chat messages to count tokens for
 * @param {string} apiBase - Base URL for the Gemini API
 * @param {string} apiKey - API key for authentication
 * @param {string} model - The Gemini model name
 * @returns {Promise<number>} Promise that resolves to the total token count
 */
export async function countTokensOfGemini(
  messages: IChatRequestMessage[],
  apiBase: string,
  apiKey: string,
  model: string,
) {
  const response = await fetch(
    `${apiBase}/v1beta/models/${model}:countTokens?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ contents: messages }),
    },
  );
  const data = await response.json();
  return data.totalTokens;
}

/**
 * Counts tokens for Moonshot models using their token estimation API.
 * Includes error handling that returns 0 on failure and logs exceptions.
 * 
 * @param {IChatRequestMessage[]} messages - Array of chat messages to count tokens for
 * @param {string} apiBase - Base URL for the Moonshot API
 * @param {string} apiKey - Bearer token for authentication
 * @param {string} model - The Moonshot model name
 * @returns {Promise<number>} Promise that resolves to the total token count, or 0 if an error occurs
 */
export async function countTokensOfMoonshot(
  messages: IChatRequestMessage[],
  apiBase: string,
  apiKey: string,
  model: string,
) {
  try {
    const response = await fetch(`${apiBase}/tokenizers/estimate-token-count`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages }),
    });
    const json = await response.json();
    return json.data.total_tokens;
  } catch (err: any) {
    captureException(err);
    return 0;
  }
}

/**
 * Counts tokens for Llama models using local tokenizers.
 * Automatically selects between llama3-tokenizer-js and llama-tokenizer-js based on model name.
 * 
 * @param {IChatRequestMessage[]} messages - Array of chat messages to count tokens for
 * @param {string} model - The Llama model name (determines which tokenizer to use)
 * @returns {Promise<number>} Promise that resolves to the total token count including message overhead
 */
export async function countTokenOfLlama(
  messages: IChatRequestMessage[],
  model: string,
) {
  const tokensPerMessage = 3;
  const tokensPerName = 1;
  let numTokens = 0;
  const tokenizer = model.startsWith('llama3')
    ? llama3Tokenizer
    : llamaTokenizer;
  messages.forEach((msg: any) => {
    numTokens += tokensPerMessage;
    Object.keys(msg).forEach((key: string) => {
      numTokens += tokenizer.encode(msg[key] as string).length;
      if (key === 'name') {
        numTokens += tokensPerName;
      }
    });
  });
  return numTokens;
}
