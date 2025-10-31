import { app, BrowserWindow, nativeTheme, shell } from "electron";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Store } from "@/main/internal/store";
import { Logger } from "@/main/services/logger";

export class Renderer extends Store<Renderer.State> {
  #environment = Container.inject(Environment);
  #logger = Container.inject(Logger).scope("Renderer");

  constructor() {
    super(() => {
      return {
        window: null,
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
        shouldUseHighContrastColors: nativeTheme.shouldUseHighContrastColors,
        shouldUseInvertedColorScheme: nativeTheme.shouldUseInvertedColorScheme,
        inForcedColorsMode: nativeTheme.inForcedColorsMode,
        prefersReducedTransparency: nativeTheme.prefersReducedTransparency,
        preferredSystemLanguages: app.getPreferredSystemLanguages(),
        locale: app.getLocale(),
        localeCountryCode: app.getLocaleCountryCode(),
        systemLocale: app.getSystemLocale(),
      };
    });

    nativeTheme.addListener("updated", () => {
      this.update((draft) => {
        draft.shouldUseDarkColors = nativeTheme.shouldUseDarkColors;
        draft.shouldUseHighContrastColors = nativeTheme.shouldUseHighContrastColors;
        draft.shouldUseInvertedColorScheme = nativeTheme.shouldUseInvertedColorScheme;
        draft.inForcedColorsMode = nativeTheme.inForcedColorsMode;
        draft.prefersReducedTransparency = nativeTheme.prefersReducedTransparency;
      });
    });
  }

  get #windowOptions() {
    const options: Electron.BrowserWindowConstructorOptions = {
      width: 1024,
      height: 728,
      minWidth: 468,
      minHeight: 600,
      frame: false,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        webSecurity: false,
        preload: this.#environment.preloadEntry,
      },
    };

    if (process.platform === "win32") {
      options.titleBarStyle = "hidden";
    }

    if (process.platform === "darwin") {
      options.vibrancy = "sidebar";
      options.visualEffectState = "active";
      options.transparent = true;
    }

    return options;
  }

  async #init() {
    const logger = this.#logger.scope("Init");

    if (this.state.window && !this.state.window.isDestroyed()) {
      return logger.error("Cannot init renderer: renderer is already initialized");
    }

    const window = new BrowserWindow(this.#windowOptions);

    this.update((draft) => {
      draft.window = window;
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url).catch((error) => {
        logger.capture(error, `Failed to open external link: ${url}`);
      });

      return {
        action: "deny",
      };
    });

    window.webContents.on("will-navigate", (event) => {
      event.preventDefault();
    });

    window.webContents.on("did-finish-load", () => {
      window?.show();
      window?.focus();
    });

    window.webContents.once("did-fail-load", () => {
      window.reload();
    });

    window.on("closed", () => {
      this.update((draft) => {
        draft.window = null;
      });
    });

    if (!app.isPackaged && this.#environment.rendererDevServer) {
      await window.loadURL(this.#environment.rendererDevServer);
    } else {
      await window.loadFile(this.#environment.rendererEntry);
    }
  }

  async focus() {
    if (!this.state.window || this.state.window.isDestroyed()) {
      await this.#init();
    }

    if (this.state.window) {
      if (this.state.window.isMinimized()) {
        this.state.window.restore();
      }

      this.state.window.focus();
    }
  }
}

export namespace Renderer {
  export type State = {
    window: Electron.BrowserWindow | null;
    shouldUseDarkColors: boolean;
    shouldUseHighContrastColors: boolean;
    shouldUseInvertedColorScheme: boolean;
    inForcedColorsMode: boolean;
    prefersReducedTransparency: boolean;
    locale: string;
    localeCountryCode: string;
    preferredSystemLanguages: string[];
    systemLocale: string;
  };
}
