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
  Input,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * A dialog component for filling in prompt variables.
 * Displays input fields for system and user variables that can be filled by the user.
 *
 * @param {Object} args - The component props
 * @param {boolean} args.open - Whether the dialog is open
 * @param {string[]} args.systemVariables - Array of system variable names to display
 * @param {string[]} args.userVariables - Array of user variable names to display
 * @param {Function} args.onCancel - Callback function called when dialog is cancelled
 * @param {Function} args.onConfirm - Callback function called when user confirms with filled variables
 * @returns {JSX.Element} The rendered dialog component
 */
export default function PromptVariableDialog(args: {
  open: boolean;
  systemVariables: string[];
  userVariables: string[];
  onCancel: () => void;
  onConfirm: (systemVars: { [key: string]: string }, userVars: { [key: string]: string }) => void;
}) {
  const { t } = useTranslation();
  const { open, systemVariables, userVariables, onCancel, onConfirm } = args;

  const [systemVars, setSystemVars] = useState<{ [key: string]: string }>({});
  const [userVars, setUserVars] = useState<{ [key: string]: string }>({});

  /**
   * Handles changes to system variable input fields.
   *
   * @param {string} key - The variable name/key
   * @param {string} value - The new value for the variable
   */
  const onSystemVariesChange = (key: string, value: string) => {
    setSystemVars({ ...systemVars, [key]: value });
  };

  /**
   * Handles changes to user variable input fields.
   *
   * @param {string} key - The variable name/key
   * @param {string} value - The new value for the variable
   */
  const onUserVariesChange = (key: string, value: string) => {
    setUserVars({ ...userVars, [key]: value });
  };

  /**
   * Handles the confirm action by calling the onConfirm callback with current variable values
   * and resetting the internal state.
   */
  const handleConfirm = () => {
    onConfirm(systemVars, userVars);
    setSystemVars({});
    setUserVars({});
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button appearance="subtle" aria-label="close" icon={<Dismiss24Regular />} onClick={onCancel} />
              </DialogTrigger>
            }
          >
            {t("Prompt.FillVariables")}
          </DialogTitle>
          <DialogContent>
            <div>
              {systemVariables.length ? (
                <div className="mb-4">
                  <div className="text-base font-medium">{t("Prompts.RoleDefinitionVariables")}</div>
                  {systemVariables.map((variable) => {
                    return (
                      <Field label={variable} key={`system-var-${variable}`} className="my-2">
                        <Input
                          className="w-full"
                          value={systemVars[variable] || ""}
                          onChange={(e) => onSystemVariesChange(variable, e.target.value || "")}
                        />
                      </Field>
                    );
                  })}
                </div>
              ) : null}
              {userVariables.length ? (
                <div>
                  <div className="text-base font-medium">{t("Prompts.InstructionVariables")}</div>
                  {userVariables.map((variable) => {
                    return (
                      <Field label={variable} key={`user-var-${variable}`} className="my-2">
                        <Input
                          className="w-full"
                          value={userVars[variable] || ""}
                          onChange={(e) => onUserVariesChange(variable, e.target.value || "")}
                        />
                      </Field>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="subtle" onClick={onCancel}>
                {t("Common.Cancel")}
              </Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={handleConfirm}>
              {t("Common.OK")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
