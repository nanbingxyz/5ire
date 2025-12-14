import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { PromptsManager } from "@/main/services/prompts-manager";

export class PromptsManagerBridge extends Bridge.define("prompts-manager", () => {
  const service = Container.inject(PromptsManager);

  return {
    createPrompt: service.createPrompt.bind(service),
    deletePrompt: service.deletePrompt.bind(service),
    listPrompts: service.listPrompts.bind(service),
    updatePrompt: service.updatePrompt.bind(service),

    livePrompts: () => {
      const abort = new AbortController();

      return new ReadableStream<Awaited<ReturnType<typeof service.livePrompts>>["initialResults"]>({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          service
            .livePrompts()
            .then((live) => {
              if (abort.signal.aborted) {
                return;
              }

              live.refresh().catch();
              controller.enqueue(live.initialResults);

              abort.signal.addEventListener("abort", live.subscribe(controller.enqueue.bind(controller)));
            })
            .catch((error) => {
              controller.error(error);
            });
        },
      });
    },
  };
}) {}
