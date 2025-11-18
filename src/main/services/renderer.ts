import { app, BrowserWindow, nativeTheme, shell } from "electron";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { Stateful } from "@/main/internal/stateful";
import MenuBuilder from "@/main/menu";
import { Logger } from "@/main/services/logger";

/**
 * Renderer class is used to manage the application's rendering process and browser window
 * Responsible for creating, configuring and managing Electron's BrowserWindow instances
 * @extends Stateful<Renderer.State>
 */
export class Renderer extends Stateful<Renderer.State> {
  #environment = Container.inject(Environment);
  #logger = Container.inject(Logger).scope("Renderer");

  /**
   * Create Renderer instance
   * Initialize window state and system theme listeners
   */
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

  /**
   * Get browser window configuration options
   * Set specific window styles and behaviors based on different platforms
   * @returns Electron.BrowserWindowConstructorOptions Browser window configuration options
   */
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

  /**
   * Initialize browser window
   * Create a new BrowserWindow instance and configure related event handling
   * @returns Promise<void>
   */
  async init() {
    const logger = this.#logger.scope("Init");

    if (this.state.window && !this.state.window.isDestroyed()) {
      return logger.error("Cannot init renderer: renderer is already initialized");
    }

    const window = new BrowserWindow(this.#windowOptions);

    this.update((draft) => {
      draft.window = window;
    });

    new MenuBuilder(window).buildMenu();

    window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url).catch((error) => {
        logger.capture(error, {
          reason: `Failed to open external link: ${url}`,
        });
      });

      return {
        action: "deny",
      };
    });

    window.webContents.on("will-navigate", (event) => {
      event.preventDefault();
    });

    window.webContents.on("did-finish-load", () => {
      // window?.show();
      // window?.focus();
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

  /**
   * Focus on the browser window
   * If the window does not exist or has been destroyed, initialize the window first
   * @returns Promise<void>
   */
  async focus() {
    if (!this.state.window || this.state.window.isDestroyed()) {
      await this.init();
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
  /**
   * Renderer state definition
   * Contains window instance and system theme related information
   */
  export type State = {
    /**
     * Browser window instance
     * Null if window is not created or has been closed
     */
    window: Electron.BrowserWindow | null;
    /**
     * Whether dark theme should be used
     * Determined based on system theme settings
     */
    shouldUseDarkColors: boolean;
    /**
     * Whether high contrast theme should be used
     * Determined based on system theme settings
     */
    shouldUseHighContrastColors: boolean;
    /**
     * Whether inverted color scheme should be used
     * Determined based on system theme settings
     */
    shouldUseInvertedColorScheme: boolean;
    /**
     * Whether in forced colors mode
     * Determined based on system theme settings
     */
    inForcedColorsMode: boolean;
    /**
     * Whether reduced transparency is preferred
     * Determined based on system theme settings
     */
    prefersReducedTransparency: boolean;
    /**
     * System preferred language list
     * Array of language codes sorted by priority
     */
    locale: string;
    /**
     * Localization country code
     * Represents the country/region part of the current locale setting
     */
    localeCountryCode: string;
    /**
     * System preferred language list
     * Array of language codes sorted by priority
     */
    preferredSystemLanguages: string[];
    /**
     * System localization settings
     * Represents the complete localization information of the system
     */
    systemLocale: string;
  };
}
