import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { MCPServersManager } from "@/main/services/mcp-servers-manager";

export class MCPServersManagerBridge extends Bridge.define("mcp-servers-manager", () => {
  const service = Container.inject(MCPServersManager);

  return {
    createServer: service.createServer.bind(service),
    updateServer: service.updateServer.bind(service),
    deleteServer: service.deleteServer.bind(service),
    activateServer: service.activateServer.bind(service),
    deactivateServer: service.deactivateServer.bind(service),
    liveServers: () => {
      const abort = new AbortController();

      return new ReadableStream<Awaited<ReturnType<typeof service.liveServers>>["initialResults"]>({
        cancel: () => {
          abort.abort();
        },
        start: (controller) => {
          service
            .liveServers()
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
