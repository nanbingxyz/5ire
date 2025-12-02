import { Button } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import Spinner from "renderer/components/Spinner";
import useMarkdown from "@/hooks/useMarkdown";
import { useUpdater } from "@/renderer/next/hooks/remote/use-updater";

export default function Version() {
  const { t } = useTranslation();

  const updater = useUpdater();
  const markdown = useMarkdown();

  const renderProgress = (total: number, received: number) => {
    return `${((received / total) * 100).toFixed(1)}%`;
  };

  const handleOpenWebsite = () => {
    window.open("https://5ire.app", "_blank");
  };

  return (
    <div className="settings-section">
      <div className="settings-section--header">{t("Common.Version")}</div>
      <div className="py-5 flex-grow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {updater.version}

            {updater.status.type === "checking" && (
              <div className="flex items-center gap-1">
                <Spinner size={14} />
              </div>
            )}
          </div>

          {updater.status.type === "available" && (
            <div className="flex items-center">
              <div className="tips">
                {t("Version.HasNewVersion")} (v{updater.status.updateInfo.version})
              </div>
            </div>
          )}

          {updater.status.type === "downloading" && (
            <div className="flex items-center gap-1">
              <Spinner size={14} />
              <span className="tips">
                {t("Updater.DownloadingUpdates")}{" "}
                {updater.status.progress &&
                  renderProgress(updater.status.progress.total, updater.status.progress.transferred)}
              </span>
            </div>
          )}

          {updater.status.type === "downloaded" && (
            <div className="flex items-center">
              <span className="tips">
                {t("Version.HasNewVersion")} (v{updater.status.updateInfo.version})
              </span>
            </div>
          )}

          {updater.status.type === "error" && updater.status.updateInfo && (
            <div className="flex items-center">
              <span className="tips">
                {t("Version.HasNewVersion")} (v{updater.status.updateInfo.version})
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-start gap-2 items-center mt-4">
          {updater.status.type === "available" && (
            <div>
              {typeof updater.status.updateInfo.releaseNotes === "string" && (
                <div
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: xx
                  dangerouslySetInnerHTML={{ __html: markdown.render(updater.status.updateInfo.releaseNotes) }}
                  className="mb-4 text-gray-500"
                />
              )}
              <Button
                appearance="primary"
                onClick={() => {
                  window.bridge.updater.downloadUpdates();
                }}
              >
                {t("Updater.DownloadUpdates")}
              </Button>
            </div>
          )}

          {updater.status.type === "downloaded" && (
            <div>
              <Button
                appearance="primary"
                onClick={() => {
                  window.bridge.updater.installNow();
                }}
              >
                {t("Updater.InstallNow")}
              </Button>

              <div className="tips">
                {t("Updater.InstallAfterRestart", {
                  version: updater.status.updateInfo.version,
                })}
              </div>
            </div>
          )}

          {updater.status.type === "error" && (
            <div className="text-red-300">
              {updater.status.updateInfo ? t("Updater.DownloadUpdatesFailed") : t("Updater.CheckForUpdatesFailed")}{" "}
              {updater.status.updateInfo && (
                <button className="underline cursor-pointer" type="button" onClick={handleOpenWebsite}>
                  {t("Updater.ManualDownload")}
                </button>
              )}
            </div>
          )}

          {(updater.status.type === "idle" || updater.status.type === "not-available") && (
            <div>
              <Button
                appearance="primary"
                onClick={() => {
                  window.bridge.updater.checkForUpdates();
                }}
              >
                {t("Updater.CheckForUpdates")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
