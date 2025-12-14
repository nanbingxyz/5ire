import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  InfoLabel,
  Input,
  Textarea,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { asError } from "catch-unknown";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useToast from "@/hooks/useToast";
import type { PromptMergeStrategy } from "@/main/database/types";
import { useLivePromptsRef } from "@/renderer/next/hooks/remote/use-live-prompts";
import { parseVariables } from "@/utils/util";

export type PromptEditDialogInstance = {
  openCreateMode: () => void;
  openUpdateMode: (id: string) => void;
};

export const PromptEditDialog = forwardRef<PromptEditDialogInstance>((_, ref) => {
  const { t } = useTranslation();
  const { notifyError } = useToast();

  const refPrompts = useLivePromptsRef();

  const [open, setOpen] = useState(false);

  const [promptId, setPromptId] = useState<string>();
  const [promptName, setPromptName] = useState<string>("");
  const [promptRoleDefinitionTemplate, setPromptRoleDefinitionTemplate] = useState<string>("");
  const [promptInstructionTemplate, setPromptInstructionTemplate] = useState<string>("");
  // TODO: next version will support
  const [promptMergeStrategy, setPromptMergeStrategy] = useState<PromptMergeStrategy>("scoped");

  const [validationsErrorsVisible, setValidationsErrorsVisible] = useState(false);

  const promptNameValidation = useMemo(() => {
    if (promptName.trim()) {
      return {};
    }

    return {
      validationState: "error",
      validationMessage: `${t("Common.Required")}`,
    } as const;
  }, [promptName, t]);

  const promptInstructionTemplateValidation = useMemo(() => {
    if (promptInstructionTemplate.trim()) {
      return {};
    }

    return {
      validationState: "error",
      validationMessage: `${t("Common.Required")}`,
    } as const;
  }, [promptInstructionTemplate, t]);

  useImperativeHandle(ref, () => {
    return {
      openCreateMode: () => {
        setPromptId(undefined);
        setPromptName("");
        setPromptRoleDefinitionTemplate("");
        setPromptInstructionTemplate("");
        setPromptMergeStrategy("scoped");
        setOpen(true);
        setValidationsErrorsVisible(false);
      },
      openUpdateMode: (id: string) => {
        const prompt = refPrompts.current.getState().rows.find((s) => {
          return s.id === id;
        });

        if (!prompt) {
          return;
        }

        setPromptId(prompt.id);
        setPromptName(prompt.name);
        setPromptRoleDefinitionTemplate(prompt.roleDefinitionTemplate || "");
        setPromptInstructionTemplate(prompt.instructionTemplate);
        setOpen(true);
        setValidationsErrorsVisible(false);
      },
    };
  });

  const handleSubmit = () => {
    setValidationsErrorsVisible(true);

    if (promptNameValidation.validationState || promptInstructionTemplateValidation.validationState) {
      return;
    }

    Promise.resolve()
      .then(async () => {
        if (promptId) {
          return window.bridge.promptsManager.updatePrompt({
            id: promptId,
            name: promptName,
            roleDefinitionTemplate: promptRoleDefinitionTemplate,
            instructionTemplate: promptInstructionTemplate,
            mergeStrategy: "merge",
          });
        } else {
          return window.bridge.promptsManager.createPrompt({
            name: promptName,
            roleDefinitionTemplate: promptRoleDefinitionTemplate,
            instructionTemplate: promptInstructionTemplate,
            mergeStrategy: "merge",
          });
        }
      })
      .then(() => {
        handleClose();
      })
      .catch((error) => {
        console.log(error);
        notifyError(asError(error).message);
      });
  };

  const handleClose = () => {
    setOpen(false);
  };

  const renderTitle = () => {
    return (
      <DialogTitle
        action={
          <DialogTrigger action="close">
            <Button onClick={handleClose} appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} />
          </DialogTrigger>
        }
      >
        <div className="flex flex-start justify-start items-baseline gap-2">
          <span>{promptId ? t("Prompts.Edit") : t("Prompts.New")}</span>
        </div>
      </DialogTitle>
    );
  };

  const renderTemplateVariables = (template: string) => {
    if (!template.trim()) {
      return null;
    }

    const variables = parseVariables(template);

    if (!variables.length) {
      return null;
    }

    return (
      <div className="flex justify-start items-center gap-2 flex-wrap opacity-70 mt-2">
        <span>{t("Common.Variables")}:</span>
        {variables.map((variable: string) => (
          <div key={variable} className="tag-variable px-1 flex items-center justify-start text-xs">
            &nbsp;{variable}
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    return (
      <DialogContent className="flex flex-col gap-4">
        {/*label*/}
        <Field label={t("Common.Name")} {...(validationsErrorsVisible ? promptNameValidation : {})}>
          <Input
            className="w-full min-w-fit"
            placeholder={t("Common.Required")}
            value={promptName}
            onChange={(_, data) => {
              setPromptName(data.value);
            }}
            maxLength={64}
          />
        </Field>

        <Field
          label={t("Prompts.Instruction")}
          {...(validationsErrorsVisible ? promptInstructionTemplateValidation : {})}
        >
          <Textarea
            className="w-full min-w-fit"
            placeholder={t("Common.Required")}
            value={promptInstructionTemplate}
            onChange={(_, data) => {
              setPromptInstructionTemplate(data.value);
            }}
          />

          {renderTemplateVariables(promptInstructionTemplate)}
        </Field>

        <Field label={<InfoLabel info={t("Tooltip.SystemMessage")}>{t("Prompts.RoleDefinition")}</InfoLabel>}>
          <Textarea
            className="w-full min-w-fit"
            placeholder={t("Common.Optional")}
            value={promptRoleDefinitionTemplate}
            onChange={(_, data) => {
              setPromptRoleDefinitionTemplate(data.value);
            }}
          />

          {renderTemplateVariables(promptRoleDefinitionTemplate)}
        </Field>

        {/*<Field label={t("Prompts.MergeStrategy")}>*/}
        {/*  <RadioGroup*/}
        {/*    value={promptMergeStrategy}*/}
        {/*    layout="horizontal"*/}
        {/*    onChange={(_, data) => {*/}
        {/*      setPromptMergeStrategy(data.value as PromptMergeStrategy);*/}
        {/*    }}*/}
        {/*  >*/}
        {/*    <Radio key="merge" value="merge" label={t("Prompts.MergeStrategy.Merge")} />*/}
        {/*    <Radio key="replace" value="replace" label={t("Prompts.MergeStrategy.Replace")} />*/}
        {/*    <Radio key="scoped" value="scoped" label={t("Prompts.MergeStrategy.Scoped")} />*/}
        {/*  </RadioGroup>*/}
        {/*</Field>*/}
      </DialogContent>
    );
  };

  return (
    <Dialog open={open}>
      <DialogSurface mountNode={document.body.querySelector("#portal")}>
        <DialogBody>
          {renderTitle()}
          {renderContent()}

          <DialogActions>
            <Button appearance="subtle" onClick={handleClose}>
              {t("Common.Cancel")}
            </Button>
            <Button type="submit" appearance="primary" onClick={handleSubmit}>
              {t("Common.Save")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
});
