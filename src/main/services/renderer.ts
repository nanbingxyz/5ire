import { app, BrowserWindow, nativeTheme, shell } from "electron";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Store } from "@/main/internal/store";

export class Renderer extends Store<Renderer.State> {
  #environment = Container.inject(Environment);

  constructor() {
    super(() => {
      return {
        window: null,
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
        locale: app.getLocale(),
      };
    });

    nativeTheme.addListener("updated", () => {
      this.update((draft) => {
        draft.shouldUseDarkColors = nativeTheme.shouldUseDarkColors;
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
    if (this.state.window && !this.state.window.isDestroyed()) {
      return;
    }

    const window = new BrowserWindow(this.#windowOptions);

    this.update((draft) => {
      draft.window = window;
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url).catch(() => {
        // ignore
      });

      return {
        action: "deny",
      };
    });

    window.webContents.on("will-navigate", (event) => {
      if (!window) {
        return event.preventDefault();
      }

      const url = new URL(window.webContents.getURL());

      console.log(url, event.url);

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
    locale: string;
  };
}
