/* eslint import/prefer-default-export: off */

import crypto from "crypto";
import { fileTypeFromFile } from "file-type";
import fs from "fs";
import path from "path";
import { URL } from "url";

export function resolveHtmlPath(htmlFileName: string) {
  if (process.env.NODE_ENV === "development") {
    const port = process.env.PORT || 1212;
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  }
  return `file://${path.resolve(__dirname, "../renderer/", htmlFileName)}`;
}

export function randomId() {
  return crypto.randomBytes(16).toString("hex");
}

// https://www.llamaindex.ai/blog/evaluating-the-ideal-chunk-size-for-a-rag-system-using-llamaindex-6207e5d3fec5
// 1028
export function slidingWindowChunk(text: string, chunkSize = 512, slideSize = 384) {
  if (chunkSize <= 0 || slideSize <= 0) {
    throw new Error("Chunk size and slide size must be positive");
  }
  if (chunkSize >= text.length) {
    return [text];
  }
  const result = [];
  let i = 0;

  while (i + chunkSize <= text.length) {
    result.push(text.slice(i, i + chunkSize));
    i += slideSize;
  }

  return result;
}

// Used in https://jina.ai/tokenizer (Aug. 14th version)
// Define variables for magic numbers
const MAX_HEADING_LENGTH = 6;
const MAX_HEADING_CONTENT_LENGTH = 200;
const MAX_HEADING_UNDERLINE_LENGTH = 200;
const MAX_HTML_HEADING_ATTRIBUTES_LENGTH = 100;
const MAX_LIST_ITEM_LENGTH = 200;
const MAX_NESTED_LIST_ITEMS = 5;
const MAX_LIST_INDENT_SPACES = 7;
const MAX_BLOCKQUOTE_LINE_LENGTH = 200;
const MAX_BLOCKQUOTE_LINES = 10;
const MAX_CODE_BLOCK_LENGTH = 1000;
const MAX_CODE_LANGUAGE_LENGTH = 20;
const MAX_INDENTED_CODE_LINES = 20;
const MAX_TABLE_CELL_LENGTH = 200;
const MAX_TABLE_ROWS = 20;
const MAX_HTML_TABLE_LENGTH = 2000;
const MIN_HORIZONTAL_RULE_LENGTH = 3;
const MAX_SENTENCE_LENGTH = 300;
const MAX_QUOTED_TEXT_LENGTH = 300;
const MAX_PARENTHETICAL_CONTENT_LENGTH = 200;
const MAX_NESTED_PARENTHESES = 5;
const MAX_MATH_INLINE_LENGTH = 100;
const MAX_MATH_BLOCK_LENGTH = 500;
const MAX_PARAGRAPH_LENGTH = 1000;
const MAX_STANDALONE_LINE_LENGTH = 400;
const MAX_HTML_TAG_ATTRIBUTES_LENGTH = 100;
const MAX_HTML_TAG_CONTENT_LENGTH = 1000;

// Read the regex and test text from files
const chunkRegex = new RegExp(
  "(" +
    // 1. Headings (Setext-style, Markdown, and HTML-style, with length constraints)
    `(?:^(?:[#*=-]{1,${MAX_HEADING_LENGTH}}|\\w[^\\r\\n]{0,${MAX_HEADING_CONTENT_LENGTH}}\\r?\\n[-=]{2,${MAX_HEADING_UNDERLINE_LENGTH}}|<h[1-6][^>]{0,${MAX_HTML_HEADING_ATTRIBUTES_LENGTH}}>)[^\\r\\n]{1,${MAX_HEADING_CONTENT_LENGTH}}(?:</h[1-6]>)?(?:\\r?\\n|$))` +
    "|" +
    // 2. List items (bulleted, numbered, lettered, or task lists, including nested, up to three levels, with length constraints)
    `(?:(?:^|\\r?\\n)[ \\t]{0,3}(?:[-*+•]|\\d{1,3}\\.\\w\\.|\\[[ xX]\\])[ \\t]+[^\\r\\n]{1,${MAX_LIST_ITEM_LENGTH}}` +
    `(?:(?:\\r?\\n[ \\t]{2,5}(?:[-*+•]|\\d{1,3}\\.\\w\\.|\\[[ xX]\\])[ \\t]+[^\\r\\n]{1,${MAX_LIST_ITEM_LENGTH}}){0,${MAX_NESTED_LIST_ITEMS}}` +
    `(?:\\r?\\n[ \\t]{4,${MAX_LIST_INDENT_SPACES}}(?:[-*+•]|\\d{1,3}\\.\\w\\.|\\[[ xX]\\])[ \\t]+[^\\r\\n]{1,${MAX_LIST_ITEM_LENGTH}}){0,${MAX_NESTED_LIST_ITEMS}})?)` +
    "|" +
    // 3. Block quotes (including nested quotes and citations, up to three levels, with length constraints)
    `(?:(?:^>(?:>|\\s{2,}){0,2}[^\\r\\n]{0,${MAX_BLOCKQUOTE_LINE_LENGTH}}\\r?\\n?){1,${MAX_BLOCKQUOTE_LINES}})` +
    "|" +
    // 4. Code blocks (fenced, indented, or HTML pre/code tags, with length constraints)
    `(?:(?:^|\\r?\\n)(?:\`\`\`|~~~)(?:\\w{0,${MAX_CODE_LANGUAGE_LENGTH}})?\\r?\\n[\\s\\S]{0,${MAX_CODE_BLOCK_LENGTH}}?(?:\`\`\`|~~~)\\r?\\n?` +
    `|(?:(?:^|\\r?\\n)(?: {4}|\\t)[^\\r\\n]{0,${MAX_LIST_ITEM_LENGTH}}(?:\\r?\\n(?: {4}|\\t)[^\\r\\n]{0,${MAX_LIST_ITEM_LENGTH}}){0,${MAX_INDENTED_CODE_LINES}}\\r?\\n?)` +
    `|(?:<pre>(?:<code>)?[\\s\\S]{0,${MAX_CODE_BLOCK_LENGTH}}?(?:</code>)?</pre>))` +
    "|" +
    // 5. Tables (Markdown, grid tables, and HTML tables, with length constraints)
    `(?:(?:^|\\r?\\n)(?:\\|[^\\r\\n]{0,${MAX_TABLE_CELL_LENGTH}}\\|(?:\\r?\\n\\|[-:]{1,${MAX_TABLE_CELL_LENGTH}}\\|){0,1}(?:\\r?\\n\\|[^\\r\\n]{0,${MAX_TABLE_CELL_LENGTH}}\\|){0,${MAX_TABLE_ROWS}}` +
    `|<table>[\\s\\S]{0,${MAX_HTML_TABLE_LENGTH}}?</table>))` +
    "|" +
    // 6. Horizontal rules (Markdown and HTML hr tag)
    `(?:^(?:[-*_]){${MIN_HORIZONTAL_RULE_LENGTH},}\\s*$|<hr\\s*/?>)` +
    "|" +
    // 10. Standalone lines or phrases (including single-line blocks and HTML elements, with length constraints)
    `(?:^(?:<[a-zA-Z][^>]{0,${MAX_HTML_TAG_ATTRIBUTES_LENGTH}}>)?[^\\r\\n]{1,${MAX_STANDALONE_LINE_LENGTH}}(?:</[a-zA-Z]+>)?(?:\\r?\\n|$))` +
    "|" +
    // 7. Sentences or phrases ending with punctuation (including ellipsis and Unicode punctuation)
    `(?:[^\\r\\n]{1,${MAX_SENTENCE_LENGTH}}(?:[.!?…]|\\.{3}|[\\u2026\\u2047-\\u2049]|[\\p{Emoji_Presentation}\\p{Extended_Pictographic}])(?=(?=\\s)(?=\\s*[A-Z])|(?=\\r?\\n)|(?=\\Z)))` +
    "|" +
    // 8. Quoted text, parenthetical phrases, or bracketed content (with length constraints)
    "(?:" +
    `"""[^\\r\\n]{0,${MAX_QUOTED_TEXT_LENGTH}}"""` +
    `|['"\`'"][^\\r\\n]{0,${MAX_QUOTED_TEXT_LENGTH}}['"\`'"]` +
    `|\\([^\\r\\n()]{0,${MAX_PARENTHETICAL_CONTENT_LENGTH}}(?:\\([^\\r\\n()]{0,${MAX_PARENTHETICAL_CONTENT_LENGTH}}\\)[^\\r\\n()]{0,${MAX_PARENTHETICAL_CONTENT_LENGTH}}){0,${MAX_NESTED_PARENTHESES}}\\)` +
    `|\\[[^\\r\\n\\[\\]]{0,${MAX_PARENTHETICAL_CONTENT_LENGTH}}(?:\\[[^\\r\\n\\[\\]]{0,${MAX_PARENTHETICAL_CONTENT_LENGTH}}\\][^\\r\\n\\[\\]]{0,${MAX_PARENTHETICAL_CONTENT_LENGTH}}){0,${MAX_NESTED_PARENTHESES}}\\]` +
    `|\\$[^\\r\\n$]{0,${MAX_MATH_INLINE_LENGTH}}\\$` +
    `|\`[^\`\\r\\n]{0,${MAX_MATH_INLINE_LENGTH}}\`` +
    ")" +
    "|" +
    // 9. Paragraphs (with length constraints)
    `(?:(?<=\\r?\\n\\r?\\n|\\A)(?:<p>)?(?:(?!\\r?\\n\\r?\\n|\\z).){1,${MAX_PARAGRAPH_LENGTH}}(?:</p>)?(?=\\r?\\n\\r?\\n|\\z))` +
    "|" +
    // 11. HTML-like tags and their content (including self-closing tags and attributes, with length constraints)
    `(?:<[a-zA-Z][^>]{0,${MAX_HTML_TAG_ATTRIBUTES_LENGTH}}(?:>[\\s\\S]{0,${MAX_HTML_TAG_CONTENT_LENGTH}}?</[a-zA-Z]+>|\\s*/>))` +
    "|" +
    // 12. LaTeX-style math expressions (inline and block, with length constraints)
    `(?:(?:\\$\\$[\\s\\S]{0,${MAX_MATH_BLOCK_LENGTH}}?\\$\\$)|(?:\\$[^\\$\\r\\n]{0,${MAX_MATH_INLINE_LENGTH}}\\$))` +
    "|" +
    // 14. Fallback for any remaining content (with length constraints)
    `(?:[^\\r\\n]{1,${MAX_STANDALONE_LINE_LENGTH}})` +
    ")",
  "gm",
);

export function smartChunk(text: string): string[] {
  return text.match(chunkRegex)?.filter((i) => i.trim() !== "") || [];
}

export function getFileInfo(filePath: string) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      const name = path.basename(filePath);
      const { size } = stats;
      return resolve({ name, size, path: filePath });
    });
  });
}

export async function getFileType(filePath: string): Promise<string> {
  const ret = await fileTypeFromFile(filePath);
  if (ret && ret.ext) {
    return ret.ext;
  }
  const ext = filePath.split(".").pop() || "txt";
  return ext.toLocaleLowerCase();
}

export function decodeBase64(str: string): string | null {
  if (typeof str !== "string") return null;
  str = str.trim();
  if (str.length % 4 !== 0) return null;
  const base64Reg = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/;
  if (!base64Reg.test(str)) return null;
  try {
    return Buffer.from(str, "base64").toString("utf-8");
  } catch (e) {
    return null;
  }
}
