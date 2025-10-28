import { Bridge } from "@/main/internal/bridge";
import { Container } from "@/main/internal/container";
import { SettingsStore } from "@/main/stories/settings-store";

export class SettingsStoreBridge extends Bridge.define("settings-store", () => {
  const service = Container.inject(SettingsStore);

  return {
    updateLanguage: async (language: SettingsStore.Language) => {
      service.updateLanguage(language);
    },
    updateTheme: async (theme: SettingsStore.Theme) => {
      service.updateTheme(theme);
    },
    updateFontSize: async (fontSize: SettingsStore.FontSize) => {
      service.updateFontSize(fontSize);
    },
    stream: () => {
      return service.stream();
    },
  };
}) {}
