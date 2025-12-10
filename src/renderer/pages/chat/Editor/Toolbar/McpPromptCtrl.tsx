/* eslint-disable react/no-danger */
import {
  Button,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Option,
  OptionGroup,
} from "@fluentui/react-components";
import {
  bundleIcon,
  CommentMultipleLinkFilled,
  CommentMultipleLinkRegular,
  Dismiss24Regular,
} from "@fluentui/react-icons";
import type { GetPromptResult as MCPPromptResult } from "@modelcontextprotocol/sdk/types.js";
import useToast from "hooks/useToast";
import { decodePromptId, encodePromptId } from "intellichat/mcp/ids";
import type { IChat } from "intellichat/types";
import { isNil } from "lodash";
import Mousetrap from "mousetrap";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Spinner from "renderer/components/Spinner";
import { captureException } from "renderer/logging";
import type { IMCPPrompt, IMCPPromptArgument, IMCPPromptListItem, IMCPPromptListItemData } from "types/mcp";
import { useServersWithSelector } from "@/renderer/next/hooks/remote/use-servers";
import MCPPromptContentPreview from "../../MCPPromptContentPreview";
import McpPromptVariableDialog from "../McpPromptVariableDialog";

/**
 * Bundled icon for the prompt control button
 */
const PromptIcon = bundleIcon(CommentMultipleLinkFilled, CommentMultipleLinkRegular);

/**
 * Props interface for the McpPromptCtrl component
 */
interface McpPromptCtrlProps {
  /** The chat instance to associate with the prompt */
  chat: IChat;
  /** Whether the control should be disabled */
  disabled?: boolean;
  /** Callback function triggered when a prompt is selected and applied */
  onTrigger?: (prompt: unknown) => void;
}

/**
 * A React component that provides a dialog interface for browsing and selecting MCP prompts.
 * Displays available prompts from MCP servers, handles variable input for parameterized prompts,
 * and triggers the selected prompt through a callback.
 *
 * @param props - The component props
 * @returns JSX element containing the prompt control dialog
 */
export default function McpPromptCtrl({ chat, disabled, onTrigger }: McpPromptCtrlProps) {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [variableDialogOpen, setVariableDialogOpen] = useState<boolean>(false);
  const [variables, setVariables] = useState<IMCPPromptArgument[]>([]);
  const [promptItem, setPromptItem] = useState<(IMCPPromptListItemData & { client: string }) | null>(null);
  const [options, setOptions] = useState<IMCPPromptListItem[]>([]);
  const [prompt, setPrompt] = useState<IMCPPrompt | null>(null);

  const serverLabelMappings = useServersWithSelector((raw) => {
    const mappings: Record<string, string> = {};

    for (const row of raw.rows) {
      mappings[row.id] = row.label;
    }

    return mappings;
  });

  /**
   * Closes the main prompt dialog and unbinds keyboard shortcuts
   */
  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind("esc");
  };

  /**
   * Opens the main prompt dialog, loads available prompts from MCP servers,
   * and sets up keyboard shortcuts
   */
  const openDialog = () => {
    setOpen(true);
    setLoadingList(true);
    setPrompt(null);
    window.electron.mcp
      .listPrompts()
      .then((res: { error?: string; prompts: IMCPPromptListItem[] }) => {
        setOptions(res.prompts || []);
        setLoadingList(false);
        return res.prompts;
      })
      .catch((error) => {
        setLoadingList(false);
        captureException(error);
      });
    Mousetrap.bind("esc", closeDialog);
  };

  /**
   * Applies a selected prompt by decoding its ID and either showing the variable dialog
   * for parameterized prompts or directly fetching the prompt content
   *
   * @param promptName - The encoded prompt identifier containing server and prompt name
   */
  const applyPrompt = async (promptName: string) => {
    const { server, prompt: name } = decodePromptId(promptName);
    const group = options.find((option) => option.client === server);
    if (group) {
      const item = group.prompts.find((p: IMCPPromptListItemData) => p.name === name) as IMCPPromptListItemData & {
        client: string;
      };
      item.client = server;
      setPromptItem(item);
      setVariables(item?.arguments || []);
      if ((item?.arguments?.length || 0) > 0) {
        setVariableDialogOpen(true);
      } else {
        const $prompt = await window.electron.mcp.getPrompt({
          client: server,
          name,
        });
        if ($prompt.isError) {
          notifyError($prompt.error || "Unknown error occurred while fetching prompt");
          return;
        }
        setPrompt($prompt);
      }
    }
    window.electron.ingestEvent([{ app: "apply-mcp-prompt" }]);
  };

  /**
   * Resets all prompt-related state and closes dialogs
   */
  const removePrompt = useCallback(() => {
    setOpen(false);
    setPromptItem(null);
    setPrompt(null);
    setVariableDialogOpen(false);
  }, []);

  /**
   * Handles cancellation of the variable input dialog
   */
  const onVariablesCancel = useCallback(() => {
    setPromptItem(null);
    setVariableDialogOpen(false);
  }, [setPromptItem]);

  /**
   * Handles confirmation of variable input and fetches the prompt with provided arguments
   *
   * @param args - Key-value pairs of variable names and their values
   */
  const onVariablesConfirm = useCallback(
    async (args: { [key: string]: string }) => {
      if (isNil(promptItem)) {
        return;
      }
      const $prompt = await window.electron.mcp.getPrompt({
        client: promptItem.client,
        name: promptItem.name,
        args,
      });
      if ($prompt.isError) {
        notifyError($prompt.content?.[0]?.error || "Unknown error occurred while fetching prompt");
        return;
      }
      setPrompt($prompt);
      setVariableDialogOpen(false);
    },
    [promptItem, chat.id],
  );

  /**
   * Sets up keyboard shortcut for opening the dialog
   */
  useEffect(() => {
    Mousetrap.bind("mod+shift+2", openDialog);
    return () => {
      Mousetrap.unbind("mod+shift+2");
    };
  }, [open]);

  /**
   * Renders the dropdown options for available prompts, grouped by MCP server
   *
   * @returns JSX elements representing the prompt options
   */
  const renderOptions = useCallback(() => {
    if (loadingList) {
      return (
        <Option text={t("Common.Loading")} value="" disabled>
          <div className="flex justify-start gap-2 items-center">
            <Spinner className="w-2 h-2 -ml-4" />
            <span>{t("Common.Loading")}</span>
          </div>
        </Option>
      );
    }
    if (!options || options.length === 0) {
      return (
        <Option text={t("Common.NoPrompts")} value="" disabled>
          {t("Common.NoPrompts")}
        </Option>
      );
    }
    return options.map((option) => (
      <OptionGroup label={serverLabelMappings[option.client]} key={option.client}>
        {option.prompts.map((promptOption: IMCPPromptListItemData) => (
          <Option
            key={`${encodePromptId(option.client, promptOption.name)}`}
            value={`${encodePromptId(option.client, promptOption.name)}`}
          >
            {promptOption.name}
          </Option>
        ))}
      </OptionGroup>
    ));
  }, [loadingList, options]);

  /**
   * Renders the preview of the selected prompt content
   *
   * @returns JSX element showing the prompt preview or placeholder message
   */
  const renderPrompt = useCallback(() => {
    if (!prompt) {
      return <div className="py-6 px-1 tips">{t("Common.NoPromptSelected")}</div>;
    }
    return <MCPPromptContentPreview messages={prompt.messages as unknown as MCPPromptResult["messages"]} />;
  }, [prompt, t]);

  /**
   * Handles submission of the selected prompt by triggering the callback
   * and resetting the component state
   */
  const onSubmit = useCallback(async () => {
    if (prompt && promptItem) {
      onTrigger?.({
        name: promptItem.name,
        source: promptItem.client,
        description: promptItem.description,
        messages: prompt.messages,
      });

      // Close the dialog and clear prompt state.
      removePrompt();
    }
  }, [prompt, promptItem, removePrompt, onTrigger]);

  return (
    <>
      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogTrigger disableButtonEnhancement>
          <Button
            disabled={disabled}
            size="small"
            title={`${t("Common.Prompts")}(Mod+Shift+2)`}
            aria-label={t("Common.Prompts")}
            appearance="subtle"
            style={{ borderColor: "transparent", boxShadow: "none" }}
            className={`flex justify-start items-center text-color-secondary gap-1 ${disabled ? "opacity-50" : ""}`}
            onClick={openDialog}
            icon={<PromptIcon className="flex-shrink-0" />}
          />
        </DialogTrigger>
        <DialogSurface>
          <DialogBody>
            <DialogTitle
              action={
                <DialogTrigger action="close">
                  <Button appearance="subtle" aria-label="close" onClick={closeDialog} icon={<Dismiss24Regular />} />
                </DialogTrigger>
              }
            >
              <div className="flex justify-start items-center gap-1 font-semibold font-sans">
                MCP<span className="separator">/</span> {t("Common.Prompts")}
              </div>
            </DialogTitle>
            <DialogContent>
              <Combobox
                placeholder={t("Common.Search")}
                className="w-full"
                onOptionSelect={(e, data) => {
                  applyPrompt(data.optionValue as string);
                }}
              >
                {renderOptions()}
              </Combobox>
              <div>{renderPrompt()}</div>
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="secondary" onClick={removePrompt}>
                  {t("Common.Cancel")}
                </Button>
              </DialogTrigger>
              <Button appearance="primary" disabled={isNil(prompt)} onClick={onSubmit}>
                {t("Common.Submit")}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <McpPromptVariableDialog
        open={variableDialogOpen}
        variables={variables}
        onCancel={onVariablesCancel}
        onConfirm={onVariablesConfirm}
      />
    </>
  );
}
