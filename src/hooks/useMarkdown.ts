/* eslint-disable react/no-danger */
import { useTranslation } from 'react-i18next';
// @ts-ignore
import MarkdownIt from 'markdown-it';
// @ts-ignore
import mathjax3 from 'markdown-it-mathjax3';
import hljs from 'highlight.js/lib/common';
import MarkdownItCodeCopy from '../libs/markdownit-plugins/CodeCopy';
import useToast from './useToast';

export default function useMarkdown() {
  const { notifySuccess } = useToast();
  const { t } = useTranslation();
  const md = new MarkdownIt({
    html: true, // This is important to allow HTML tags including iframes
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
    .use(mathjax3)
    .use(MarkdownItCodeCopy, {
      element:
        '<svg class="___1okpztj f1w7gpdv fez10in fg4l7m0 f16hsg94 fwpfdsa f88nxoq f1e2fz10" fill="currentColor" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M4 4.09v6.41A2.5 2.5 0 0 0 6.34 13h4.57c-.2.58-.76 1-1.41 1H6a3 3 0 0 1-3-3V5.5c0-.65.42-1.2 1-1.41ZM11.5 2c.83 0 1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5h-5A1.5 1.5 0 0 1 5 10.5v-7C5 2.67 5.67 2 6.5 2h5Zm0 1h-5a.5.5 0 0 0-.5.5v7c0 .28.22.5.5.5h5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5Z" fill="currentColor"></path></svg>',
      onSuccess: () => {
        notifySuccess(t('Common.Notification.Copied'));
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
  return {
    render: (str: string): string => md.render(str)
  };
}

// The markdown-it configuration above has html: true which allows raw HTML including iframe tags.
// For PDF display we're using <iframe> instead of <embed> because:
// 1. iframes have better security sandbox controls
// 2. Electron has specific security policies that may block embed tags
// 3. iframes are more widely compatible with content security policies
//
// You may need to restart the application for these changes to take full effect.
// If PDF display issues persist, try checking browser console logs for 
// specific security errors or Content Security Policy violations.
