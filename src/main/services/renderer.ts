import { app, BrowserWindow, shell } from "electron";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";

export class Renderer {
  #environment = Container.inject(Environment);
  #window: Electron.BrowserWindow | null = null;

  constructor() {
    this.#window = null;
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

  get window() {
    return this.#window;
  }

  async #init() {
    if (this.#window && !this.#window.isDestroyed()) {
      return;
    }

    this.#window = new BrowserWindow(this.#windowOptions);

    this.#window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url).catch(() => {
        // ignore
      });

      return {
        action: "deny",
      };
    });

    this.#window.webContents.on("will-navigate", (event) => {
      if (!this.#window) {
        return event.preventDefault();
      }

      const url = new URL(this.#window.webContents.getURL());

      console.log(url, event.url);

      event.preventDefault();
    });

    this.#window.webContents.on("did-finish-load", () => {
      this.#window?.show();
      this.#window?.focus();
    });

    this.#window.webContents.once("did-fail-load", () => {
      this.#window?.reload();
    });

    this.#window.on("closed", () => {
      this.#window = null;
    });

    if (!app.isPackaged && this.#environment.rendererDevServer) {
      await this.#window.loadURL(this.#environment.rendererDevServer);
    } else {
      await this.#window.loadFile(this.#environment.rendererEntry);
    }
  }

  async focus() {
    if (!this.#window || this.#window.isDestroyed()) {
      await this.#init();
    }

    if (this.#window) {
      if (this.#window.isMinimized()) {
        this.#window.restore();
      }

      this.#window.focus();
    }
  }
}
