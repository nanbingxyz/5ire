/* eslint-disable react/no-danger */
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@fluentui/react-components";
import {
  bundleIcon,
  Dismiss24Regular,
  HeartFilled,
  HeartOffRegular,
  Prompt20Filled,
  Prompt20Regular,
  Search20Regular,
} from "@fluentui/react-icons";
import DOMPurify from "dompurify";
import { type IChat, type IChatContext, type IPrompt, IPromptDef } from "intellichat/types";
import { isNil, pick } from "lodash";
import Mousetrap from "mousetrap";
import type { IChatModelConfig } from "providers/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useChatStore from "stores/useChatStore";
import usePromptStore from "stores/usePromptStore";
import { fillVariables, highlight, insertAtCursor, parseVariables } from "utils/util";
import { useLivePromptsWithSelector } from "@/renderer/next/hooks/remote/use-live-prompts";
import PromptVariableDialog from "../PromptVariableDialog";

const PromptIcon = bundleIcon(Prompt20Filled, Prompt20Regular);

/**
 * Props for the PromptCtrl component
 * @typedef {Object} PromptCtrlProps
 * @property {IChatContext} ctx - The chat context containing model and configuration information
 * @property {IChat} chat - The current chat instance
 * @property {boolean} [disabled] - Whether the prompt control is disabled
 */

/**
 * A React component that provides prompt selection and management functionality.
 * Renders a button that opens a dialog for browsing, searching, and applying prompts to a chat.
 * Supports variable substitution and keyboard shortcuts.
 *
 * @param {PromptCtrlProps} props - The component props
 * @returns {JSX.Element} The rendered prompt control component
 */
export default function PromptCtrl({ ctx, chat, disabled }: { ctx: IChatContext; chat: IChat; disabled?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(false);
  const [keyword, setKeyword] = useState<string>("");
  const [variableDialogOpen, setVariableDialogOpen] = useState<boolean>(false);
  const [systemVariables, setSystemVariables] = useState<string[]>([]);
  const [userVariables, setUserVariables] = useState<string[]>([]);
  const [promptPickerOpen, setPromptPickerOpen] = useState<boolean>(false);
  const [pickedPrompt, setPickedPrompt] = useState<(typeof prompts)[number] | null>(null);
  const [model, setModel] = useState<IChatModelConfig>();
  const editStage = useChatStore((state) => state.editStage);

  const prompts = useLivePromptsWithSelector((raw) => {
    return raw.rows.filter((prompt) => {
      if (keyword && keyword.trim() !== "") {
        return prompt.name.toLowerCase().indexOf(keyword.trim().toLowerCase()) >= 0;
      }

      return true;
    });
  });

  /**
   * Closes the prompt dialog and unbinds keyboard shortcuts
   */
  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind("esc");
  };

  /**
   * Opens the prompt dialog, fetches prompts, sets focus to search input, and binds keyboard shortcuts
   */
  const openDialog = () => {
    setOpen(true);
    setTimeout(() => document.querySelector<HTMLInputElement>("#prompt-search")?.focus(), 500);
    Mousetrap.bind("esc", closeDialog);
  };

  /**
   * Inserts a message into the editor at the current cursor position
   * @param {string} msg - The message text to insert
   * @returns {string} The updated HTML content of the editor
   */
  const insertUserMessage = (msg: string): string => {
    const editor = document.querySelector("#editor") as HTMLDivElement;
    return insertAtCursor(editor, msg);
  };

  /**
   * Applies a selected prompt to the current chat
   */
  const applyPrompt = async (prompt: (typeof prompts)[number]) => {
    setOpen(false);

    const roleDefinitionTemplateVariables = parseVariables(prompt.roleDefinitionTemplate || "");
    const instructionTemplateVariables = parseVariables(prompt.instructionTemplate);

    setSystemVariables(roleDefinitionTemplateVariables);
    setUserVariables(instructionTemplateVariables);
    if (roleDefinitionTemplateVariables.length > 0 || instructionTemplateVariables.length > 0) {
      setPickedPrompt(prompt);
      setVariableDialogOpen(true);
    } else {
      const input = insertUserMessage(prompt.instructionTemplate);
      // await editStage(chat.id, { prompt: $prompt, input });
    }

    const editor = document.querySelector("#editor") as HTMLTextAreaElement;
    editor.focus();
    window.electron.ingestEvent([{ app: "apply-prompt" }]);
  };

  /**
   * Removes the current prompt from the chat
   */
  const removePrompt = () => {
    setOpen(false);
    setTimeout(() => editStage(chat.id, { prompt: null }), 300);
  };

  /**
   * Handles cancellation of the variable dialog
   */
  const onVariablesCancel = useCallback(() => {
    setPickedPrompt(null);
    setVariableDialogOpen(false);
  }, []);

  /**
   * Handles confirmation of variable values and applies the prompt with filled variables
   * @param {Object} systemVars - Key-value pairs for system message variables
   * @param {Object} userVars - Key-value pairs for user message variables
   */
  const onVariablesConfirm = useCallback(
    async (systemVars: { [key: string]: string }, userVars: { [key: string]: string }) => {
      if (!pickedPrompt) {
        return;
      }

      const payload = {
        prompt: { ...pickedPrompt },
        input: "",
      };
      if (pickedPrompt?.roleDefinitionTemplate) {
        payload.prompt.roleDefinitionTemplate = fillVariables(pickedPrompt.roleDefinitionTemplate, systemVars);
      }
      if (pickedPrompt?.instructionTemplate) {
        payload.prompt.instructionTemplate = fillVariables(pickedPrompt.instructionTemplate, userVars);
        payload.input = insertUserMessage(payload.prompt.instructionTemplate);
      }
      await editStage(chat.id, {
        prompt: {
          id: payload.prompt.id,
          name: payload.prompt.name,
          systemMessage: payload.prompt.roleDefinitionTemplate || "",
          userMessage: payload.prompt.instructionTemplate,
        },
        input: payload.input ? payload.input : undefined,
      });
      setVariableDialogOpen(false);
    },
    [pickedPrompt, editStage, chat.id],
  );

  useEffect(() => {
    Mousetrap.bind("mod+shift+2", openDialog);
    if (open) {
      setModel(ctx.getModel());
    }
    return () => {
      Mousetrap.unbind("mod+shift+2");
    };
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={() => setPromptPickerOpen(false)}>
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
          >
            {(chat.prompt as IPrompt)?.name && (
              <span
                className={`flex-shrink overflow-hidden whitespace-nowrap text-ellipsis ${
                  (chat.prompt as IPrompt)?.name ? "min-w-8" : "w-0"
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
                  <Button appearance="subtle" aria-label="close" onClick={closeDialog} icon={<Dismiss24Regular />} />
                </DialogTrigger>
              }
            >
              {t("Common.Prompts")}
            </DialogTitle>
            <DialogContent>
              {isNil(chat.prompt) || promptPickerOpen ? (
                <div>
                  <div className="mb-2.5">
                    <Input
                      id="prompt-search"
                      contentBefore={<Search20Regular />}
                      placeholder={t("Common.Search")}
                      className="w-full"
                      value={keyword}
                      onChange={(e, data) => {
                        setKeyword(data.value);
                      }}
                    />
                  </div>
                  <div>
                    {prompts.map((prompt) => {
                      return (
                        <Button
                          className={`w-full flex items-center justify-start gap-1 my-1.5`}
                          appearance="subtle"
                          key={prompt.id}
                          onClick={() => applyPrompt(prompt)}
                        >
                          <span
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: x
                            dangerouslySetInnerHTML={{
                              __html: highlight(prompt.name, keyword),
                            }}
                          />
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="pb-4">
                  <div className="text-lg font-medium">{(chat.prompt as IPrompt)?.name || ""}</div>
                  {(chat.prompt as IPrompt)?.systemMessage ? (
                    <div>
                      <div>
                        <span className="mr-1">{t("Common.SystemMessage")}: </span>
                        <span
                          className="leading-6"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize((chat.prompt as IPrompt).systemMessage),
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
                    {t("Common.Delete")}
                  </Button>
                </DialogTrigger>
                <Button appearance="primary" onClick={() => setPromptPickerOpen(true)}>
                  {t("Common.Change")}
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
