import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
} from "@fluentui/react-components";
import { Dismiss24Regular, WrenchScrewdriver24Regular } from "@fluentui/react-icons";
import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import useMarkdown from "@/hooks/useMarkdown";
import type { Server } from "@/main/database/types";
import Spinner from "@/renderer/components/Spinner";
import { useServerConnectionsWithSelector } from "@/renderer/next/hooks/remote/use-server-connections";
import { useServerPromptsWithSelector } from "@/renderer/next/hooks/remote/use-server-prompts";
import { useServerToolsWithSelector } from "@/renderer/next/hooks/remote/use-server-tools";
import { useServersRef } from "@/renderer/next/hooks/remote/use-servers";

export type ServerBrowserInstance = {
  browse: (id: string) => void;
};

export const ServerBrowser = forwardRef<ServerBrowserInstance>((_, ref) => {
  const { t } = useTranslation();
  const { render } = useMarkdown();

  const [visible, setVisible] = useState(false);
  const [server, setServer] = useState<Server>();

  const servers = useServersRef();

  const connection = useServerConnectionsWithSelector((connections) => {
    if (server) {
      return connections[server.id];
    }
    return undefined;
  });

  const prompts = useServerPromptsWithSelector((prompts) => {
    if (server) {
      return prompts[server.id];
    }

    return undefined;
  });

  const tools = useServerToolsWithSelector((tools) => {
    if (server) {
      return tools[server.id];
    }

    return undefined;
  });

  // TODO：
  // const resources = useServerResourcesWithSelector((resources) => {
  //   if (server) {
  //     return resources[server.id];
  //   }
  //
  //   return undefined;
  // });

  useImperativeHandle(ref, () => {
    return {
      browse: (id) => {
        const server = servers.current.getState().rows.find((row) => {
          return row.id === id;
        });

        if (server) {
          setServer(server);
          setVisible(true);
        }
      },
    };
  });

  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  const renderTools = () => {
    if (!tools || tools.status === "loading") {
      return (
        <div className="flex justify-center items-center h-16">
          <Spinner size={20} />
        </div>
      );
    }

    if (tools.status === "error") {
      return <p className="mt-4 mb-4 text-red-500">{tools.message}</p>;
    }

    return (
      <Accordion multiple collapsible className="mt-4">
        {tools.tools.map((tool) => {
          return (
            <AccordionItem value={tool.name} key={tool.name} className="-my-3">
              <AccordionHeader>
                <div className="text-gray-500 dark:text-gray-300 font-bold">{tool.name}</div>
              </AccordionHeader>
              <AccordionPanel>
                <div className="border-l border-dotted border-stone-300 dark:border-gray-500 ml-2 pl-2 pb-3 mb-2">
                  <div className="text-sm text-gray-500 dark:text-gray-300 ml-3">{tool.description}</div>
                  <div className="mt-2 ml-2">
                    <fieldset className="border border-stone-300 dark:border-stone-600 rounded bg-stone-50 dark:bg-stone-800">
                      <legend className="text-sm px-1 ml-2 text-gray-500 dark:text-gray-300">inputSchema</legend>
                      <div
                        className="-mt-1 ghost p-2"
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: x
                        dangerouslySetInnerHTML={{
                          __html: render(`\`\`\`json\n${JSON.stringify(tool.inputSchema, null, 2)}\n\`\`\``),
                        }}
                      />
                    </fieldset>
                  </div>
                </div>
              </AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  const renderPrompts = () => {
    if (!prompts || prompts.status === "loading") {
      return (
        <div className="flex justify-center items-center h-16">
          <Spinner size={20} />
        </div>
      );
    }

    if (prompts.status === "error") {
      return <p className="mt-4 mb-4 text-red-500">{prompts.message}</p>;
    }

    return (
      <Accordion multiple collapsible className="mt-4">
        {prompts.prompts.map((prompt) => {
          return (
            <AccordionItem value={prompt.name} key={prompt.name} className="-my-3">
              <AccordionHeader>
                <div className="text-gray-500 dark:text-gray-300 font-bold">{prompt.name}</div>
              </AccordionHeader>
              <AccordionPanel>
                <div className="border-l border-dotted border-stone-300 dark:border-gray-500 ml-2 pl-2 pb-3 mb-2">
                  <div className="text-sm text-gray-500 dark:text-gray-300 ml-3">{prompt.description}</div>
                  {prompt.arguments && (
                    <div className="mt-2 ml-2">
                      <fieldset className="border border-stone-300 dark:border-stone-600 rounded bg-stone-50 dark:bg-stone-800">
                        <legend className="text-sm px-1 ml-2 text-gray-500 dark:text-gray-300">Arguments</legend>
                        <div
                          className="-mt-1 ghost p-2"
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: x
                          dangerouslySetInnerHTML={{
                            __html: render(`\`\`\`json\n${JSON.stringify(prompt.arguments, null, 2)}\n\`\`\``),
                          }}
                        />
                      </fieldset>
                    </div>
                  )}
                </div>
              </AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  const renderContent = () => {
    if (!connection) {
      return null;
    }

    if (connection.status === "error") {
      return null;
    }

    if (connection.status === "connecting") {
      return null;
    }

    const isSupportedTools = !!connection.capabilities.tools;
    const isSupportedPrompts = !!connection.capabilities.prompts;

    const content: React.ReactNode[] = [];

    if (isSupportedTools) {
      content.push(
        <div key="tools" className="mb-4">
          <h2 className="text-base font-semibold">{t("Common.Tools")}</h2>
          {renderTools()}
        </div>,
      );
    }

    if (isSupportedPrompts) {
      content.push(
        <div key="prompts" className="mb-4">
          <h2 className="text-base font-semibold">{t("Common.Prompts")}</h2>
          {renderPrompts()}
        </div>,
      );
    }

    return (
      <Accordion multiple collapsible className="mt-4">
        {content}
      </Accordion>
    );
  };

  return (
    <Dialog open={visible}>
      <DialogSurface mountNode={document.body.querySelector("#portal")}>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button onClick={handleClose} appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} />
              </DialogTrigger>
            }
          >
            <div>
              <div className="flex items-center gap-2 font-bold">
                <WrenchScrewdriver24Regular />
                {server?.label}
              </div>
              <p className="text-sm tips ml-1 mt-2">{server?.description}</p>
            </div>
          </DialogTitle>
          <DialogContent>{renderContent()}</DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
});
