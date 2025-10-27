import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { Updater } from "@/main/services/updater";

export class UpdaterBridge extends Bridge.define("updater", () => {
  const service = Container.inject(Updater);

  return {
    check: async () => {
      return service.checkForUpdates();
    },
    install: async () => {
      return service.quitAndInstall();
    },
    download: () => {
      const abort = new AbortController();

      return new ReadableStream({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          if (abort.signal.aborted) {
            return controller.close();
          }

          service
            .downloadUpdates(abort.signal, (info) => {
              controller.enqueue(info);
            })
            .then(() => {
              controller.close();
            })
            .catch((error) => {
              controller.error(error);
            });
        },
      });
    },
  };
}) {}
