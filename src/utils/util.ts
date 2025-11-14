import { TEMP_CHAT_ID } from "consts";
import DOMPurify from "dompurify";
import type { IChat, IPromptDef } from "intellichat/types";
import { isArray, isNull } from "lodash";

export function date2unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

export function unix2date(unix: number) {
  return new Date(unix * 1000);
}

export function getRelativeTime(date: Date) {
  const locales: { [key: string]: string } = {
    prefix: "",
    suffix: "ago",
    seconds: "less than a minute",
    minute: "about a minute",
    minutes: "%d minutes",
    hour: "about an hour",
    hours: "about %d hours",
    day: "a day",
    days: "%d days",
    month: "about a month",
    months: "%d months",
    year: "about a year",
    years: "%d years",
  };
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const separator = locales.separator || " ";
  let words = locales.prefix + separator;
  let interval: number = 0;
  const intervals: { [key: string]: number } = {
    year: seconds / 31536000,
    month: seconds / 2592000,
    day: seconds / 86400,
    hour: seconds / 3600,
    minute: seconds / 60,
  };

  var distance = locales.seconds;

  for (var key in intervals) {
    interval = Math.floor(intervals[key]);
    if (interval > 1) {
      distance = locales[key + "s"];
      break;
    } else if (interval === 1) {
      distance = locales[key];
      break;
    }
  }

  distance = distance.replace(/%d/i, `${interval}`);
  words += distance + separator + locales.suffix;
  return words.trim();
}

export function isTagClosed(code: string, tag: string) {
  if (!code || code.trim() === "") return true;
  if (!tag || tag.trim() === "") return true;
  const openRegex = new RegExp(`<${tag}>`, "g");
  const closeRegex = new RegExp(`</${tag}>`, "g");
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

export function isPersistedChat(chat: Partial<IChat>): boolean {
  return !!chat.id && chat.id !== TEMP_CHAT_ID;
}
export function fmtDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function fmtDateTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${fmtDate(date)} ${hours}:${minutes}:${seconds}`;
}

export function highlight(text: string, keyword: string | string[]) {
  if (!text) return "";
  if (!keyword) return text;
  if (typeof keyword === "string") {
    if (keyword.trim() === "") return text;
    const regex = new RegExp(keyword.trim(), "gi");
    return DOMPurify.sanitize(text).replace(regex, (match) => `<mark>${match}</mark>`);
  }
  let result = text;
  keyword.forEach((word) => {
    const regex = new RegExp(word, "gi");
    result = DOMPurify.sanitize(result).replace(regex, (match) => `<mark>${match}</mark>`);
  });
  return result;
}

export function parseVariables(text: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables: string[] = [];
  let m = regex.exec(text);
  while (m) {
    const variable = m[1].trim();
    if (variable !== "" && !variables.includes(variable)) {
      variables.push(variable);
    }
    variables.push();
    m = regex.exec(text);
  }
  return variables;
}

export function fillVariables(text: string, variables: { [key: string]: string }) {
  let result = text;
  Object.keys(variables).forEach((key) => {
    const regex = new RegExp(`{{${key}}}`, "g");
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
    return (b.pinedAt as number) - (a.pinedAt as number) || a.createdAt - b.createdAt;
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
  return model.toLowerCase().startsWith("gpt-3.5") || model.toLowerCase().startsWith("gpt-35");
}

export function isGPT4(model: string) {
  return model.toLowerCase().startsWith("gpt-4");
}

export function isGPT(model: string) {
  return isGPT35(model) || isGPT4(model);
}

export function isDoubao(model: string) {
  return model.toLowerCase().startsWith("doubao");
}

export function isGrok(model: string) {
  return model.toLowerCase().startsWith("grok");
}

export function isDeepSeek(model: string) {
  return model.toLowerCase().startsWith("deepseek");
}

export function isClaude1(model: string) {
  return model.toLowerCase() === "claude-instant-1";
}

export function isClaude2(model: string) {
  return model.toLowerCase() === "claude-2";
}

export function isClaude(model: string) {
  return isClaude1(model) || isClaude2(model);
}

export function isGemini(model: string) {
  return model.toLowerCase().startsWith("gemini");
}

export function isMoonshot(model: string) {
  return model.toLowerCase().startsWith("moonshot");
}

export function isLlama(model: string) {
  return model.toLowerCase().startsWith("llama");
}

export function isZhipu(model: string) {
  return model.toLowerCase().startsWith("glm");
}

export function isPerplexity(model: string) {
  return model.toLowerCase().startsWith("sonar");
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
      throw new Error(msg || "Bad request");
    case 401:
      throw new Error(msg || "Invalid authentication, please ensure the API key used is correct");
    case 403:
      throw new Error(msg || "Permission denied, please confirm your authority before try again.");
    case 404:
      throw new Error(msg || "Not found");
    case 409:
      throw new Error(msg || "Conflict");
    case 429:
      throw new Error(msg || "Rate limit reached for requests, or you exceeded your current quota.");
    case 500:
      throw new Error(msg || "The server had an error while processing your request");
    case 503:
      throw new Error(msg || "The engine is currently overloaded, please try again later");
    default:
      throw new Error(msg || "Unknown error");
  }
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
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

export function removeTagsExceptImg(html: string): string {
  // 使用正则表达式移除除 <img> 以外的所有标签
  return html.replace(/<(?!img\b)[^>]*>/gi, "");
}

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export function splitByImg(html: string, base64Only: boolean = false) {
  const defaultMimeType = "image/jpeg";
  const mimeTypes: { [key: string]: string } = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  const splitRegex = base64Only ? /(<img\s+src="data:[^"]+"\s*.*\/?>)/g : /(<img\s+src="[^"]+"\s*.*\/?>)/g;
  const srcRegex = base64Only ? /<img\s+src="(data:[^"]+)"\s*.*\/?>/g : /<img\s+src="([^"]+)"\s*.*\/?>/g;
  const items = html
    .split(splitRegex)
    .map((item) => item.trim())
    .filter((item: string) => item !== "");
  return items.map((item: string) => {
    const matches = item.match(srcRegex);
    if (matches) {
      const data = matches.map((match) => match.replace(srcRegex, "$1"))[0];
      const dataType = data.startsWith("data:") ? "base64" : "URL";
      let mimeType = defaultMimeType;
      if (dataType === "base64") {
        mimeType = data.split(";")[0].split(":")[1];
      } else {
        const ext = `.${data.split(".").pop()?.toLowerCase()}`;
        mimeType = ext ? mimeTypes[ext] || defaultMimeType : defaultMimeType;
      }
      return {
        type: "image",
        dataType,
        mimeType,
        data,
      } as const;
    }
    return {
      type: "text",
      data: item,
    } as const;
  });
}

export function splitByCitations(input: string) {
  const regex = /\[\(?\d+\)?\]\(citation#([a-z0-9-]+)\s*.*?\)/g;

  const result: Array<string | { id: string }> = [];
  let lastIndex = 0;

  for (const match of input.matchAll(regex)) {
    const start = match.index!;
    const end = start + match[0].length;
    const id = match[1];

    if (start > lastIndex) {
      const text = input.slice(lastIndex, start);
      if (text) result.push(text);
    }

    // citation
    result.push({ id });

    lastIndex = end;
  }

  if (lastIndex < input.length) {
    const text = input.slice(lastIndex);
    if (text) result.push(text);
  }

  return result;
}

export function paddingZero(num: number, length: number) {
  return (Array(length).join("0") + num).slice(-length);
}

export function fileSize(sizeInBytes: number) {
  const i = Math.floor(Math.log(sizeInBytes) / Math.log(1024));
  return (sizeInBytes / 1024 ** i).toFixed(1) + ["B", "KB", "MB", "GB", "TB"][i];
}

export function isOneDimensionalArray(arr: any[]): boolean {
  if (!isArray(arr)) {
    throw new Error("Input is not an array.");
  }
  for (const item of arr) {
    if (isArray(item)) {
      return false; // It is a two-dimensional array
    }
  }
  return true;
}

export function extractCitationIds(text: string): string[] {
  const regex = /\[\(?\d+\)?\]\(citation#([a-z0-9-]+)\s*.*?\)/g;
  // 使用matchAll返回所有匹配结果
  const matches = text.matchAll(regex);
  return [...matches].map((match) => match[1]);
}

export function extractFirstLevelBrackets(text: string): string[] {
  const results = [];
  const stack = [];
  let current = "";
  let firstLevelCapture = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === "{") {
      if (stack.length === 0) {
        firstLevelCapture = true;
        current = ""; // start capturing a new section
      }
      stack.push("{");
    }

    if (firstLevelCapture) {
      current += char;
    }

    if (char === "}") {
      stack.pop();
      if (stack.length === 0) {
        firstLevelCapture = false;
        results.push(current); // end of a section
        current = ""; // reset current for the next possible section
      }
    }
  }

  return results;
}

export function getReasoningContent(reply: string, reasoning?: string) {
  if (reasoning) {
    return reasoning;
  }
  const parts = reply.split("<think>");

  if (parts.length <= 1) {
    return "";
  }

  const thinkParts = parts
    .slice(1)
    .map((part) => {
      const [content] = part.split("</think>");
      return content;
    })
    .filter(Boolean);

  return thinkParts.join("");
}

export function getNormalContent(reply: string) {
  const parts = reply.split("<think>");

  if (parts.length === 1) {
    return reply;
  }

  const replyParts = parts.map((part) => part.split("</think>")[1]).filter(Boolean);

  return replyParts.join("");
}

export function urlJoin(part: string, base: string): string {
  // Trim trailing slash from base
  const trimmedBase = base.replace(/\/+$/, "");

  // Remove leading slash from part and trim trailing slashes
  const trimmedPart = part.replace(/^\/+/, "");

  // Join with a single slash
  try {
    return new URL(`${trimmedBase}/${trimmedPart}`).toString();
  } catch {
    return "";
  }
}

export type JsonValue = string | number | boolean | null | JsonArray | JsonObject;
export type JsonArray = JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

export function transformPropertiesType(obj: JsonValue): JsonValue {
  // 如果是数组，遍历处理每个元素
  if (Array.isArray(obj)) {
    return obj.map((item) => transformPropertiesType(item));
  }

  // 如果不是对象，直接返回
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  // 处理对象
  const result: JsonObject = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key === "properties" && typeof value === "object" && value !== null) {
      // 处理 properties 对象
      const transformedProperties: JsonObject = {};

      for (const [propKey, propValue] of Object.entries(value)) {
        if (typeof propValue === "object" && propValue !== null) {
          // 递归处理嵌套的对象
          const transformed = transformPropertiesType(propValue) as JsonObject;

          // 检查并转换当前层级的 type 属性
          if ("type" in transformed && Array.isArray(transformed.type)) {
            const typeArray = transformed.type as JsonArray;
            const firstNonNull = typeArray.find((t) => t !== null && t !== "null");
            transformed.type = firstNonNull || typeArray[0];
          }

          transformedProperties[propKey] = transformed;
        } else {
          transformedProperties[propKey] = propValue;
        }
      }

      result[key] = transformedProperties;
    } else {
      // 递归处理其他属性
      result[key] = transformPropertiesType(value);
    }
  }

  return result;
}

export function removeAdditionalProperties(schema: any): any {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => removeAdditionalProperties(item));
  }

  const result = { ...schema };

  delete result.additionalProperties;

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "object" && value !== null) {
      if (key === "properties") {
        const properties: any = {};
        for (const [propKey, propValue] of Object.entries(value)) {
          properties[propKey] = removeAdditionalProperties(propValue);
        }
        result[key] = properties;
      } else {
        result[key] = removeAdditionalProperties(value);
      }
    }
  }

  return result;
}

// Gemini require explicitly set type to string
export function addStringTypeToEnumProperty(schema: any): any {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => addStringTypeToEnumProperty(item));
  }

  const result = { ...schema };

  if ("enum" in schema && Array.isArray(schema.enum)) {
    result.type = "string";
  }

  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === "object" && value !== null) {
      if (key === "properties") {
        const properties: any = {};
        for (const [propKey, propValue] of Object.entries(value)) {
          properties[propKey] = addStringTypeToEnumProperty(propValue);
        }
        result[key] = properties;
      } else {
        result[key] = addStringTypeToEnumProperty(value);
      }
    }
  }

  return result;
}

export function genDefaultName(pool: string[], prefix: string): string {
  let i = 1;
  let name = `${prefix}${i}`;
  while (pool.includes(name)) {
    i++;
    name = `${prefix}${i}`;
  }
  return name;
}
