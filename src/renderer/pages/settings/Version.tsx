import { Button } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Spinner from "renderer/components/Spinner";
import { useUpdater } from "@/renderer/next/hooks/remote/use-updater";
import { captureException } from "../../logging";

interface IUpdateInfo {
  version: string;
  releaseNotes: string;
  releaseName: string;
  isDownloading: boolean;
}

export default function Version() {
  const { t } = useTranslation();

  const [updateInfo, setUpdateInfo] = useState<IUpdateInfo>();
  const [version, setVersion] = useState("0");

  const updater = useUpdater();

  console.log(updater);

  useEffect(() => {
    let timer: number | null = null;
    let info = window.electron.store.get("updateInfo");
    setUpdateInfo(info);
    if (info?.isDownloading) {
      timer = setInterval(() => {
        info = window.electron.store.get("updateInfo");
        if (timer && !info?.isDownloading) {
          clearInterval(timer);
        }
        setUpdateInfo(info);
      }, 1000) as any;
    }
    window.electron
      .getAppVersion()
      .then((appVersion) => {
        return setVersion(appVersion);
      })
      .catch(captureException);

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  const renderProgress = (total: number, received: number) => {
    return `${((received / total) * 100).toFixed(1)}%`;
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
                <span className="tips">{t("Updater.CheckingForUpdates")}...</span>
              </div>
            )}
          </div>

          {updater.status.type === "available" && (
            <div className="flex items-center">
              <div className="tips">
                {t("Version.HasNewVersion")} {updater.status.updateInfo.version}{" "}
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
                {t("Version.HasNewVersion")} {updater.status.updateInfo.version}{" "}
              </span>
            </div>
          )}
        </div>

        <div className="flex justify-start gap-2 items-center mt-4">
          {updater.status.type === "available" && (
            <div>
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
                {updater.status.updateInfo.version} will be installed after you restart the app.
              </div>
            </div>
          )}

          {(updater.status.type === "idle" ||
            updater.status.type === "error" ||
            updater.status.type === "not-available") && (
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
