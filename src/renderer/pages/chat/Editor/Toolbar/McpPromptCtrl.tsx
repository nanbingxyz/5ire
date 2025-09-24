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
 * A React component that provides a dialog interface for selecting and applying MCP prompts.
 * Displays a button that opens a dialog with a searchable list of available prompts,
 * handles prompt variables, and triggers the selected prompt.
 * 
 * @param {Object} props - The component props
 * @param {IChat} props.chat - The current chat context
 * @param {boolean} [props.disabled] - Whether the prompt control is disabled
 * @param {Function} [props.onTrigger] - Callback function called when a prompt is triggered
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
   * Opens the main dialog, loads the list of available prompts, and sets up keyboard shortcuts.
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
   * Applies a selected prompt by decoding its ID and either showing the variable dialog
   * or directly fetching the prompt if no variables are required.
   * 
   * @param {string} promptName - The encoded prompt ID containing server and prompt name
   * @returns {Promise<void>} A promise that resolves when the prompt application is complete
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
   * Resets all dialog states and closes both the main dialog and variable dialog.
   */
  const removePrompt = useCallback(() => {
    setOpen(false);
    setPromptItem(null);
    setPrompt(null);
    setVariableDialogOpen(false);
  }, []);

  /**
   * Handles cancellation of the variable dialog by clearing the prompt item and closing the dialog.
   */
  const onVariablesCancel = useCallback(() => {
    setPromptItem(null);
    setVariableDialogOpen(false);
  }, [setPromptItem]);

  /**
   * Handles confirmation of the variable dialog by fetching the prompt with the provided arguments.
   * 
   * @param {Object} args - Key-value pairs of variable names and their values
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
   * Renders the options for the combobox, showing loading state, empty state, or grouped prompt options.
   * 
   * @returns {JSX.Element} The rendered options for the combobox
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
   * Renders the prompt preview area, showing either a placeholder message or the prompt content.
   * 
   * @returns {JSX.Element} The rendered prompt preview
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
   * Handles form submission by triggering the onTrigger callback with prompt data and closing the dialog.
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
                  /**
                   * Handles option selection in the combobox by applying the selected prompt.
                   * 
                   * @param {Event} e - The selection event
                   * @param {Object} data - The selection data containing the option value
                   */
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
