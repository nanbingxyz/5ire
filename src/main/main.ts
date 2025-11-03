/* eslint global-require: off, no-console: off, promise/always-return: off */
// import 'v8-compile-cache';

import fs from "node:fs";
import os from "node:os";
import { join, resolve } from "node:path";
import type { Readable } from "node:stream";
import crypto from "crypto";
import dotenv from "dotenv";
import {
  app,
  type BrowserWindow,
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
import axiom from "../vendors/axiom";
import * as logging from "./logging";
import { decodeBase64, getFileInfo, getFileType } from "./util";
import "./sqlite";
import { DocumentEmbedderBridge } from "@/main/bridge/document-embedder-bridge";
import { DocumentManagerBridge } from "@/main/bridge/document-manager-bridge";
import { DownloaderBridge } from "@/main/bridge/downloader-bridge";
import { EmbedderBridge } from "@/main/bridge/embedder-bridge";
import { EncryptorBridge } from "@/main/bridge/encryptor-bridge";
import { RendererBridge } from "@/main/bridge/renderer-bridge";
import { SettingsStoreBridge } from "@/main/bridge/settings-store-bridge";
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
import { Logger } from "@/main/services/logger";
import { Renderer } from "@/main/services/renderer";
import { Updater } from "@/main/services/updater";
import { SettingsStore } from "@/main/stories/settings-store";
import initCrashReporter from "../CrashReporter";
import {
  KNOWLEDGE_IMPORT_MAX_FILE_SIZE,
  KNOWLEDGE_IMPORT_MAX_FILES,
  SUPPORTED_FILE_TYPES,
  SUPPORTED_IMAGE_TYPES,
} from "../consts";
import { loadDocumentFromBuffer } from "./docloader";
import Knowledge from "./knowledge";
import ModuleContext from "./mcp";
import { DocumentLoader } from "./next/document-loader/DocumentLoader";

dotenv.config({
  path: app.isPackaged ? path.join(process.resourcesPath, ".env") : path.resolve(process.cwd(), ".env"),
});

Container.singleton(Environment, () => {
  let userDataFolder = app.getPath("userData");

  if (!app.isPackaged) {
    if (process.env.SOURCE_ROOT) {
      userDataFolder = join(app.getPath("userData"), "__DEV__");
    }
  }

  const env: Environment = {
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
  };

  ensureDirSync(env.embedderCacheFolder);
  ensureDirSync(env.embedderModelsFolder);
  ensureDirSync(env.storiesFolder);

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
Container.singleton(SettingsStore, () => new SettingsStore());
Container.singleton(SettingsStoreBridge, () => new SettingsStoreBridge());
Container.singleton(Embedder, () => new Embedder());
Container.singleton(EmbedderBridge, () => new EmbedderBridge());
Container.singleton(Database, () => new Database());
Container.singleton(DocumentManager, () => new DocumentManager());
Container.singleton(DocumentManagerBridge, () => new DocumentManagerBridge());
Container.singleton(DocumentExtractor, () => new DocumentExtractor());
Container.singleton(DocumentEmbedder, () => new DocumentEmbedder());
Container.singleton(DocumentEmbedderBridge, () => new DocumentEmbedderBridge());

logging.init();

logging.info("Main process start...");

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
    logging.captureException(`Invalid deeplink, ${link}`);
  }
};

const openSafeExternal = (url: string) => {
  try {
    const parsedUrl = new URL(url);
    const allowedProtocols = ["http:", "https:", "mailto:"];
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      logging.warn(`Blocked unsafe protocol: ${parsedUrl.protocol}`);
      return;
    }
    shell.openExternal(url);
  } catch (e) {
    logging.warn("Invalid URL:", url);
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
      Container.inject(EncryptorBridge).expose(ipcMain);
      Container.inject(UpdaterBridge).expose(ipcMain);
      Container.inject(RendererBridge).expose(ipcMain);
      Container.inject(DownloaderBridge).expose(ipcMain);
      Container.inject(SettingsStoreBridge).expose(ipcMain);
      Container.inject(EmbedderBridge).expose(ipcMain);
      Container.inject(DocumentManagerBridge).expose(ipcMain);
      Container.inject(DocumentEmbedderBridge).expose(ipcMain);

      Container.inject(Embedder)
        .init()
        .catch(() => {});
      Container.inject(Updater)
        .checkForUpdates()
        .catch(() => {});
      Container.inject(DocumentEmbedder)
        .init()
        .catch(() => {});

      await Container.inject(Database).ready;
      await Container.inject(Renderer).focus();

      app.on("activate", () => {
        Container.inject(Renderer)
          .focus()
          .catch(() => {
            // ignore
          });
      });

      app.on("will-finish-launching", () => {
        initCrashReporter();
      });

      app.on("window-all-closed", () => {
        try {
          axiom.flush();
        } catch (error) {
          logging.error("Failed to flush axiom:", error);
        }
        // Respect the OSX convention of having the application in memory even
        // after all windows have been closed
        if (process.platform !== "darwin") {
          app.quit();
          process.exit(0);
        }
      });

      app.on("before-quit", async () => {
        ipcMain.removeAllListeners();
        try {
          await mcp.close();
        } catch (error) {
          logging.error("Failed to close MCP:", error);
        }
        process.stdin.destroy();
      });

      app.on("certificate-error", (event, _webContents, _url, _error, _certificate, callback) => {
        // 允许私有证书
        event.preventDefault();
        callback(true);
      });
      axiom.ingest([{ app: "launch" }]);
    })
    .catch(logging.captureException);
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
  const { url, method, headers, body, proxy, isStream } = options;
  const requestId = Math.random().toString(36).substr(2, 9);
  const abortController = new AbortController();
  activeRequests.set(requestId, abortController);
  try {
    let agent: HttpsProxyAgent<string> | undefined;
    if (proxy) {
      try {
        agent = new HttpsProxyAgent(proxy);
        logging.info(`Using proxy: ${proxy}`);
      } catch (error) {
        logging.error(`Invalid proxy URL: ${proxy}`, error);
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
      logging.info(`Request ${requestId} was cancelled`);
    } else {
      logging.error("Request failed:", error);
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
  axiom.ingest(data);
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

// ipcMain.handle("get-embedding-model-file-status", () => {
//   return Embedder.getFileStatus();
// });
// ipcMain.handle("remove-embedding-model", () => {
//   Embedder.removeModel();
// });
// ipcMain.handle("save-embedding-model-file", (_, fileName: string, filePath: string) => {
//   Embedder.saveModelFile(fileName, filePath);
// });

ipcMain.handle(
  "import-knowledge-file",
  (
    _,
    {
      file,
      collectionId,
    }: {
      file: {
        id: string;
        path: string;
        name: string;
        size: number;
        type: string;
      };
      collectionId: string;
    },
  ) => {
    Knowledge.importFile({
      file,
      collectionId,
      onProgress: (filePath: string, total: number, done: number) => {
        mainWindow?.webContents.send("knowledge-import-progress", filePath, total, done);
      },
      onSuccess: (data: any) => {
        mainWindow?.webContents.send("knowledge-import-success", data);
      },
    });
  },
);

// eslint-disable-next-line consistent-return
ipcMain.handle("select-knowledge-files", async () => {
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
    logging.debug(files);
    return JSON.stringify(files);
  } catch (err: any) {
    logging.captureException(err);
  }
});

// eslint-disable-next-line consistent-return
ipcMain.handle("select-image-with-base64", async () => {
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
    logging.captureException(err);
  }
});

ipcMain.handle("search-knowledge", async (_, collectionIds: string[], query: string) => {
  const result = await Knowledge.search(collectionIds, query, { limit: 6 });
  return JSON.stringify(result);
});
ipcMain.handle("remove-knowledge-file", (_, fileId: string) => {
  return Knowledge.remove({ fileId });
});
ipcMain.handle("remove-knowledge-collection", (_, collectionId: string) => {
  return Knowledge.remove({ collectionId });
});
ipcMain.handle("get-knowledge-chunk", (_, chunkId: string) => {
  return Knowledge.getChunk(chunkId);
});

/** mcp */
ipcMain.handle("mcp-init", () => {
  // eslint-disable-next-line promise/catch-or-return
  mcp.init().then(async () => {
    // https://github.com/sindresorhus/fix-path
    logging.info("mcp initialized");
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
  try {
    return await mcp.listTools(name);
  } catch (error: any) {
    logging.error("Error listing MCP tools:", error);
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
  try {
    return await mcp.callTool(args);
  } catch (error: any) {
    logging.error("Error invoking MCP tool:", error);
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
  try {
    return await mcp.listPrompts(name);
  } catch (error: any) {
    logging.error("Error listing MCP prompts:", error);
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
  try {
    return await mcp.getPrompt(args.client, args.name, args.args);
  } catch (error: any) {
    logging.error("Error getting MCP prompt:", error);
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

ipcMain.handle("load-document-buffer", (_, buffer: Uint8Array, fileType: string) => {
  return loadDocumentFromBuffer(buffer, fileType);
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

if (process.env.NODE_ENV === "production") {
  const sourceMapSupport = require("source-map-support");
  sourceMapSupport.install();
}

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

if (isDebug) {
  require("electron-debug")();
}

/**
 * Set Dock icon
 */
if (app.dock) {
  const dockIcon = nativeImage.createFromPath(`${app.getAppPath()}/assets/dockicon.png`);
  app.dock.setIcon(dockIcon);
}

app.setName("5ire");

process.on("uncaughtException", (error) => {
  logging.captureException(error);
});

process.on("unhandledRejection", (reason: any) => {
  logging.captureException(reason);
});
