import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogTrigger,
  DialogBody,
  Button,
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import { useTranslation } from 'react-i18next';
import {
  Dismiss24Regular,
  WrenchScrewdriver24Regular,
} from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import useMarkdown from 'hooks/useMarkdown';

import { IMCPServer } from 'types/mcp';
import Spinner from 'renderer/components/Spinner';

/**
 * Dialog component that displays detailed information about MCP server tools and prompts.
 * Shows an accordion-style interface with expandable sections for each tool and prompt.
 * 
 * @param {Object} options - Component configuration options
 * @param {IMCPServer | null} options.server - The MCP server to display details for
 * @param {boolean} options.open - Whether the dialog is currently open
 * @param {Function} options.setOpen - Function to control the dialog's open state
 * @returns {JSX.Element} The rendered dialog component
 */
export default function ToolDetailDialog(options: {
  server: IMCPServer | null;
  open: boolean;
  setOpen: Function;
}) {
  const { server, open, setOpen } = options;
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const { render } = useMarkdown();

  /**
   * Loads the list of available tools from the specified MCP server.
   * Only loads tools if the server has the 'tools' capability.
   * Updates the tools state with the retrieved data.
   * 
   * @param {IMCPServer} svr - The MCP server to load tools from
   * @returns {Promise<void>} Promise that resolves when tools are loaded
   */
  const loadTools = async (svr: IMCPServer) => {
    if (svr.capabilities.includes('tools')) {
      const res = await window.electron.mcp.listTools(svr.key);
      setTools(res.tools || []);
    } else {
      setTools([]);
    }
  };

  /**
   * Loads the list of available prompts from the specified MCP server.
   * Only loads prompts if the server has the 'prompts' capability.
   * Updates the prompts state with the retrieved data.
   * 
   * @param {IMCPServer} svr - The MCP server to load prompts from
   * @returns {Promise<void>} Promise that resolves when prompts are loaded
   */
  const loadPrompts = async (svr: IMCPServer) => {
    if (svr.capabilities.includes('prompts')) {
      const res = await window.electron.mcp.listPrompts(svr.key);
      if (res.prompts.length) {
        setPrompts(res.prompts[0].prompts || []);
        return;
      }
    }
    setPrompts([]);
  };

  /**
   * Loads both tools and prompts data for the current server.
   * Sets loading state during the data fetching process.
   * 
   * @returns {Promise<void>} Promise that resolves when all data is loaded
   */
  const loadData = async () => {
    if (server) {
      setLoading(true);
      try {
        await Promise.all([loadTools(server), loadPrompts(server)]);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (open) {
      Mousetrap.bind('esc', () => setOpen(false));
      loadData();
    }
    return () => {
      Mousetrap.unbind('esc');
      setTools([]);
      setPrompts([]);
    };
  }, [open]);

  return (
    <Dialog open={open}>
      <DialogSurface mountNode={document.body.querySelector('#portal')}>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  onClick={() => setOpen(false)}
                  appearance="subtle"
                  aria-label="close"
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            <div className="mb-4">
              <div className="flex items-center gap-2 font-bold">
                <WrenchScrewdriver24Regular />
                {server?.key}
              </div>
              <p className="text-sm tips ml-1 mt-2">{server?.description}</p>
            </div>
          </DialogTitle>
          <DialogContent>
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <Spinner size={32} />
              </div>
            ) : (
              <>
                {tools.length > 0 && (
                  <div>
                    <h2 className="text-base font-semibold">
                      {t('Common.Tools')}
                    </h2>
                    <Accordion multiple collapsible className="mt-4">
                      {tools.map((tool: any) => (
                        <AccordionItem
                          value={tool.name}
                          key={tool.name}
                          className="-my-3"
                        >
                          <AccordionHeader>
                            <div className="text-gray-500 dark:text-gray-300 font-bold">
                              {tool.name.split('--')[1]}
                            </div>
                          </AccordionHeader>
                          <AccordionPanel>
                            <div className="border-l border-dotted border-stone-300 dark:border-gray-500 ml-2 pl-2 pb-3 mb-2">
                              <div className="text-sm text-gray-500 dark:text-gray-300 ml-3">
                                {tool.description}
                              </div>
                              <div className="mt-2 ml-2">
                                <fieldset className="border border-stone-300 dark:border-stone-600 rounded bg-stone-50 dark:bg-stone-800">
                                  <legend className="text-sm px-1 ml-2 text-gray-500 dark:text-gray-300">
                                    inputSchema
                                  </legend>
                                  <div
                                    className="-mt-1 ghost p-2"
                                    dangerouslySetInnerHTML={{
                                      __html: render(
                                        `\`\`\`json\n${JSON.stringify(tool.inputSchema, null, 2)}\n\`\`\``,
                                      ),
                                    }}
                                  />
                                </fieldset>
                              </div>
                            </div>
                          </AccordionPanel>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
                {prompts.length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-base font-semibold">
                      {t('Common.Prompts')}
                    </h2>
                    <Accordion multiple collapsible className="mt-4">
                      {prompts.map((prompt: any) => (
                        <AccordionItem
                          value={prompt.name}
                          key={prompt.name}
                          className="-my-3"
                        >
                          <AccordionHeader>
                            <div className="text-gray-500 dark:text-gray-300 font-bold">
                              {prompt.name}
                            </div>
                          </AccordionHeader>
                          <AccordionPanel>
                            <div className="border-l border-dotted border-stone-300 dark:border-gray-500 ml-2 pl-2 pb-3 mb-2">
                              <div className="text-sm text-gray-500 dark:text-gray-300 ml-3">
                                {prompt.description}
                              </div>
                              {prompt.arguments && (
                                <div className="mt-2 ml-2">
                                  <fieldset className="border border-stone-300 dark:border-stone-600 rounded bg-stone-50 dark:bg-stone-800">
                                    <legend className="text-sm px-1 ml-2 text-gray-500 dark:text-gray-300">
                                      Arguments
                                    </legend>
                                    <div
                                      className="-mt-1 ghost p-2"
                                      dangerouslySetInnerHTML={{
                                        __html: render(
                                          `\`\`\`json\n${JSON.stringify(prompt.arguments, null, 2)}\n\`\`\``,
                                        ),
                                      }}
                                    />
                                  </fieldset>
                                </div>
                              )}
                            </div>
                          </AccordionPanel>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
