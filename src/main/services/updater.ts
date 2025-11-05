import { asError } from "catch-unknown";
import { autoUpdater, CancellationToken, type ProgressInfo, type UpdateInfo } from "electron-updater";
import { Container } from "@/main/internal/container";
import { Emitter } from "@/main/internal/emitter";
import { Store } from "@/main/internal/store";
import { Logger } from "@/main/services/logger";

/**
 * Updater class is used to handle application update functions
 * Includes checking for updates, downloading updates, canceling downloads and installing updates
 * @extends Store<Updater.State>
 */
export class Updater extends Store<Updater.State> {
  #logger = Container.inject(Logger).scope("Updater");
  #emitter = Emitter.create<Updater.Events>();

  /**
   * Get event emitter instance
   * @returns Event emitter instance
   */
  get emitter() {
    return this.#emitter;
  }

  /**
   * Create Updater instance
   * Initialize automatic update configuration and initial state
   */
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

  /**
   * Check for available updates
   * @returns Promise<void>
   */
  async checkForUpdates() {
    const logger = this.#logger.scope("CheckForUpdates");

    if (
      this.state.status.type !== "idle" &&
      this.state.status.type !== "error" &&
      this.state.status.type !== "not-available"
    ) {
      return logger.info("Cannot check for updates: updater is already checking or has updates available");
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

  /**
   * Download available updates
   * @returns Promise<void>
   */
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
        this.emitter.emit("updates-download-failed", {
          message: asError(error).message,
        });
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

  /**
   * Cancel ongoing update download
   */
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

  /**
   * Install downloaded updates immediately
   * Will exit the application and install updates
   */
  installNow() {
    const logger = this.#logger.scope("InstallNow");

    if (this.state.status.type !== "downloaded") {
      return logger.error("Cannot install updates: updater is not downloaded");
    }

    return autoUpdater.quitAndInstall(true, true);
  }
}

export namespace Updater {
  /**
   * Updater status types
   * Represents the updater's status at different stages
   */
  export type Status =
    | {
        /**
         * Idle status, checking status or no update status
         * - idle: Idle status, no operations performed
         * - checking: Checking for updates
         * - not-available: No updates available
         */
        type: "idle" | "checking" | "not-available";
      }
    | {
        /**
         * Update available status
         * Found available updates, but download has not started yet
         */
        type: "available";
        /**
         * Update information
         * Contains detailed information about the available update
         */
        updateInfo: UpdateInfo;
      }
    | {
        /**
         * Downloading status
         * Downloading update files
         */
        type: "downloading";
        /**
         * Update information
         * Contains detailed information about the update being downloaded
         */
        updateInfo: UpdateInfo;
        /**
         * Download progress information (optional)
         * Contains detailed download progress information
         */
        progress?: ProgressInfo;
        /**
         * Download cancellation token
         * Used to cancel ongoing download operations
         */
        cancellationToken: CancellationToken;
      }
    | {
        /**
         * Download completed status
         * Update files have been downloaded and are waiting for installation
         */
        type: "downloaded";
        /**
         * Update information
         * Contains detailed information about the downloaded update
         */
        updateInfo: UpdateInfo;
      }
    | {
        /**
         * Error status
         * Error occurred during update checking or downloading
         */
        type: "error";
        /**
         * Error message
         * Describes the reason for the error
         */
        message: string;
        /**
         * Update information (optional)
         * Contains related update information if an error occurred during download
         */
        updateInfo?: UpdateInfo;
      };

  /**
   * Updater complete state definition
   * Contains current version and updater service status
   */
  export type State = {
    /**
     * Current version number
     * Current version string of the application
     */
    version: string;
    /**
     * Updater service status
     * Represents the current operational stage of the updater
     */
    status: Status;
  };

  /**
   * Updater event definitions
   * Defines various events that the updater may trigger
   */
  export type Events = {
    /**
     * Update download failed event
     * Triggered when an error occurs during update file download
     */
    "updates-download-failed": {
      /**
       * Error message
       * Contains specific reason description for download failure
       */
      message: string;
    };
  };
}
