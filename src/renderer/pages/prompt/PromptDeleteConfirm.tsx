import { asError } from "catch-unknown";
import { forwardRef, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import useToast from "@/hooks/useToast";
import ConfirmDialog from "@/renderer/components/ConfirmDialog";

export type PromptDeleteConfirmInstance = {
  delete: (id: string) => void;
};

export const PromptDeleteConfirm = forwardRef<PromptDeleteConfirmInstance>((_, ref) => {
  const { t } = useTranslation();
  const { notifyError } = useToast();

  const [id, setId] = useState<string>();
  const [open, setOpen] = useState(false);

  useImperativeHandle(ref, () => {
    return {
      delete: (id: string) => {
        setId(id);
        setOpen(true);
      },
    };
  });

  const handleConfirmDelete = () => {
    if (id) {
      window.bridge.promptsManager
        .deletePrompt({ id })
        .catch((err) => {
          notifyError(asError(err).message);
        })
        .finally(() => {
          setOpen(false);
        });
    }
  };

  return (
    <ConfirmDialog
      open={open}
      setOpen={setOpen}
      title={t("Common.DeleteConfirmation")}
      message={t("Common.DeleteConfirmationInfo")}
      onConfirm={handleConfirmDelete}
    />
  );
});
