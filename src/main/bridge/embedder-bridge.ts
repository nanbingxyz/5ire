import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { Embedder } from "@/main/services/embedder";

export class EmbedderBridge extends Bridge.define("embedder", () => {
  const service = Container.inject(Embedder);

  return {
    embed: async (text: string) => {
      return service.embed(text);
    },
    remove: async () => {
      return service.remove();
    },
    download: () => {
      const abort = new AbortController();

      return new ReadableStream<Record<string, [number, number]>>({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          const progress: Record<string, [number, number]> = {};

          service.download(abort.signal, (name, received, total) => {
            progress[name] = [received, total];

            controller.enqueue(progress);
          });
        },
      });
    },
    stream: () => {
      return service.stream((state) => {
        if (state.status === "ready") {
          return {
            status: "ready",
            running: state.running,
          } as const;
        }

        return state;
      });
    },
  };
}) {}
