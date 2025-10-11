/* eslint-disable react/no-danger */
import {
  Dialog,
  DialogTrigger,
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  Input,
  DialogActions,
} from '@fluentui/react-components';
import DOMPurify from 'dompurify';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  Dismiss24Regular,
  Prompt20Regular,
  Prompt20Filled,
  Search20Regular,
  HeartFilled,
  HeartOffRegular,
} from '@fluentui/react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import usePromptStore from 'stores/usePromptStore';
import { fillVariables, highlight, insertAtCursor } from 'utils/util';
import { isNil, pick } from 'lodash';
import { IChat, IChatContext, IPrompt, IPromptDef } from 'intellichat/types';
import useChatStore from 'stores/useChatStore';
import { IChatModelConfig } from 'providers/types';
import PromptVariableDialog from '../PromptVariableDialog';

const PromptIcon = bundleIcon(Prompt20Filled, Prompt20Regular);

/**
 * Renders a prompt control component that allows users to select, apply, and manage prompts for chat conversations.
 * Provides a dialog interface for browsing available prompts, searching by keyword, and handling prompt variables.
 * Manages keyboard shortcuts for opening the dialog and supports model-specific prompt filtering.
 */
export default function PromptCtrl({
  ctx,
  chat,
  disabled,
}: {
  ctx: IChatContext;
  chat: IChat;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(false);
  const [keyword, setKeyword] = useState<string>('');
  const [variableDialogOpen, setVariableDialogOpen] = useState<boolean>(false);
  const [systemVariables, setSystemVariables] = useState<string[]>([]);
  const [userVariables, setUserVariables] = useState<string[]>([]);
  const [promptPickerOpen, setPromptPickerOpen] = useState<boolean>(false);
  const [pickedPrompt, setPickedPrompt] = useState<IPrompt | null>(null);
  const [model, setModel] = useState<IChatModelConfig>();
  const allPrompts = usePromptStore((state) => state.prompts);
  const fetchPrompts = usePromptStore((state) => state.fetchPrompts);
  const getPrompt = usePromptStore((state) => state.getPrompt);
  const editStage = useChatStore((state) => state.editStage);

  /**
   * Closes the prompt dialog and unbinds the escape key handler.
   */
  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind('esc');
  };

  /**
   * Opens the prompt dialog, fetches available prompts, focuses the search input, and binds the escape key to close the dialog.
   */
  const openDialog = () => {
    fetchPrompts({});
    setOpen(true);
    setTimeout(
      () => document.querySelector<HTMLInputElement>('#prompt-search')?.focus(),
      500,
    );
    Mousetrap.bind('esc', closeDialog);
  };

  /**
   * Filters all prompts based on the current keyword search term.
   * Returns prompts whose names contain the keyword (case-insensitive), or all prompts if no keyword is provided.
   */
  const prompts = useMemo(() => {
    return allPrompts.filter((prompt) => {
      if (keyword && keyword.trim() !== '') {
        return (
          prompt.name.toLowerCase().indexOf(keyword.trim().toLowerCase()) >= 0
        );
      }
      return true;
    });
  }, [allPrompts, keyword]);

  /**
   * Inserts a message into the editor at the current cursor position and returns the updated editor content.
   */
  const insertUserMessage = (msg: string): string => {
    const editor = document.querySelector('#editor') as HTMLDivElement;
    return insertAtCursor(editor, msg);
  };

  /**
   * Retrieves a prompt by ID, applies it to the current chat, and handles variable substitution if needed.
   * If the prompt contains variables, opens the variable dialog for user input.
   * Otherwise, directly inserts the user message and updates the chat stage.
   * Focuses the editor after completion and logs an analytics event.
   */
  const applyPrompt = async (promptId: string) => {
    const prompt = await getPrompt(promptId);
    if (prompt) {
      const $prompt = pick(prompt, [
        'id',
        'name',
        'systemMessage',
        'userMessage',
        'temperature',
        'maxTokens',
      ]);
      setOpen(false);
      setSystemVariables(prompt.systemVariables || []);
      setUserVariables(prompt.userVariables || []);
      if (
        (prompt.systemVariables?.length || 0) > 0 ||
        (prompt.userVariables?.length || 0) > 0
      ) {
        setPickedPrompt($prompt);
        setVariableDialogOpen(true);
      } else {
        const input = insertUserMessage(prompt.userMessage);
        await editStage(chat.id, { prompt: $prompt, input });
      }
    }
    const editor = document.querySelector('#editor') as HTMLTextAreaElement;
    editor.focus();
    window.electron.ingestEvent([{ app: 'apply-prompt' }]);
  };

  /**
   * Removes the currently applied prompt from the chat by setting it to null after closing the dialog.
   */
  const removePrompt = () => {
    setOpen(false);
    setTimeout(() => editStage(chat.id, { prompt: null }), 300);
  };

  /**
   * Closes the variable dialog and clears the picked prompt state.
   */
  const onVariablesCancel = useCallback(() => {
    setPickedPrompt(null);
    setVariableDialogOpen(false);
  }, [setPickedPrompt]);

  /**
   * Processes variable substitution for the picked prompt using provided system and user variables.
   * Fills variables in both system and user messages, inserts the processed user message into the editor,
   * updates the chat stage with the modified prompt, and closes the variable dialog.
   */
  const onVariablesConfirm = useCallback(
    async (
      systemVars: { [key: string]: string },
      userVars: { [key: string]: string },
    ) => {
      const payload: any = {
        prompt: { ...pickedPrompt },
      };
      if (pickedPrompt?.systemMessage) {
        payload.prompt.systemMessage = fillVariables(
          pickedPrompt.systemMessage,
          systemVars,
        );
      }
      if (pickedPrompt?.userMessage) {
        payload.prompt.userMessage = fillVariables(
          pickedPrompt.userMessage,
          userVars,
        );
        payload.input = insertUserMessage(payload.prompt.userMessage);
      }
      await editStage(chat.id, payload);
      setVariableDialogOpen(false);
    },
    [pickedPrompt, editStage, chat.id],
  );

  useEffect(() => {
    Mousetrap.bind('mod+shift+2', openDialog);
    if (open) {
      setModel(ctx.getModel());
    }
    return () => {
      Mousetrap.unbind('mod+shift+2');
    };
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={() => setPromptPickerOpen(false)}>
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
          >
            {(chat.prompt as IPrompt)?.name && (
              <span
                className={`flex-shrink overflow-hidden whitespace-nowrap text-ellipsis ${
                  (chat.prompt as IPrompt)?.name ? 'min-w-8' : 'w-0'
                } `}
              >
                {(chat.prompt as IPrompt)?.name}
              </span>
            )}
          </Button>
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
              {t('Common.Prompts')}
            </DialogTitle>
            <DialogContent>
              {isNil(chat.prompt) || promptPickerOpen ? (
                <div>
                  <div className="mb-2.5">
                    <Input
                      id="prompt-search"
                      contentBefore={<Search20Regular />}
                      placeholder={t('Common.Search')}
                      className="w-full"
                      value={keyword}
                      onChange={(e, data) => {
                        setKeyword(data.value);
                      }}
                    />
                  </div>
                  <div>
                    {prompts.map((prompt: IPromptDef) => {
                      let applicableState = 0;
                      let icon = null;
                      if ((prompt.models?.length || 0) > 0) {
                        applicableState = prompt.models?.includes(
                          model?.name || '',
                        )
                          ? 1
                          : -1;
                        icon =
                          applicableState > 0 ? (
                            <HeartFilled className="-mb-0.5" />
                          ) : (
                            <HeartOffRegular className="-mb-0.5" />
                          );
                      }
                      return (
                        <Button
                          className={`w-full flex items-center justify-start gap-1 my-1.5 ${applicableState < 0 ? 'opacity-50' : ''}`}
                          appearance="subtle"
                          key={prompt.id}
                          onClick={() => applyPrompt(prompt.id)}
                        >
                          <span
                            dangerouslySetInnerHTML={{
                              __html: highlight(prompt.name, keyword),
                            }}
                          />
                          {icon}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="pb-4">
                  <div className="text-lg font-medium">
                    {(chat.prompt as IPrompt)?.name || ''}
                  </div>
                  {(chat.prompt as IPrompt)?.systemMessage ? (
                    <div>
                      <div>
                        <span className="mr-1">
                          {t('Common.SystemMessage')}:{' '}
                        </span>
                        <span
                          className="leading-6"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(
                              (chat.prompt as IPrompt).systemMessage,
                            ),
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </DialogContent>
            {isNil(chat.prompt) || promptPickerOpen ? null : (
              <DialogActions>
                <DialogTrigger disableButtonEnhancement>
                  <Button appearance="secondary" onClick={removePrompt}>
                    {t('Common.Delete')}
                  </Button>
                </DialogTrigger>
                <Button
                  appearance="primary"
                  onClick={() => setPromptPickerOpen(true)}
                >
                  {t('Common.Change')}
                </Button>
              </DialogActions>
            )}
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <PromptVariableDialog
        open={variableDialogOpen}
        systemVariables={systemVariables}
        userVariables={userVariables}
        onCancel={onVariablesCancel}
        onConfirm={onVariablesConfirm}
      />
    </>
  );
}
