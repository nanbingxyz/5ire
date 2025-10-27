import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { Downloader } from "@/main/services/downloader";

export class DownloaderBridge extends Bridge.define("downloader", () => {
  const service = Container.inject(Downloader);

  return {
    download: (url: string) => {
      const abort = new AbortController();

      return new ReadableStream<Record<"total" | "received", number>>({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          service
            .download({
              url,
              signal: abort.signal,
              onProgress: (received, total) => {
                controller.enqueue({ received, total });
              },
            })
            .then(() => {
              controller.close();
            })
            .catch((e) => {
              controller.error(e);
            });
        },
      });
    },
  };
}) {}
