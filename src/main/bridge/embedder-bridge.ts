import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { Embedder } from "@/main/services/embedder";

export class EmbedderBridge extends Bridge.define("embedder", () => {
  const service = Container.inject(Embedder);

  return {
    embed: async (text: string) => {
      return service.embed(text);
    },
    removeModel: async () => {
      return service.removeModel();
    },
    downloadModel: async () => {
      return service.downloadModel();
    },
    cancelDownloadModel: async () => {
      return service.cancelDownloadModel();
    },
    createStateStream: () => {
      const transformStatus = (status: Embedder.Status) => {
        if (status.type === "ready") {
          return {
            type: "ready",
            running: status.running,
          } as const;
        }

        return status;
      };

      return service.createStream((state) => {
        return {
          model: state.model,
          files: state.files,
          status: transformStatus(state.status),
        };
      });
    },
  };
}) {}
