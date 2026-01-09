import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { ConversationsManager } from "@/main/services/conversations-manager";

export class ConversationsManagerBridge extends Bridge.define("conversations-manager", () => {
  const service = Container.inject(ConversationsManager);

  return {
    createConversation: service.createConversation.bind(service),
    deleteConversation: service.deleteConversation.bind(service),
    getStageConversation: service.getStageConversation.bind(service),
    // liveConversationTurns: service.liveConversationTurns.bind(service),
    // liveConversationTurnsUpdate: service.liveConversationTurnsUpdate.bind(service),
    // liveConversations: service.liveConversations.bind(service),
    setStageConversation: service.setStageConversation.bind(service),
    updateConversation: service.updateConversation.bind(service),
    startTurn: service.startTurn.bind(service),
    getConversation: service.getConversation.bind(service),

    liveTurns: (options: ConversationsManager.LiveTurnsOptions) => {
      const abort = new AbortController();

      return new ReadableStream<Awaited<ReturnType<typeof service.liveTurns>>["initialResults"]>({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          service
            .liveTurns(options)
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
    liveConversations: (options: ConversationsManager.LiveConversationsOptions) => {
      const abort = new AbortController();

      return new ReadableStream<Awaited<ReturnType<typeof service.liveConversations>>["initialResults"]>({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          service
            .liveConversations(options)
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
