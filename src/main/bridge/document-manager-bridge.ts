import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { DocumentManager } from "@/main/services/document-manager";

export class DocumentManagerBridge extends Bridge.define("document-manager", () => {
  const service = Container.inject(DocumentManager);

  return {
    createCollection: service.createCollection.bind(service),
    deleteCollection: service.deleteCollection.bind(service),
    updateCollection: service.updateCollection.bind(service),
    toggleCollectionPin: service.toggleCollectionPin.bind(service),
    importDocuments: service.importDocuments.bind(service),
    deleteDocument: service.deleteDocument.bind(service),
    liveCollections: () => {
      const abort = new AbortController();

      return new ReadableStream<Awaited<ReturnType<typeof service.liveCollections>>["initialResults"]>({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          service
            .liveCollections()
            .then((live) => {
              if (abort.signal.aborted) {
                return;
              }

              live.subscribe(controller.enqueue);

              abort.signal.addEventListener("abort", () => {
                live.unsubscribe(controller.enqueue).catch(() => {});
              });
            })
            .catch((error) => {
              controller.error(error);
            });
        },
      });
    },
    liveDocuments: (collection: string) => {
      const abort = new AbortController();

      return new ReadableStream<Awaited<ReturnType<typeof service.liveDocuments>>["initialResults"]>({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          service
            .liveDocuments(collection)
            .then((live) => {
              if (abort.signal.aborted) {
                return;
              }

              live.subscribe(controller.enqueue);

              abort.signal.addEventListener("abort", () => {
                live.unsubscribe(controller.enqueue).catch(() => {});
              });
            })
            .catch((error) => {
              controller.error(error);
            });
        },
      });
    },
  };
}) {}
