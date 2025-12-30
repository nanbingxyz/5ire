/* eslint-disable react/no-danger */
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
// @ts-ignore
import MarkdownIt from 'markdown-it';
// @ts-ignore
import texmath from 'markdown-it-texmath';
import katex from 'katex';
// @ts-ignore
import markdownItMermaid from 'markdown-it-mermaid';
import hljs from 'highlight.js/lib/common';
import useAppearanceStore from 'stores/useAppearanceStore';
// @ts-ignore
import { full as markdownItEmoji } from 'markdown-it-emoji';
import MarkdownItCodeCopy from '../libs/markdownit-plugins/CodeCopy';
import useToast from './useToast';
// @ts-ignore
import markdownItEChartsPlugin from '../libs/markdownit-plugins/markdownItEChartsPlugin';

// 缓存配置
const CACHE_SIZE = 100;
const renderCache = new Map<string, string>();

// excluded LaTeX commands that should not be wrapped in $$
const EXCLUDED_COMMANDS = [
  '\\begin', '\\end', '\\documentclass', '\\usepackage', '\\newcommand',
  '\\renewcommand', '\\DeclareMathOperator', '\\def'
];

// 数学表达式处理函数
function processLatexExpressions(str: string): string {
  // check if the expression is already wrapped in $$
  const mathRegex = /\$([^$]+)\$/g;
  const existingMath = new Set<string>();
  let match;

  while ((match = mathRegex.exec(str)) !== null) {
    existingMath.add(match[1]);
  }

  const latexRegex = /(\\[a-zA-Z]+(?:\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})*\})*)/g;

  return str.replace(latexRegex, (match, expr) => {
    // check if the expression is already wrapped in $$
    if (existingMath.has(expr)) {
      return match;
    }

    // check if the command is in the excluded list
    const command = expr.match(/\\[a-zA-Z]+/)?.[0];
    if (command && EXCLUDED_COMMANDS.includes(command)) {
      return match;
    }

    // check if the expression is already wrapped in $$
    const index = str.indexOf(match);
    const before = str.substring(Math.max(0, index - 1), index);
    const after = str.substring(index + match.length, index + match.length + 1);

    if (before === '$' && after === '$') {
      return match;
    }

    return `$${expr}$`;
  });
}

function batchProcessString(str: string): string {
  try {
    // step 1: replace \pi with π
    let result = str.replace(/\\pi/g, 'π');

    // step 2: process LaTeX expressions
    result = processLatexExpressions(result);

    // step 3: handle left/right parentheses
    result = result.replace(/\\left|\\right/g, (match) =>
      match === '\\left' ? '(' : ')'
    );

    return result;
  } catch (error) {
    console.error('Error processing LaTeX expressions:', error);
    return str; // return original string in case of error
  }
}

function getCachedResult(key: string): string | undefined {
  return renderCache.get(key);
}

function setCachedResult(key: string, value: string): void {
  if (renderCache.size >= CACHE_SIZE) {
    // remove the oldest entry if cache size exceeds limit
    const firstKey = renderCache.keys().next().value;
    renderCache.delete(firstKey || '');
  }
  renderCache.set(key, value);
}

export default function useMarkdown() {
  const theme = useAppearanceStore((state) => state.theme);
  const { notifySuccess } = useToast();
  const { t } = useTranslation();

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight(str: string, lang: string) {
      // notice: 硬编码解决 ellipsis-loader 被转移为代码显示的问题。
      const loader = '<span class="blinking-cursor" /></span>';
      const isLoading = str.indexOf(loader) > -1;
      let code = str;
      if (isLoading) {
        code = str.replace(loader, '');
      }

      if (lang && hljs.getLanguage(lang)) {
        try {
          return (
            `<pre className="hljs">` +
            `<code>${
              hljs.highlight(code, {
                language: lang,
                ignoreIllegals: true,
              }).value
            }${isLoading ? loader : ''}</code></pre>`
          );
        } catch (__) {
          return (
            `<pre className="hljs">` +
            `<code>${hljs.highlightAuto(code).value}${
              isLoading ? loader : ''
            }</code>` +
            `</pre>`
          );
        }
      }
      return (
        `<pre className="hljs">` +
        `<code>${hljs.highlightAuto(code).value}${
          isLoading ? loader : ''
        }</code>` +
        `</pre>`
      );
    },
  })
    .use(texmath, {
      engine: katex,
      delimiters: 'dollars',
      katexOptions: {},
    })
    .use(markdownItMermaid, {
      startOnLoad: false,
      securityLevel: 'strict',
    })
    .use(MarkdownItCodeCopy, {
      element:
        '<svg class="___1okpztj f1w7gpdv fez10in fg4l7m0 f16hsg94 fwpfdsa f88nxoq f1e2fz10" fill="currentColor" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M4 4.09v6.41A2.5 2.5 0 0 0 6.34 13h4.57c-.2.58-.76 1-1.41 1H6a3 3 0 0 1-3-3V5.5c0-.65.42-1.2 1-1.41ZM11.5 2c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-5A1.5 1.5 0 0 1 5 10.5v-7C5 2.67 5.67 2 6.5 2h5Zm0 1h-5a.5.5 0 0 0-.5.5v7c0 .28.22.5.5.5h5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5Z" fill="currentColor"></path></svg>',
      onSuccess: () => {
        notifySuccess(t('Common.Notification.Copied'));
      },
    })
    .use(markdownItEmoji)
    .use(markdownItEChartsPlugin);

  md.mermaid.loadPreferences({
    get: (key: string) => {
      if (key === 'mermaid-theme') {
        return theme === 'dark' ? 'dark' : 'default';
      }
      if (key === 'gantt-axis-format') {
        return '%Y/%m/%d';
      }
      return undefined;
    },
  });

  const defaultRender =
    md.renderer.rules.link_open ||
    function (tokens: any, idx: any, options: any, env: any, self: any) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.link_open = function (
    tokens: any,
    idx: any,
    options: any,
    env: any,
    self: any,
  ) {
    // Add a new `target` attribute, or replace the value of the existing one.
    tokens[idx].attrSet('target', '_blank');
    // Pass the token to the default renderer.
    return defaultRender(tokens, idx, options, env, self);
  };

  const defaultImageRender =
    md.renderer.rules.image ||
    function (tokens: any, idx: any, options: any, env: any, self: any) {
      return self.renderToken(tokens, idx, options);
    };

  md.renderer.rules.image = function (
    tokens: any,
    idx: any,
    options: any,
    env: any,
    self: any,
  ) {
    const token = tokens[idx];
    const srcIndex = token.attrIndex('src');
    if (srcIndex >= 0) {
      const src = token.attrs[srcIndex][1];
      if (
        !src.startsWith('http') &&
        !src.startsWith('file://') &&
        !src.startsWith('data:')
      ) {
        token.attrs[srcIndex][1] = `file://${src}`;
      }
    }
    return defaultImageRender(tokens, idx, options, env, self);
  };

  return {
    render: (str: string): string => {
      const cached = getCachedResult(str);
      if (cached) {
        return cached;
      }
      try {
        const processedStr = batchProcessString(str);
        const result = DOMPurify.sanitize(md.render(processedStr));
        setCachedResult(str, result);
        return result;
      } catch (error) {
        console.error('Error rendering markdown:', error);
        return DOMPurify.sanitize(str);
      }
    },
    clearCache: () => {
      renderCache.clear();
    },
    getCacheStats: () => ({
      size: renderCache.size,
      maxSize: CACHE_SIZE,
    }),
  };
}
