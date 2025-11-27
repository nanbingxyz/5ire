/* eslint global-require: off, no-console: off, promise/always-return: off */
// import 'v8-compile-cache';

import "@/main/setup";

import fs from "node:fs";
import os from "node:os";
import { join, resolve } from "node:path";
import type { Readable } from "node:stream";
import crypto from "crypto";
import {
  app,
  type BrowserWindow,
  crashReporter,
  dialog,
  ipcMain,
  Menu,
  type MessageBoxOptions,
  nativeImage,
  nativeTheme,
  shell,
} from "electron";
import Store from "electron-store";
import { ensureDirSync } from "fs-extra";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import path from "path";
import type { IMCPServer } from "types/mcp";
import { isValidMCPServer, isValidMCPServerKey } from "utils/validators";
import { DocumentEmbedderBridge } from "@/main/bridge/document-embedder-bridge";
import { DocumentManagerBridge } from "@/main/bridge/document-manager-bridge";
import { DownloaderBridge } from "@/main/bridge/downloader-bridge";
import { EmbedderBridge } from "@/main/bridge/embedder-bridge";
import { EncryptorBridge } from "@/main/bridge/encryptor-bridge";
import { LegacyDataMigratorBridge } from "@/main/bridge/legacy-data-migrator-bridge";
import { PromptManagerBridge } from "@/main/bridge/prompt-manager-bridge";
import { RendererBridge } from "@/main/bridge/renderer-bridge";
import { SettingsBridge } from "@/main/bridge/settings-bridge";
import { UpdaterBridge } from "@/main/bridge/updater-bridge";
import { Database } from "@/main/database";
import { Environment } from "@/main/environment";
import { Container } from "@/main/internal/container";
import { DocumentEmbedder } from "@/main/services/document-embedder";
import { DocumentExtractor } from "@/main/services/document-extractor";
import { DocumentManager } from "@/main/services/document-manager";
import { Downloader } from "@/main/services/downloader";
import { Embedder } from "@/main/services/embedder";
import { Encryptor } from "@/main/services/encryptor";
import { LegacyDataMigrator } from "@/main/services/legacy-data-migrator";
import { LegacyVectorDatabaseLoader } from "@/main/services/legacy-vector-database-loader";
import { Logger } from "@/main/services/logger";
import { MCPContentConverter } from "@/main/services/mcp-content-converter";
import { PromptManager } from "@/main/services/prompt-manager";
import { Renderer } from "@/main/services/renderer";
import { Settings } from "@/main/services/settings";
import { Updater } from "@/main/services/updater";
import { URLParser } from "@/main/services/url-parser";
import {
  KNOWLEDGE_IMPORT_MAX_FILE_SIZE,
  KNOWLEDGE_IMPORT_MAX_FILES,
  SUPPORTED_FILE_TYPES,
  SUPPORTED_IMAGE_TYPES,
} from "../consts";
import ModuleContext from "./mcp";
import { DocumentLoader } from "./next/document-loader/DocumentLoader";
import { initLegacyDatabase } from "./sqlite";
import { decodeBase64, getFileInfo, getFileType } from "./util";

Container.singleton(Environment, () => {
  let userDataFolder = app.getPath("userData");

  if (!app.isPackaged) {
    if (process.env.SOURCE_ROOT) {
      userDataFolder = join(app.getPath("userData"), "__DEV__");
    }
  }

  const env: Environment = {
    mode: app.isPackaged ? "production" : "development",
    cryptoSecret: process.env.CRYPTO_SECRET || "",
    rendererDevServer: process.env.RENDERER_DEV_SERVER || "",
    rendererEntry: resolve(__dirname, "./renderer/index.html"),
    preloadEntry: resolve(__dirname, "./preload.js"),
    assetsFolder: resolve(__dirname, "./assets"),
    embedderCacheFolder: resolve(userDataFolder, "Embedding/Cache"),
    embedderModelsFolder: resolve(userDataFolder, "Embedding/Models"),
    storiesFolder: resolve(userDataFolder, "Stories"),
    databaseDataFolder: resolve(userDataFolder, "Database"),
    databaseMigrationsFolder: resolve(__dirname, "./migrations"),
    userDataFolder,
    legacyDatabasePath: resolve(app.getPath("userData"), "./5ire.db"),
    legacyVectorDatabaseFolder: resolve(app.getPath("userData"), "./lancedb.db"),
    legacyMCPConfigPath: resolve(app.getPath("userData"), "./mcp.json"),
    legacyProviderConfigPath: resolve(app.getPath("userData"), "./config.json"),
    sentryDsn: process.env.SENTRY_DSN,
    sentryKey: process.env.SENTRY_KEY,
    axiomToken: process.env.AXIOM_TOKEN,
    axiomOrgId: process.env.AXIOM_ORG_ID,
    logsFolder: resolve(userDataFolder, "Logs"),
  };

  ensureDirSync(env.embedderCacheFolder);
  ensureDirSync(env.embedderModelsFolder);
  ensureDirSync(env.storiesFolder);
  ensureDirSync(env.databaseDataFolder);
  ensureDirSync(env.logsFolder);

  return env;
});

Container.singleton(Logger, () => new Logger());
Container.singleton(Encryptor, () => new Encryptor());
Container.singleton(EncryptorBridge, () => new EncryptorBridge());
Container.singleton(Renderer, () => new Renderer());
Container.singleton(RendererBridge, () => new RendererBridge());
Container.singleton(Updater, () => new Updater());
Container.singleton(UpdaterBridge, () => new UpdaterBridge());
Container.singleton(Downloader, () => new Downloader());
Container.singleton(DownloaderBridge, () => new DownloaderBridge());
Container.singleton(Settings, () => new Settings());
Container.singleton(SettingsBridge, () => new SettingsBridge());
Container.singleton(Embedder, () => new Embedder());
Container.singleton(EmbedderBridge, () => new EmbedderBridge());
Container.singleton(Database, () => new Database());
Container.singleton(LegacyDataMigrator, () => new LegacyDataMigrator());
Container.singleton(LegacyDataMigratorBridge, () => new LegacyDataMigratorBridge());
Container.singleton(LegacyVectorDatabaseLoader, () => new LegacyVectorDatabaseLoader());
Container.singleton(DocumentManager, () => new DocumentManager());
Container.singleton(DocumentManagerBridge, () => new DocumentManagerBridge());
Container.singleton(DocumentExtractor, () => new DocumentExtractor());
Container.singleton(DocumentEmbedder, () => new DocumentEmbedder());
Container.singleton(DocumentEmbedderBridge, () => new DocumentEmbedderBridge());
Container.singleton(PromptManager, () => new PromptManager());
Container.singleton(PromptManagerBridge, () => new PromptManagerBridge());
Container.singleton(URLParser, () => new URLParser());
Container.singleton(MCPContentConverter, () => new MCPContentConverter());

// init crash reporter
(() => {
  const logger = Container.inject(Logger).scope("Main:InitCrashReporter");
  const env = Container.inject(Environment);

  if (env.mode === "production" && env.sentryDsn && env.sentryKey) {
    crashReporter.start({
      submitURL: `${env.sentryDsn}/minidump/?sentry_key=${env.sentryKey}`,
    });

    logger.debug("CrashReporter initialized");
  }
})();

const mcp = new ModuleContext();
const store = new Store();

let rendererReady = false;
let pendingInstallTool: any = null;
let mainWindow: BrowserWindow | null = null;
const protocol = app.isPackaged ? "app.5ire" : "dev.5ire";

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(protocol, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(protocol);
}

const onDeepLink = (link: string) => {
  const logger = Container.inject(Logger).scope("Main:OnDeepLink");
  const { host, hash } = new URL(link);
  if (host === "login-callback") {
    const params = new URLSearchParams(hash.substring(1));
    mainWindow?.webContents.send("sign-in", {
      accessToken: params.get("access_token"),
      refreshToken: params.get("refresh_token"),
    });
  } else if (host === "install-tool") {
    const base64 = hash.substring(1);
    const data = decodeBase64(base64);
    if (data) {
      try {
        const json = JSON.parse(data);
        if (isValidMCPServer(json) && isValidMCPServerKey(json.name)) {
          if (mcp.isServerExist(json.name)) {
            const dialogOpts = {
              type: "info",
              buttons: ["Ok"],
              title: "Server Exists",
              message: `The server ${json.name} already exists`,
            } as MessageBoxOptions;
            dialog.showMessageBox(dialogOpts);
            return;
          }
          if (!rendererReady) {
            pendingInstallTool = json;
          } else {
            mainWindow?.webContents.send("install-tool", json);
          }
          return;
        }
        const dialogOpts = {
          type: "error",
          buttons: ["Ok"],
          title: "Install Tool Failed",
          message: "Invalid Format, please check the link and try again.",
        } as MessageBoxOptions;
        dialog.showMessageBox(dialogOpts);
      } catch (error) {
        console.error(error);
        const dialogOpts = {
          type: "error",
          buttons: ["Ok"],
          title: "Install Tool Failed",
          message: "Invalid JSON, please check the link and try again.",
        } as MessageBoxOptions;
        dialog.showMessageBox(dialogOpts);
      }
    } else {
      const dialogOpts = {
        type: "error",
        buttons: ["Ok"],
        title: "Install Tool Failed",
        message: "Invalid base64 data, please check the link and try again.",
      } as MessageBoxOptions;
      dialog.showMessageBox(dialogOpts);
    }
  } else {
    logger.capture(`Invalid deeplink, ${link}`);
  }
};

const openSafeExternal = (url: string) => {
  const logger = Container.inject(Logger).scope("Main:OpenSafeExternal");
  try {
    const parsedUrl = new URL(url);
    const allowedProtocols = ["http:", "https:", "mailto:"];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      logger.warning(`Blocked unsafe protocol: ${parsedUrl.protocol}`);
      return;
    }
    shell.openExternal(url);
  } catch (e) {
    logger.warning("Invalid URL:", url);
  }
};

const handleDeepLinkOnColdStart = () => {
  // windows & linux
  const deepLinkingUrl = process.argv.length > 1 ? process.argv[process.argv.length - 1] : null;
  if (deepLinkingUrl && deepLinkingUrl.startsWith(`${protocol}://`)) {
    app.once("ready", () => {
      onDeepLink(deepLinkingUrl);
    });
  }
  // macOS
  app.on("open-url", (event, url) => {
    event.preventDefault();
    if (app.isReady()) {
      onDeepLink(url);
    } else {
      app.once("ready", () => {
        onDeepLink(url);
      });
    }
  });
};
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    Container.inject(Renderer)
      .focus()
      .catch(() => {
        // ignore
      });
    const link = commandLine.pop();
    if (link) {
      onDeepLink(link);
    }
  });

  app
    .whenReady()
    .then(async () => {
      const logger = Container.inject(Logger).scope("Main:WhenReady");
      const environment = Container.inject(Environment);
      const legacySqliteDatabase = initLegacyDatabase();

      logger.info("User data folder:", environment.userDataFolder);

      Container.inject(EncryptorBridge).expose(ipcMain);
      Container.inject(UpdaterBridge).expose(ipcMain);
      Container.inject(RendererBridge).expose(ipcMain);
      Container.inject(DownloaderBridge).expose(ipcMain);
      Container.inject(SettingsBridge).expose(ipcMain);
      Container.inject(EmbedderBridge).expose(ipcMain);
      Container.inject(DocumentManagerBridge).expose(ipcMain);
      Container.inject(DocumentEmbedderBridge).expose(ipcMain);
      Container.inject(LegacyDataMigratorBridge).expose(ipcMain);
      Container.inject(PromptManagerBridge).expose(ipcMain);

      Container.inject(Embedder)
        .init()
        .catch((error) => {
          logger.error("Failed to init embedder:", error);
        });

      Container.inject(Updater)
        .checkForUpdates()
        .catch((error) => {
          logger.error("Failed to check for updates:", error);
        });

      Container.inject(DocumentEmbedder)
        .init()
        .catch((err) => {
          logger.error("Failed to init document embedder:", err);
        });

      await Container.inject(Database).ready;
      await Container.inject(Renderer).init();

      await Container.inject(LegacyDataMigrator)
        .migrate(legacySqliteDatabase)
        .catch((error) => {
          console.log(error);
        });

      app.on("activate", () => {
        const logger = Container.inject(Logger).scope("Main:AppOnActivate");

        Container.inject(Renderer)
          .focus()
          .catch((error) => {
            logger.error("Failed to focus main window:", error);
          });
      });

      app.on("window-all-closed", () => {
        logger.flush();

        // Respect the OSX convention of having the application in memory even
        // after all windows have been closed
        if (process.platform !== "darwin") {
          app.quit();
          process.exit(0);
        }
      });

      app.on("before-quit", async () => {
        const logger = Container.inject(Logger).scope("Main:AppOnBeforeQuit");
        ipcMain.removeAllListeners();
        try {
          await mcp.close();
        } catch (error) {
          logger.error("Failed to close MCP:", error);
        }
        process.stdin.destroy();
      });

      app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
        // 允许私有证书
        event.preventDefault();
        callback(true);
      });

      logger.track({ event: "launch" });

      const renderer = Container.inject(Renderer);

      mainWindow = renderer.state.window;

      renderer.subscribe((state) => {
        mainWindow = state.window;
      });
    })
    .catch((error) => {
      const logger = Container.inject(Logger).scope("Main:WhenReadyError");

      logger.capture(error, {
        reason: "Failed to initialize main process",
      });

      dialog.showErrorBox(
        "Application Launch Failed",
        [
          "The application could not start correctly.",
          "",
          "Please try restarting the app. If the problem persists,",
          "contact support and provide the error logs.",
        ].join("\n"),
      );

      app.quit();
    });
  handleDeepLinkOnColdStart();
}

// IPCs

ipcMain.on("install-tool-listener-ready", () => {
  rendererReady = true;
  if (pendingInstallTool !== null) {
    mainWindow?.webContents.send("install-tool", pendingInstallTool);
    pendingInstallTool = null;
  }
});

const activeRequests = new Map<string, AbortController>();

ipcMain.handle("request", async (event, options) => {
  const logger = Container.inject(Logger).scope("Main:Request");
  const { url, method, headers, body, proxy, isStream } = options;
  const requestId = Math.random().toString(36).substr(2, 9);
  const abortController = new AbortController();
  activeRequests.set(requestId, abortController);
  try {
    let agent: HttpsProxyAgent<string> | undefined;
    if (proxy) {
      try {
        agent = new HttpsProxyAgent(proxy);
        logger.info(`Using proxy: ${proxy}`);
      } catch (error) {
        logger.error(`Invalid proxy URL: ${proxy}`, error);
      }
    }

    const fetchOptions: any = {
      method,
      headers,
      signal: abortController.signal,
      ...(agent && { agent }),
    };

    if (body && method !== "GET") {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    // activeRequests.delete(requestId);

    if (isStream) {
      const nodeStream = response.body as Readable;

      if (nodeStream) {
        nodeStream.on("data", (chunk: Buffer) => {
          if (!abortController.signal.aborted) {
            event.sender.send("stream-data", requestId, new Uint8Array(chunk));
          }
        });

        nodeStream.on("end", () => {
          event.sender.send("stream-end", requestId);
        });

        nodeStream.on("error", (error) => {
          event.sender.send("stream-error", requestId, error.message);
        });

        abortController.signal.addEventListener("abort", () => {
          if (nodeStream && !nodeStream.destroyed) {
            nodeStream.destroy(new Error("Request cancelled"));
          }
          event.sender.send("stream-end", requestId);
        });
      } else {
        event.sender.send("stream-end", requestId);
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        requestId,
        isStream: true,
      };
    }
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      text,
      requestId,
    };
  } catch (error: unknown) {
    activeRequests.delete(requestId);
    if (error instanceof Error && error.name === "AbortError") {
      logger.info(`Request ${requestId} was cancelled`);
    } else {
      logger.error("Request failed:", error);
    }
    throw error;
  }
});

ipcMain.handle("cancel-request", async (event, requestId: string) => {
  const controller = activeRequests.get(requestId);
  if (controller) {
    console.log(`Cancelling request ${requestId}`);
    controller.abort(); // 真正取消网络请求
    activeRequests.delete(requestId);
    return true;
  }
  console.warn(`Request ${requestId} not found or already completed`);
  return false;
});

ipcMain.on("ipc-5ire", async (event) => {
  event.reply("ipc-5ire", {
    darkMode: nativeTheme.shouldUseDarkColors,
  });
});

ipcMain.on("get-store", (evt, key, defaultValue) => {
  evt.returnValue = store.get(key, defaultValue);
});

ipcMain.on("set-store", (evt, key, val) => {
  store.set(key, val);
  evt.returnValue = val;
});

ipcMain.on("minimize-app", () => {
  mainWindow?.minimize();
});
ipcMain.on("maximize-app", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on("close-app", () => {
  if (mainWindow) {
    mainWindow.destroy();
    mainWindow = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
    process.exit(0);
  }
});

ipcMain.handle("get-protocol", () => {
  return protocol;
});

ipcMain.handle("get-device-info", async () => {
  return {
    arch: os.arch(),
    platform: os.platform(),
    type: os.type(),
  };
});

ipcMain.handle("hmac-sha256-hex", (_, data: string, key: string) => {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("ingest-event", (_, data) => {
  Container.inject(Logger).track({ event: data.app as string });
});

ipcMain.handle("open-external", (_, url) => {
  openSafeExternal(url);
});

ipcMain.handle("get-user-data-path", (_, paths) => {
  if (paths) {
    return path.join(app.getPath("userData"), ...paths);
  }
  return app.getPath("userData");
});

ipcMain.handle("get-system-language", () => {
  return app.getLocale();
});

// eslint-disable-next-line consistent-return
ipcMain.handle("select-knowledge-files", async () => {
  const logger = Container.inject(Logger).scope("Main:SelectKnowledgeFiles");
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Documents",
          extensions: ["doc", "docx", "pdf", "md", "txt", "csv", "pptx", "xlsx"],
        },
      ],
    });
    if (result.filePaths.length > KNOWLEDGE_IMPORT_MAX_FILES) {
      dialog.showErrorBox("Error", `Please not more than ${KNOWLEDGE_IMPORT_MAX_FILES} files a time.`);
      return "[]";
    }
    const files = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const filePath of result.filePaths) {
      // eslint-disable-next-line no-await-in-loop
      const fileType = await getFileType(filePath);
      if (!SUPPORTED_FILE_TYPES[fileType]) {
        dialog.showErrorBox("Error", `Unsupported file type ${fileType} for ${filePath}`);
        return "[]";
      }
      // eslint-disable-next-line no-await-in-loop
      const fileInfo: any = await getFileInfo(filePath);
      if (fileInfo.size > KNOWLEDGE_IMPORT_MAX_FILE_SIZE) {
        dialog.showErrorBox(
          "Error",
          `the size of ${filePath} exceeds the limit (${KNOWLEDGE_IMPORT_MAX_FILE_SIZE / (1024 * 1024)} MB})`,
        );
        return "[]";
      }
      fileInfo.type = fileType;
      files.push(fileInfo);
    }
    logger.debug(files);
    return JSON.stringify(files);
  } catch (err: any) {
    logger.capture(err, {
      reason: "Failed to select knowledge files",
    });
  }
});

// eslint-disable-next-line consistent-return
ipcMain.handle("select-image-with-base64", async () => {
  const logger = Container.inject(Logger).scope("Main:SelectImageWithBase64");
  try {
    const result = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [
        {
          name: "Images",
          extensions: ["jpg", "png", "jpeg"],
        },
      ],
    });
    const filePath = result.filePaths[0];
    const fileType = await getFileType(filePath);
    if (!SUPPORTED_IMAGE_TYPES[fileType]) {
      dialog.showErrorBox("Error", `Unsupported file type ${fileType} for ${filePath}`);
      return null;
    }
    const fileInfo: any = await getFileInfo(filePath);
    if (fileInfo.size > KNOWLEDGE_IMPORT_MAX_FILE_SIZE) {
      dialog.showErrorBox(
        "Error",
        `the size of ${filePath} exceeds the limit (${KNOWLEDGE_IMPORT_MAX_FILE_SIZE / (1024 * 1024)} MB})`,
      );
      return null;
    }
    const blob = fs.readFileSync(filePath);
    const base64 = Buffer.from(blob).toString("base64");
    return JSON.stringify({
      name: fileInfo.name,
      path: filePath,
      size: fileInfo.size,
      type: fileInfo.type,
      base64: `data:image/${fileType};base64,${base64}`,
    });
  } catch (err: any) {
    logger.capture(err, {
      reason: "Failed to select image with base64",
    });
  }
});

/** mcp */
ipcMain.handle("mcp-init", () => {
  const logger = Container.inject(Logger).scope("Main:MCPInit");
  // eslint-disable-next-line promise/catch-or-return
  mcp.init().then(async () => {
    // https://github.com/sindresorhus/fix-path
    logger.info("mcp initialized");
    await mcp.load();
    mainWindow?.webContents.send("mcp-server-loaded", mcp.getClientNames());
  });
});
ipcMain.handle("mcp-add-server", (_, server: IMCPServer) => {
  return mcp.addServer(server);
});
ipcMain.handle("mcp-update-server", (_, server: IMCPServer) => {
  return mcp.updateServer(server);
});
ipcMain.handle("mcp-activate", async (_, server: IMCPServer) => {
  return mcp.activate(server);
});
ipcMain.handle("mcp-deactivate", async (_, clientName: string) => {
  return mcp.deactivate(clientName);
});
ipcMain.handle("mcp-list-tools", async (_, name: string) => {
  const logger = Container.inject(Logger).scope("Main:MCPListTools");
  try {
    return await mcp.listTools(name);
  } catch (error: any) {
    logger.error("Error listing MCP tools:", error);
    return {
      tools: [],
      error: {
        message: error.message || "Unknown error listing tools",
        code: "unexpected_error",
      },
    };
  }
});
ipcMain.handle("mcp-call-tool", async (_, args: { client: string; name: string; args: any; requestId?: string }) => {
  const logger = Container.inject(Logger).scope("Main:MCPCallTool");
  try {
    return await mcp.callTool(args);
  } catch (error: any) {
    logger.error("Error invoking MCP tool:", error);
    return {
      isError: true,
      content: [
        {
          error: error.message || "Unknown error calling tool",
          code: "unexpected_error",
        },
      ],
    };
  }
});
ipcMain.handle("mcp-cancel-tool", (_, requestId: string) => {
  mcp.cancelToolCall(requestId);
});
ipcMain.handle("mcp-list-prompts", async (_, name: string) => {
  const logger = Container.inject(Logger).scope("Main:MCPListPrompts");
  try {
    return await mcp.listPrompts(name);
  } catch (error: any) {
    logger.error("Error listing MCP prompts:", error);
    return {
      prompts: [],
      error: {
        message: error.message || "Unknown error listing prompts",
        code: "unexpected_error",
      },
    };
  }
});

ipcMain.handle("mcp-get-prompt", async (_, args: { client: string; name: string; args?: any }) => {
  const logger = Container.inject(Logger).scope("Main:MCPGetPrompt");
  try {
    return await mcp.getPrompt(args.client, args.name, args.args);
  } catch (error: any) {
    logger.error("Error getting MCP prompt:", error);
    return {
      isError: true,
      content: [
        {
          error: error.message || "Unknown error getting prompt",
          code: "unexpected_error",
        },
      ],
    };
  }
});

ipcMain.handle("mcp-get-config", () => {
  return mcp.getConfig();
});

ipcMain.handle("mcp-put-config", (_, config) => {
  return mcp.putConfig(config);
});
ipcMain.handle("mcp-get-active-servers", () => {
  return mcp.getClientNames();
});

ipcMain.on("show-context-menu", (event, params) => {
  const template = [];
  if (params.type === "chat-folder") {
    template.push({
      label: "Rename",
      click: () => {
        event.sender.send("context-menu-command", "rename-chat-folder", {
          type: "chat-folder",
          id: params.targetId,
        });
      },
    });
    template.push({
      label: "Settings",
      click: () => {
        event.sender.send("context-menu-command", "folder-chat-settings", {
          type: "chat-folder",
          id: params.targetId,
        });
      },
    });
    template.push({
      label: "Delete",
      click: () => {
        event.sender.send("context-menu-command", "delete-chat-folder", {
          type: "chat-folder",
          id: params.targetId,
        });
      },
    });
  } else if (params.type === "chat") {
    template.push({
      label: "Rename",
      click: () => {
        event.sender.send("context-menu-command", "rename-chat", {
          type: "chat",
          id: params.targetId,
        });
      },
    });
    template.push({
      label: "Delete",
      click: () => {
        event.sender.send("context-menu-command", "delete-chat", {
          type: "chat",
          id: params.targetId,
        });
      },
    });
  }
  const menu = Menu.buildFromTemplate(template);
  menu.popup({ window: mainWindow as BrowserWindow, x: params.x, y: params.y });
});

ipcMain.handle("DocumentLoader::loadFromBuffer", (_, buffer, mimeType) => {
  return DocumentLoader.loadFromBuffer(buffer, mimeType);
});
ipcMain.handle("DocumentLoader::loadFromURI", (_, url, mimeType) => {
  return DocumentLoader.loadFromURI(url, mimeType);
});
ipcMain.handle("DocumentLoader::loadFromFilePath", (_, file, mimeType) => {
  return DocumentLoader.loadFromFilePath(file, mimeType);
});

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

if (isDebug) {
  require("electron-debug")();
}

/**
 * Set Dock icon
 */
if (app.dock) {
  const dockIcon = nativeImage.createFromPath(`${__dirname}/build/dockicon.png`);
  app.dock.setIcon(dockIcon);
}

app.setName("5ire");

process.on("uncaughtException", (error) => {
  Container.inject(Logger, false)?.scope("App:UncaughtException").capture(error, {
    reason: "Uncaught Exception",
  });
});

process.on("unhandledRejection", (reason) => {
  Container.inject(Logger, false)?.scope("App:UnhandledRejection").capture(reason, {
    reason: "Unhandled Rejection",
  });
});
