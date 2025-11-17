import { nativeTheme } from "electron";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";

export class Settings extends Stateful.Persistable<Settings.State> {
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

    nativeTheme.themeSource = this.state.theme;
  }

  updateTheme(theme: Settings.Theme) {
    this.update((draft) => {
      draft.theme = theme;
    });

    nativeTheme.themeSource = this.state.theme;
  }

  updateLanguage(language: Settings.Language) {
    this.update((draft) => {
      draft.language = language;
    });
  }

  updateFontSize(fontSize: Settings.FontSize) {
    this.update((draft) => {
      draft.fontSize = fontSize;
    });
  }
}

export namespace Settings {
  export type Language = "en" | "zh" | "system";

  export type Theme = "light" | "dark" | "system";

  export type FontSize = "base" | "large" | "xl";

  export type State = {
    language: Language;
    theme: Theme;
    fontSize: FontSize;
  };
}
