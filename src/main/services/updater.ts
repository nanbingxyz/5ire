import { asError } from "catch-unknown";
import { autoUpdater, CancellationToken, type ProgressInfo, type UpdateInfo } from "electron-updater";
import { Container } from "@/main/internal/container";
import { Store } from "@/main/internal/store";
import { Logger } from "@/main/services/logger";

export class Updater extends Store<Updater.State> {
  #logger = Container.inject(Logger).scope("Updater");

  constructor() {
    super(() => {
      return {
        status: {
          type: "idle",
        },
        version: autoUpdater.currentVersion.version,
      };
    });

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
    const logger = this.#logger.scope("CheckForUpdates");

    if (this.state.status.type !== "idle") {
      return logger.error("Cannot check for updates: updater is already checking for updates");
    }

    this.update((draft) => {
      draft.status = {
        type: "checking",
      };
    });

    return autoUpdater
      .checkForUpdates()
      .then((it) => {
        if (it?.cancellationToken) {
          this.update((draft) => {
            draft.status = {
              type: "available",
              updateInfo: it.updateInfo,
            };
          });
        } else {
          this.update((draft) => {
            draft.status = {
              type: "not-available",
            };
          });
        }
      })
      .catch((error) => {
        logger.capture(error, "Failed to check for updates");

        this.update((draft) => {
          draft.status = {
            type: "error",
            message: asError(error).message,
          };
        });
      });
  }

  async downloadUpdates() {
    const logger = this.#logger.scope("DownloadUpdates");

    if (this.state.status.type !== "available" && this.state.status.type !== "error") {
      return logger.error("Cannot download updates: updater is not available");
    }

    const cancellationToken = new CancellationToken();
    const updateInfo = this.state.status.updateInfo;

    if (!updateInfo) {
      return logger.error("Cannot download updates: update info is not available");
    }

    this.update((draft) => {
      draft.status = {
        type: "downloading",
        updateInfo: updateInfo,
        cancellationToken,
      };
    });

    const handleProgress = (progress: ProgressInfo) => {
      if (cancellationToken.cancelled) {
        return;
      }

      this.update((draft) => {
        if (draft.status.type === "downloading") {
          draft.status.progress = progress;
        }
      });
    };

    const handleUpdateDownloaded = (updateInfo: UpdateInfo) => {
      if (cancellationToken.cancelled) {
        return;
      }

      this.update((draft) => {
        draft.status = {
          type: "downloaded",
          updateInfo: updateInfo,
        };
      });
    };

    autoUpdater.on("download-progress", handleProgress);
    autoUpdater.on("update-downloaded", handleUpdateDownloaded);

    return autoUpdater
      .downloadUpdate(cancellationToken)
      .catch((error) => {
        logger.capture(error, "Failed to download updates");
        this.update((draft) => {
          draft.status = {
            type: "error",
            message: asError(error).message,
            updateInfo,
          };
        });
      })
      .finally(() => {
        autoUpdater.removeListener("download-progress", handleProgress);
        autoUpdater.removeListener("update-downloaded", handleUpdateDownloaded);
      });
  }

  cancelDownloadUpdates() {
    const logger = this.#logger.scope("CancelDownloadUpdates");

    if (this.state.status.type !== "downloading") {
      return logger.error("Cannot cancel download updates: updater is not downloading");
    }
    const updateInfo = this.state.status.updateInfo;

    this.state.status.cancellationToken.cancel();
    this.update((draft) => {
      draft.status = {
        type: "available",
        updateInfo: updateInfo,
      };
    });
  }

  installNow() {
    const logger = this.#logger.scope("InstallNow");

    if (this.state.status.type !== "downloaded") {
      return logger.error("Cannot install updates: updater is not downloaded");
    }

    return autoUpdater.quitAndInstall(true, true);
  }
}

export namespace Updater {
  export type Status =
    | {
        type: "idle" | "checking" | "not-available";
      }
    | {
        type: "available";
        updateInfo: UpdateInfo;
      }
    | {
        type: "downloading";
        updateInfo: UpdateInfo;
        progress?: ProgressInfo;
        cancellationToken: CancellationToken;
      }
    | {
        type: "downloaded";
        updateInfo: UpdateInfo;
      }
    | {
        type: "error";
        message: string;
        updateInfo?: UpdateInfo;
      };

  export type State = {
    /**
     * The current version.
     */
    version: string;
    /**
     * The updater service status.
     */
    status: Status;
  };

  export type Events = {
    UPDATES_DOWNLOAD_FAILED: {
      message: string;
    };
  };
}
