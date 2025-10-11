/* eslint-disable react/no-danger */
import {
  Dialog,
  DialogTrigger,
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Combobox,
  OptionGroup,
  Option,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  CommentMultipleLinkFilled,
  CommentMultipleLinkRegular,
  Dismiss24Regular,
} from '@fluentui/react-icons';
import { GetPromptResult as MCPPromptResult } from '@modelcontextprotocol/sdk/types.js';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isNil } from 'lodash';
import { IChat } from 'intellichat/types';
import {
  IMCPPrompt,
  IMCPPromptArgument,
  IMCPPromptListItem,
  IMCPPromptListItemData,
} from 'types/mcp';
import useToast from 'hooks/useToast';
import Spinner from 'renderer/components/Spinner';
import { captureException } from 'renderer/logging';
import { decodePromptId, encodePromptId } from 'intellichat/mcp/ids';
import MCPPromptContentPreview from '../../MCPPromptContentPreview';
import McpPromptVariableDialog from '../McpPromptVariableDialog';

const PromptIcon = bundleIcon(
  CommentMultipleLinkFilled,
  CommentMultipleLinkRegular,
);

/**
 * Renders a toolbar control for selecting and applying MCP prompts.
 * Opens a dialog that displays available prompts from connected MCP servers,
 * allows selection and preview, handles variable input if required, and triggers
 * the onTrigger callback with the selected prompt data upon submission.
 * Supports keyboard shortcut Mod+Shift+2 to open the dialog.
 */
export default function McpPromptCtrl({
  chat,
  disabled,
  onTrigger,
}: {
  chat: IChat;
  disabled?: boolean;
  onTrigger?: (prompt: unknown) => void;
}) {
  const { t } = useTranslation();
  const { notifyError } = useToast();
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [variableDialogOpen, setVariableDialogOpen] = useState<boolean>(false);
  const [variables, setVariables] = useState<IMCPPromptArgument[]>([]);
  const [promptItem, setPromptItem] = useState<
    (IMCPPromptListItemData & { client: string }) | null
  >(null);
  const [options, setOptions] = useState<IMCPPromptListItem[]>([]);
  const [prompt, setPrompt] = useState<IMCPPrompt | null>(null);

  /**
   * Closes the main dialog and unbinds the escape key handler.
   */
  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind('esc');
  };

  /**
   * Opens the main dialog, fetches the list of available prompts from all MCP servers,
   * and binds the escape key to close the dialog.
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
    Mousetrap.bind('esc', closeDialog);
  };

  /**
   * Applies the selected prompt by decoding its ID, finding the corresponding prompt item,
   * and either opening the variable dialog if arguments are required or fetching the prompt
   * content directly. Logs an analytics event for prompt application.
   * 
   * @param promptName - The encoded prompt identifier containing server and prompt name
   */
  const applyPrompt = async (promptName: string) => {
    const { server, prompt: name } = decodePromptId(promptName);
    const group = options.find((option) => option.client === server);
    if (group) {
      const item = group.prompts.find(
        (p: IMCPPromptListItemData) => p.name === name,
      ) as IMCPPromptListItemData & { client: string };
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
          notifyError(
            $prompt.error || 'Unknown error occurred while fetching prompt',
          );
          return;
        }
        setPrompt($prompt);
      }
    }
    window.electron.ingestEvent([{ app: 'apply-mcp-prompt' }]);
  };

  /**
   * Clears all prompt-related state and closes both dialogs.
   */
  const removePrompt = useCallback(() => {
    setOpen(false);
    setPromptItem(null);
    setPrompt(null);
    setVariableDialogOpen(false);
  }, []);

  /**
   * Closes the variable dialog and clears the selected prompt item.
   */
  const onVariablesCancel = useCallback(() => {
    setPromptItem(null);
    setVariableDialogOpen(false);
  }, [setPromptItem]);

  /**
   * Fetches the prompt with the provided variable arguments, handles errors,
   * and closes the variable dialog on success.
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
        notifyError(
          $prompt.content?.[0]?.error ||
            'Unknown error occurred while fetching prompt',
        );
        return;
      }
      setPrompt($prompt);
      setVariableDialogOpen(false);
    },
    [promptItem, chat.id],
  );

  useEffect(() => {
    Mousetrap.bind('mod+shift+2', openDialog);
    return () => {
      Mousetrap.unbind('mod+shift+2');
    };
  }, [open]);

  /**
   * Renders the combobox options, showing a loading spinner during fetch,
   * a message when no prompts are available, or grouped options by server.
   */
  const renderOptions = useCallback(() => {
    if (loadingList) {
      return (
        <Option text={t('Common.Loading')} value="" disabled>
          <div className="flex justify-start gap-2 items-center">
            <Spinner className="w-2 h-2 -ml-4" />
            <span>{t('Common.Loading')}</span>
          </div>
        </Option>
      );
    }
    if (!options || options.length === 0) {
      return (
        <Option text={t('Common.NoPrompts')} value="" disabled>
          {t('Common.NoPrompts')}
        </Option>
      );
    }
    return options.map((option) => (
      <OptionGroup label={option.client} key={option.client}>
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
   * Renders the prompt preview, showing a placeholder message when no prompt is selected
   * or the prompt content preview component when a prompt is loaded.
   */
  const renderPrompt = useCallback(() => {
    if (!prompt) {
      return (
        <div className="py-6 px-1 tips">{t('Common.NoPromptSelected')}</div>
      );
    }
    return (
      <MCPPromptContentPreview
        messages={prompt.messages as unknown as MCPPromptResult['messages']}
      />
    );
  }, [prompt, t]);

  /**
   * Submits the selected prompt by calling the onTrigger callback with prompt data
   * and then clearing the prompt state and closing the dialog.
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
            title={`${t('Common.Prompts')}(Mod+Shift+2)`}
            aria-label={t('Common.Prompts')}
            appearance="subtle"
            style={{ borderColor: 'transparent', boxShadow: 'none' }}
            className={`flex justify-start items-center text-color-secondary gap-1 ${disabled ? 'opacity-50' : ''}`}
            onClick={openDialog}
            icon={<PromptIcon className="flex-shrink-0" />}
          />
        </DialogTrigger>
        <DialogSurface>
          <DialogBody>
            <DialogTitle
              action={
                <DialogTrigger action="close">
                  <Button
                    appearance="subtle"
                    aria-label="close"
                    onClick={closeDialog}
                    icon={<Dismiss24Regular />}
                  />
                </DialogTrigger>
              }
            >
              <div className="flex justify-start items-center gap-1 font-semibold font-sans">
                MCP<span className="separator">/</span> {t('Common.Prompts')}
              </div>
            </DialogTitle>
            <DialogContent>
              <Combobox
                placeholder={t('Common.Search')}
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
                  {t('Common.Cancel')}
                </Button>
              </DialogTrigger>
              <Button
                appearance="primary"
                disabled={isNil(prompt)}
                onClick={onSubmit}
              >
                {t('Common.Submit')}
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
