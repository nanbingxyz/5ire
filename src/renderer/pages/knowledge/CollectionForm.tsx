import { Button, Field, Input, type InputOnChangeData } from "@fluentui/react-components";
import useToast from "hooks/useToast";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { isBlank } from "utils/validators";
import { useLiveCollections } from "@/renderer/next/hooks/remote/use-live-collections";

export default function CollectionForm() {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const collections = useLiveCollections();
  const items = useMemo(() => collections.rows, [collections]);

  const { notifyInfo, notifySuccess, notifyError } = useToast();
  const [name, setName] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: x
  useEffect(() => {
    if (!id) {
      return;
    }

    const found = items.find((item) => item.id === id);

    if (!found) {
      return notifyError(t("Knowledge.Form.Notification.CollectionNotFound"));
    }

    setMemo(found.description);
    setName(found.name);
  }, [id, items]);

  const handleSave = async () => {
    if (isBlank(name)) {
      notifyError(t("Knowledge.Notification.NameRequired"));
      return;
    }

    if (id) {
      window.bridge.documentManager
        .updateCollection({
          id,
          name,
          description: memo,
        })
        .then(() => {
          notifySuccess(t("Knowledge.Notification.CollectionUpdated"));
          navigate(-1);
        })
        .catch(console.log);
    } else {
      window.bridge.documentManager
        .createCollection({ name, description: memo })
        .then(() => {
          notifySuccess(t("Knowledge.Notification.CollectionCreated"));
          navigate(-1);
        })
        .catch(console.log);
    }
  };

  return (
    <div className="page h-full">
      <div className="page-top-bar" />
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t("Knowledge.Page.Title.Collection")}</h1>
          <div className="flex items-center justify-end gap-2">
            <Button appearance="subtle" onClick={() => navigate(-1)}>
              {t("Common.Cancel")}
            </Button>
            <Button appearance="primary" onClick={handleSave}>
              {t("Common.Save")}
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        <div className="mr-5 flex flex-col">
          <div className="mb-2.5">
            <Field label={t("Common.Name")}>
              <Input
                value={name}
                placeholder={t("Common.Required")}
                onChange={(_: ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => setName(data.value || "")}
              />
            </Field>
          </div>
          <div className="mb-2.5">
            <Field label={t("Common.Memo")}>
              <Input
                value={memo}
                placeholder={t("Common.Optional")}
                onChange={(_: ChangeEvent<HTMLInputElement>, data: InputOnChangeData) => setMemo(data.value || "")}
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
