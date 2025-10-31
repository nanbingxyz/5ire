import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { Renderer } from "@/main/services/renderer";

export class RendererBridge extends Bridge.define("renderer", () => {
  const service = Container.inject(Renderer);

  return {
    focus: async () => {
      return service.focus();
    },

    createStateStream: () => {
      return service.createStream((state) => {
        return {
          locale: state.locale,
          shouldUseDarkColors: state.shouldUseDarkColors,
          shouldUseHighContrastColors: state.shouldUseHighContrastColors,
          shouldUseInvertedColorScheme: state.shouldUseInvertedColorScheme,
          inForcedColorsMode: state.inForcedColorsMode,
          prefersReducedTransparency: state.prefersReducedTransparency,
          preferredSystemLanguages: state.preferredSystemLanguages,
          localeCountryCode: state.localeCountryCode,
          systemLocale: state.systemLocale,
        };
      });
    },
  };
}) {}
