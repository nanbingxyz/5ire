import {
  IChatMessage,
  IChatResponseMessage,
  IPromptDef,
} from 'intellichat/types';
import { isArray, isNull } from 'lodash';

export function date2unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

export function unix2date(unix: number) {
  return new Date(unix * 1000);
}

export function isTagClosed(code: string, tag: string) {
  if (!code || code.trim() === '') return true;
  if (!tag || tag.trim() === '') return true;
  const openRegex = new RegExp(`<${tag}>`, 'g');
  const closeRegex = new RegExp(`</${tag}>`, 'g');
  const openMatched = code.match(openRegex) || [];
  const closeMatched = code.match(closeRegex) || [];
  return openMatched.length === closeMatched.length;
}

export function str2int(str: string, defaultValue: number | null = null) {
  const result = parseInt(str, 10);
  if (Number.isNaN(result)) {
    return defaultValue;
  }
  return result;
}

export function fmtDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

export function fmtDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${fmtDate(date)} ${hours}:${minutes}:${seconds}`;
}

export function highlight(text: string, keyword: string | string[]) {
  if (!text) return '';
  if (!keyword) return text;
  if (typeof keyword === 'string') {
    if (keyword.trim() === '') return text;
    const regex = new RegExp(keyword.trim(), 'gi');
    return text.replace(regex, (match) => `<mark>${match}</mark>`);
  }
  let result = text;
  keyword.forEach((word) => {
    const regex = new RegExp(word, 'gi');
    result = result.replace(regex, (match) => `<mark>${match}</mark>`);
  });
  return result;
}

export function parseVariables(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let m = regex.exec(text);
  while (m) {
    const variable = m[1].trim();
    if (variable !== '' && !variables.includes(variable)) {
      variables.push(variable);
    }
    variables.push();
    m = regex.exec(text);
  }
  return variables;
}

export function fillVariables(
  text: string,
  variables: { [key: string]: string },
) {
  let result = text;
  Object.keys(variables).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, variables[key]);
  });
  return result;
}
export function sortPrompts(prompts: IPromptDef[]) {
  if (!isArray || prompts.length === 0) {
    return [];
  }
  return prompts.sort((a: IPromptDef, b: IPromptDef) => {
    if (isNull(a.pinedAt) && isNull(b.pinedAt)) {
      return a.createdAt - b.createdAt;
    }
    if (a.pinedAt && isNull(b.pinedAt)) {
      return -1 || a.createdAt - b.createdAt;
    }
    if (b.pinedAt && isNull(a.pinedAt)) {
      return 1 || a.createdAt - b.createdAt;
    }
    return (
      (b.pinedAt as number) - (a.pinedAt as number) || a.createdAt - b.createdAt
    );
  });
}

export function insertAtCursor(field: HTMLDivElement, value: string) {
  field.focus();
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const node = document.createRange().createContextualFragment(value);
    const lastNode = node.lastChild;
    range.insertNode(node);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.setEndAfter(lastNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  } else {
    field.innerText = field.innerHTML + value;
    setCursorToEnd(field);
  }
  return field.innerHTML;
}

export function setCursorToEnd(field: HTMLDivElement) {
  const range = document.createRange();
  const selection = window.getSelection();
  if (selection) {
    range.selectNodeContents(field);
    range.collapse(false); // false means collapse to end
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

export function isGPT35(model: string) {
  return (
    model.toLowerCase().startsWith('gpt-3.5') ||
    model.toLowerCase().startsWith('gpt-35')
  );
}

export function isGPT4(model: string) {
  return model.toLowerCase().startsWith('gpt-4');
}

export function isGPT(model: string) {
  return isGPT35(model) || isGPT4(model);
}

export function isDoubao(model: string) {
  return model.toLowerCase().startsWith('doubao');
}

export function isGrok(model: string) {
  return model.toLowerCase().startsWith('grok');
}

export function isDeepSeek(model: string) {
  return model.toLowerCase().startsWith('deepseek');
}

export function isClaude1(model: string) {
  return model.toLowerCase() === 'claude-instant-1';
}

export function isClaude2(model: string) {
  return model.toLowerCase() === 'claude-2';
}

export function isClaude(model: string) {
  return isClaude1(model) || isClaude2(model);
}

export function isGemini(model: string) {
  return model.toLowerCase().startsWith('gemini');
}

export function isMoonshot(model: string) {
  return model.toLowerCase().startsWith('moonshot');
}

export function isLlama(model: string) {
  return model.toLowerCase().startsWith('llama');
}

export function tryAgain(callback: () => any, times = 3, delay = 1000) {
  let tryTimes = 0;
  const interval = setInterval(() => {
    tryTimes += 1;
    if (tryTimes > times) {
      clearInterval(interval);
    }
    try {
      if (callback()) {
        clearInterval(interval);
      }
    } catch (e) {
      console.log(e);
    }
  }, delay);
}

export function raiseError(status: number, response: any, message?: string) {
  /**
   * Azure will return resposne like follow
   * {
   *   "error": {
   *     "message": "...",
   *     "type": "invalid_request_error",
   *     "param": "messages",
   *     "code": "context_length_exceeded"
   *   }
   * }
   */
  const resp = Array.isArray(response) ? response[0] : response;
  const msg = resp?.error?.message || resp?.error || message;
  switch (status) {
    case 400:
      throw new Error(msg || 'Bad request');
    case 401:
      throw new Error(
        msg ||
          'Invalid authentication, please ensure the API key used is correct',
      );
    case 403:
      throw new Error(
        msg ||
          'Permission denied, please confirm your authority before try again.',
      );
    case 404:
      new Error(msg || 'Not found');
    case 409:
      new Error(msg || 'Conflict');
    case 429:
      new Error(
        msg ||
          'Rate limit reached for requests, or you exceeded your current quota.',
      );
    case 500:
      throw new Error(
        msg || 'The server had an error while processing your request',
      );
    case 503:
      throw new Error(
        msg || 'The engine is currently overloaded, please try again later',
      );
    default:
      throw new Error(msg || 'Unknown error');
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function getBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  return arrayBufferToBase64(await resp.arrayBuffer());
}

/**
 * Removes all HTML tags except <img> and <embed> tags.
 * Used by the editor to preserve both images and embedded documents (PDFs) when submitting content.
 */
export function removeTagsExceptMediaTags(html: string): string {
  // Remove all HTML tags except <img>, <embed>, and <iframe> tags (iframe is used for PDF display)
  return html.replace(/<(?!(img|embed|iframe)\b)[^>]*>/gi, '');
} 

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

export function splitByImg(html: string, base64Only: boolean = false) {
  const defaultMimeType = 'image/jpeg';
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.pdf': 'application/pdf',
  };
  const splitRegex = base64Only 
    ? /(<(img|embed|iframe)\s+src="data:[^"]+"\s*.*?>)/g 
    : /(<(img|embed|iframe)\s+src="[^"]+"\s*.*?>)/g;
  const srcRegex = base64Only 
    ? /<(img|embed|iframe)\s+src="(data:[^"]+)"\s*.*?>/g
    : /<(img|embed|iframe)\s+src="([^"]+)"\s*.*?>/g;
  const items = html 
    .split(splitRegex)
    .map((item) => item.trim())
    .filter((item: string) => item !== '');
  return items.map((item: string) => {
    const matches = item.match(srcRegex);
    if (matches) {
      // Get tag type from first capture group
      const tagType = matches[0].replace(srcRegex, '$1');
      let data = matches.map((match) => match.replace(srcRegex, '$2'))[0];
      const dataType = data.startsWith('data:') ? 'base64' : 'URL';
      let mimeType = defaultMimeType;
      if (dataType === 'base64') {
        mimeType = data.split(';')[0].split(':')[1];
      } else {
        const ext = `.${data.split('.').pop()?.toLowerCase()}`;
        mimeType = ext ? mimeTypes[ext] || defaultMimeType : defaultMimeType;
      }
      return {
        type: tagType === 'img' ? 'image' : 'document', // Both embed and iframe tags are treated as documents
        dataType,
        mimeType,
        data,
      };
    }
    return {
      type: 'text',
      data: item,
    };
  });
}

export function paddingZero(num: number, length: number) {
  return (Array(length).join('0') + num).slice(-length);
}

export function fileSize(sizeInBytes: number) {
  const i = Math.floor(Math.log(sizeInBytes) / Math.log(1024));
  return (
    (sizeInBytes / 1024 ** i).toFixed(1) + ['B', 'KB', 'MB', 'GB', 'TB'][i]
  );
}

export function isOneDimensionalArray(arr: any[]): boolean {
  if (!isArray(arr)) {
    throw new Error('Input is not an array.');
  }
  for (const item of arr) {
    if (isArray(item)) {
      return false; // It is a two-dimensional array
    }
  }
  return true;
}

export function extractCitationIds(text: string): string[] {
  const regex = /\[\(?\d+\)?\]\(citation#([a-z0-9]+)\s*.*?\)/g;
  // 使用matchAll返回所有匹配结果
  const matches = text.matchAll(regex);
  return [...matches].map((match) => match[1]);
}

export function extractFirstLevelBrackets(text: string): string[] {
  const results = [];
  const stack = [];
  let current = '';
  let firstLevelCapture = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '{') {
      if (stack.length === 0) {
        firstLevelCapture = true;
        current = ''; // start capturing a new section
      }
      stack.push('{');
    }

    if (firstLevelCapture) {
      current += char;
    }

    if (char === '}') {
      stack.pop();
      if (stack.length === 0) {
        firstLevelCapture = false;
        results.push(current); // end of a section
        current = ''; // reset current for the next possible section
      }
    }
  }

  return results;
}

export function getReasoningContent(reply: string, reasoning?: string) {
  if (reasoning) {
    return reasoning;
  }
  const parts = reply.split('<think>');

  if (parts.length <= 1) {
    return '';
  }

  const thinkParts = parts
    .slice(1)
    .map((part) => {
      const [content] = part.split('</think>');
      return content;
    })
    .filter(Boolean);

  return thinkParts.join('');
}

export function getNormalContent(reply: string) {
  const parts = reply.split('<think>');

  if (parts.length === 1) {
    return reply;
  }

  const replyParts = parts
    .map((part) => part.split('</think>')[1])
    .filter(Boolean);

  return replyParts.join('');
}

export function urlJoin(part: string, base: string): string {
  // Trim trailing slash from base
  const trimmedBase = base.replace(/\/+$/, '');

  // Remove leading slash from part and trim trailing slashes
  const trimmedPart = part.replace(/^\/+/, '');

  // Join with a single slash
  try {
    return new URL(`${trimmedBase}/${trimmedPart}`).toString();
  } catch {
    return '';
  }
}
