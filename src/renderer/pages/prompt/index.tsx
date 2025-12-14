import { Button, Input } from "@fluentui/react-components";
import { Search24Regular } from "@fluentui/react-icons";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Empty from "renderer/components/Empty";
import { useLivePromptsWithSelector } from "@/renderer/next/hooks/remote/use-live-prompts";
import { PromptDeleteConfirm, type PromptDeleteConfirmInstance } from "@/renderer/pages/prompt/PromptDeleteConfirm";
import { PromptEditDialog, type PromptEditDialogInstance } from "@/renderer/pages/prompt/PromptEditDialog";
import { PromptGrid } from "@/renderer/pages/prompt/PromptGrid";

export default function Prompts() {
  const { t } = useTranslation();

  const [keyword, setKeyword] = useState<string>("");

  const refPromptEditDialog = useRef<PromptEditDialogInstance | null>(null);
  const refPromptDeleteConfirm = useRef<PromptDeleteConfirmInstance | null>(null);

  const promptsIsEmpty = useLivePromptsWithSelector((raw) => {
    return raw.rows.length === 0;
  });

  const handleDelete = (id: string) => {
    refPromptDeleteConfirm.current?.delete(id);
  };

  const handleEdit = (id: string) => {
    refPromptEditDialog.current?.openUpdateMode(id);
  };

  const handleCreate = () => {
    refPromptEditDialog.current?.openCreateMode();
  };

  return (
    <div className="page h-full">
      <div className="page-top-bar" />
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t("Common.Prompts")}</h1>
          <div className="flex justify-end w-full items-center gap-2">
            <Button appearance="primary" onClick={handleCreate}>
              {t("Common.New")}
            </Button>
            <Input
              contentBefore={<Search24Regular />}
              placeholder={t("Common.Search")}
              value={keyword}
              onChange={(_, data) => {
                setKeyword(data.value);
              }}
              style={{ maxWidth: 288 }}
              className="flex-grow flex-shrink"
            />
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        {!promptsIsEmpty ? (
          <div className="mr-5 flex justify-start gap-2 flex-wrap">
            <PromptGrid onDelete={handleDelete} onEdit={handleEdit} keyword={keyword} />
          </div>
        ) : (
          <Empty image="design" text={t("Prompt.Info.Empty")} />
        )}
      </div>

      <PromptEditDialog ref={refPromptEditDialog} />
      <PromptDeleteConfirm ref={refPromptDeleteConfirm} />
    </div>
  );
}
