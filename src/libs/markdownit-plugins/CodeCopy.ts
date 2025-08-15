import merge from 'lodash/merge';

/**
 * Global clipboard instance for handling copy operations.
 * Initialized only in browser environments where the clipboard library is available.
 */
let clipboard: any = null;
try {
  // Node js will throw an error
  this === window;

  const Clipboard = require('clipboard');
  clipboard = new Clipboard('.markdown-it-code-copy');
} catch (_err) {}

/**
 * Default configuration options for the code copy plugin.
 * These options control the appearance and behavior of the copy button.
 */
const defaultOptions = {
  iconStyle: 'font-size: 21px; opacity: 0.4;',
  iconClass: 'mdi mdi-content-copy',
  buttonStyle:
    'position: absolute; top: 7.5px; right: 6px; cursor: pointer; outline: none;',
  buttonClass: '',
  element: '',
};

/**
 * Creates a wrapper function that enhances code block rendering with copy functionality.
 * Takes the original rendering rule and adds a copy button to the rendered output.
 * 
 * @param {Function} origRule - The original markdown-it rendering rule function
 * @param {Object} options - Configuration options for button styling and behavior
 * @param {string} options.buttonClass - CSS class for the copy button
 * @param {string} options.buttonStyle - Inline styles for the copy button
 * @param {string} options.iconStyle - Inline styles for the copy icon
 * @param {string} options.iconClass - CSS class for the copy icon
 * @param {string} options.element - Additional element content for the button
 * @returns {Function} A new rendering function that includes the copy button
 */
function renderCode(
  origRule: (...args: [any, any]) => any,
  options: {
    buttonClass: any;
    buttonStyle: any;
    iconStyle: any;
    iconClass: any;
    element: any;
  },
) {
  options = merge(defaultOptions, options);
  return (...args: [any, any]) => {
    const [tokens, idx] = args;
    const content = tokens[idx].content
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
    const origRendered = origRule(...args);
    if (content.length === 0) return origRendered;

    return `
<div style="position: relative">
	${origRendered}
	<button class="markdown-it-code-copy ${options.buttonClass}" data-clipboard-text="${content}" style="${options.buttonStyle}" title="Copy">
		<span style="${options.iconStyle}" class="${options.iconClass}">${options.element}</span>
	</button>
</div>
`;
  };
}

/**
 * Main plugin function that adds copy functionality to markdown-it code blocks.
 * Registers the plugin with markdown-it and sets up event handlers for copy operations.
 * 
 * @param {any} md - The markdown-it instance to enhance
 * @param {Object} options - Plugin configuration options including success/error callbacks
 * @param {Function} [options.onSuccess] - Callback function executed when copy operation succeeds
 * @param {Function} [options.onError] - Callback function executed when copy operation fails
 */
export default function MarkdownItCodeCopy(md: any, options: any) {
  if (clipboard) {
    clipboard.off('success');
    if (options.onSuccess) {
      clipboard.on('success', options.onSuccess);
    }
    clipboard.off('onError');
    if (options.onError) {
      clipboard.on('error', options.onError);
    }
  }
  md.renderer.rules.code_block = renderCode(
    md.renderer.rules.code_block,
    options,
  );
  md.renderer.rules.fence = renderCode(md.renderer.rules.fence, options);
}
