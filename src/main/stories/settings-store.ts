import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Store } from "@/main/internal/store";

export class SettingsStore extends Store.Persistable<SettingsStore.State> {
  constructor() {
    super({
      name: "settings",
      directory: Container.inject(Environment).storiesFolder,
      defaults: {
        language: "system",
        theme: "system",
        fontSize: "base",
      },
    });
  }

  updateTheme(theme: SettingsStore.Theme) {
    console.log("updateTheme", theme);

    this.update((draft) => {
      draft.theme = theme;
    });
  }

  updateLanguage(language: SettingsStore.Language) {
    this.update((draft) => {
      draft.language = language;
    });
  }

  updateFontSize(fontSize: SettingsStore.FontSize) {
    this.update((draft) => {
      draft.fontSize = fontSize;
    });
  }
}

export namespace SettingsStore {
  export type Language = "en" | "zh" | "system";

  export type Theme = "light" | "dark" | "system";

  export type FontSize = "base" | "large" | "xl";

  export type State = {
    language: Language;
    theme: Theme;
    fontSize: FontSize;
  };
}
