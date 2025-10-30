import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { Renderer } from "@/main/services/renderer";

export class RendererBridge extends Bridge.define("renderer", () => {
  const service = Container.inject(Renderer);

  return {
    focus: async () => {
      return service.focus();
    },

    stream: () => {
      return service.createStream((state) => {
        return {
          locale: state.locale,
          shouldUseDarkColors: state.shouldUseDarkColors,
        };
      });
    },
  };
}) {}
