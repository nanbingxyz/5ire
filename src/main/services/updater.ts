import { autoUpdater, CancellationToken, type ProgressInfo } from "electron-updater";

export class Updater {
  constructor() {
    autoUpdater.forceDevUpdateConfig = true;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.setFeedURL({
      provider: "generic",
      url: "https://github.com/nanbingxyz/5ire/releases/latest/download/",
    });
    autoUpdater.autoInstallOnAppQuit = true;
  }

  async checkForUpdates() {
    return autoUpdater.checkForUpdates().then((it) => {
      return !!it?.cancellationToken;
    });
  }

  async downloadUpdates(signal: AbortSignal, onProgress: (info: ProgressInfo) => void) {
    const cancellationToken = new CancellationToken();

    if (signal.aborted) {
      return;
    }

    signal.addEventListener("abort", () => cancellationToken.cancel());

    autoUpdater.on("download-progress", onProgress);

    return autoUpdater
      .downloadUpdate(cancellationToken)
      .then(() => {})
      .finally(() => {
        autoUpdater.removeListener("download-progress", onProgress);
      });
  }

  quitAndInstall() {
    return autoUpdater.quitAndInstall(true, true);
  }
}
