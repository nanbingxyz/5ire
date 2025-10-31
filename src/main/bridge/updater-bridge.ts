import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { Updater } from "@/main/services/updater";

export class UpdaterBridge extends Bridge.define("updater", () => {
  const service = Container.inject(Updater);

  return {
    checkForUpdates: async () => {
      return service.checkForUpdates();
    },
    installNow: async () => {
      return service.installNow();
    },
    downloadUpdates: async () => {
      return service.downloadUpdates();
    },
    cancelDownloadUpdates: async () => {
      return service.cancelDownloadUpdates();
    },
    createStateStream: () => {
      const transformStatus = (status: Updater.Status) => {
        if (status.type === "downloading") {
          return {
            type: "downloading",
            progress: status.progress,
          } as const;
        }

        return status;
      };

      return service.createStream(({ status, version }) => {
        return {
          version,
          status: transformStatus(status),
        };
      });
    },
  };
}) {}
