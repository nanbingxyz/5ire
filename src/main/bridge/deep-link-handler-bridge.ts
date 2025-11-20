import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { DeepLinkHandler } from "@/main/services/deep-link-handler";

export class DeepLinkHandlerBridge extends Bridge.define("deep-link-handler", () => {
  const service = Container.inject(DeepLinkHandler);

  return {
    createStateStream: () => {
      return service.createStream((state) => state.unhandledDeepLinks);
    },
    handled: async (id: string) => {
      service.handled(id);
    },
  };
}) {}
