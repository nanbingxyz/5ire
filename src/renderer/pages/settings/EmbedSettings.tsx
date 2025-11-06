import { Button, ProgressBar, Spinner } from "@fluentui/react-components";
import { CheckmarkCircle16Filled, CheckmarkCircle20Filled } from "@fluentui/react-icons";
import useToast from "hooks/useToast";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "renderer/components/ConfirmDialog";
import { useEmbedder } from "@/renderer/next/hooks/remote/use-embedder";

/**
 * React component for managing embedding model settings.
 * Provides functionality to download, manage, and remove the BGE-M3 embedding model
 * and its associated configuration files.
 *
 * @returns {JSX.Element} The embedding settings interface
 */
export default function EmbedSettings() {
  const { t } = useTranslation();

  const embedder = useEmbedder();

  const { notifySuccess, notifyError } = useToast();
  const [delConfirmDialogOpen, setDelConfirmDialogOpen] = useState(false);

  const handleDelete = () => {
    setDelConfirmDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    window.bridge.embedder.removeModel().catch((e) => {
      //
    });
    // removeModel();
    notifySuccess(t("Settings.Embeddings.Notification.ModelDeleted"));
  };

  const handleDownload = () => {
    window.bridge.embedder.downloadModel().catch(console.log);
  };

  const handleCancel = () => {
    window.bridge.embedder.cancelDownloadModel().catch(console.log);
  };

  const renderModelName = () => {
    return (
      <div className="flex flex-start items-center gap-2">
        <span>{t("Common.Model")}: </span>
        <span>{embedder.model}</span>
        <span>{embedder.status.type === "ready" && <CheckmarkCircle20Filled className="text-green-500" />}</span>
        <span>{embedder.status.type === "initializing" && <Spinner size="extra-tiny" />}</span>
      </div>
    );
  };

  const renderModelActions = () => {
    switch (embedder.status.type) {
      case "ready":
        return (
          <Button appearance="subtle" size="small" onClick={handleDelete}>
            {t("Common.Delete")}
          </Button>
        );
      case "downloading":
        return (
          <Button appearance="subtle" size="small" onClick={handleCancel}>
            {t("Common.Cancel")}
          </Button>
        );
      case "unavailable":
        return (
          <Button appearance="primary" size="small" onClick={handleDownload}>
            {t("Common.Download")}
          </Button>
        );
    }
  };

  const renderTips = () => {
    return (
      <div className="tips mt-2 mb-2">
        {embedder.status.type === "ready"
          ? t("Settings.Embeddings.Tip.ModelExists")
          : t("Settings.Embeddings.Tip.ModelRequired")}
      </div>
    );
  };

  const renderFiles = () => {
    if (embedder.status.type !== "downloading" && embedder.status.type !== "ready") {
      return null;
    }

    const renderProgressValue = (value: Record<"total" | "received", number>) => {
      if (value.received === 0) {
        return 0;
      }

      if (value.total >= 0) {
        return value.received / value.total;
      }

      return 0.05;
    };

    return (
      <div>
        {embedder.files.map((file) => {
          return (
            <div key={file} className="flex justify-start items-center gap-2 py-1">
              <div className="">{file}</div>
              {embedder.status.type === "downloading" && (
                <ProgressBar value={renderProgressValue(embedder.status.progress[file])} className="w-32" />
              )}
              {embedder.status.type === "ready" && <CheckmarkCircle16Filled className="text-green-500" />}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="settings-section">
      <div className="settings-section--header">{t("Common.Embeddings")}</div>
      <div className="py-4 flex-grow mt-1 flex-1">
        <div className="flex justify-between items-start">
          {renderModelName()}
          {renderModelActions()}
        </div>
        {renderTips()}
        {renderFiles()}
      </div>
      <ConfirmDialog
        open={delConfirmDialogOpen}
        setOpen={setDelConfirmDialogOpen}
        message={t("Settings.Embeddings.Confirmation.DeleteModel")}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
