import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { Settings } from "@/main/services/settings";

export class SettingsBridge extends Bridge.define("settings", () => {
  const service = Container.inject(Settings);

  return {
    updateLanguage: async (language: Settings.Language) => {
      service.updateLanguage(language);
    },
    updateTheme: async (theme: Settings.Theme) => {
      service.updateTheme(theme);
    },
    updateFontSize: async (fontSize: Settings.FontSize) => {
      service.updateFontSize(fontSize);
    },
    createStateStream: () => {
      return service.createStream((state) => state);
    },
  };
}) {}
