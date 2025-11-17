// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */

import { contextBridge, type IpcRendererEvent, ipcRenderer } from "electron";
import { platform } from "os";
import type { ThemeType } from "types/appearance";
import v8 from "v8";
import type { DocumentEmbedderBridge } from "@/main/bridge/document-embedder-bridge";
import type { DocumentManagerBridge } from "@/main/bridge/document-manager-bridge";
import type { DownloaderBridge } from "@/main/bridge/downloader-bridge";
import type { EmbedderBridge } from "@/main/bridge/embedder-bridge";
import type { EncryptorBridge } from "@/main/bridge/encryptor-bridge";
import type { LegacyDataMigratorBridge } from "@/main/bridge/legacy-data-migrator-bridge";
import type { PromptManagerBridge } from "@/main/bridge/prompt-manager-bridge";
import type { RendererBridge } from "@/main/bridge/renderer-bridge";
import type { SettingsStoreBridge } from "@/main/bridge/settings-store-bridge";
import type { UpdaterBridge } from "@/main/bridge/updater-bridge";
import { BridgeConnector } from "@/main/internal/bridge-connector";
import type { ContentPart as DocumentContentPart } from "./next/document-loader/DocumentLoader";

// Setting the file descriptor limit
if (process.platform !== "win32") {
  process.setFdLimit(4096);
}

// Setting V8 memory limit
v8.setFlagsFromString("--max-old-space-size=4096");

const connector = new BridgeConnector(ipcRenderer);

const BRIDGE = {
  encryptor: connector.connect<EncryptorBridge>("encryptor", {
    encrypt: "async",
    decrypt: "async",
  }),
  updater: connector.connect<UpdaterBridge>("updater", {
    checkForUpdates: "async",
    installNow: "async",
    downloadUpdates: "async",
    cancelDownloadUpdates: "async",
    createStateStream: "stream",
    createEventStream: "stream",
  }),
  downloader: connector.connect<DownloaderBridge>("downloader", {
    download: "stream",
  }),
  embedder: connector.connect<EmbedderBridge>("embedder", {
    removeModel: "async",
    downloadModel: "async",
    cancelDownloadModel: "async",
    createStateStream: "stream",
    createEventStream: "stream",
  }),
  renderer: connector.connect<RendererBridge>("renderer", {
    focus: "async",
    createStateStream: "stream",
  }),
  settingsStore: connector.connect<SettingsStoreBridge>("settings-store", {
    updateLanguage: "async",
    updateTheme: "async",
    updateFontSize: "async",
    createStateStream: "stream",
  }),
  documentManager: connector.connect<DocumentManagerBridge>("document-manager", {
    createCollection: "async",
    deleteCollection: "async",
    updateCollection: "async",
    toggleCollectionPin: "async",
    importDocuments: "async",
    deleteDocument: "async",
    liveCollections: "stream",
    liveDocuments: "stream",
    queryChunks: "async",
    associateCollection: "async",
    disassociateCollection: "async",
    listAssociatedCollections: "async",
  }),
  documentEmbedder: connector.connect<DocumentEmbedderBridge>("document-embedder", {
    createStateStream: "stream",
    createEventStream: "stream",
  }),
  promptManager: connector.connect<PromptManagerBridge>("prompt-manager", {
    createPrompt: "async",
    updatePrompt: "async",
    deletePrompt: "async",
    listPrompts: "async",
  }),
  legacyDataMigrator: connector.connect<LegacyDataMigratorBridge>("legacy-data-migrator", {
    createStateStream: "stream",
  }),
};

contextBridge.exposeInMainWorld("bridge", BRIDGE);

export type ExposedBridge = typeof BRIDGE;

export type Channels =
  | "ipc-5ire"
  | "app-upgrade-start"
  | "app-upgrade-end"
  | "app-upgrade-error"
  | "app-upgrade-not-available"
  | "sign-in"
  | "install-tool"
  | "minimize-app"
  | "maximize-app"
  | "download-started"
  | "download-progress"
  | "download-completed"
  | "download-failed"
  | "knowledge-import-progress"
  | "knowledge-import-success"
  | "get-embedding-model-file-status"
  | "save-embedding-model-file"
  | "remove-embedding-model"
  | "close-app"
  | "mcp-server-loaded"
  | "install-tool-listener-ready"
  | "show-context-menu"
  | "context-menu-command"
  | "stream-data"
  | "stream-end"
  | "stream-error";

const electronHandler = {
  upgrade: () => ipcRenderer.invoke("quit-and-upgrade"),
  request: (options: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
    proxy?: string;
    isStream?: boolean;
  }) => ipcRenderer.invoke("request", options),
  cancelRequest: (requestId: string) => ipcRenderer.invoke("cancel-request", requestId),
  store: {
    get(key: string, defaultValue?: any | undefined): any {
      return ipcRenderer.sendSync("get-store", key, defaultValue);
    },
    set(key: string, val: any) {
      ipcRenderer.sendSync("set-store", key, val);
    },
  },
  mcp: {
    init() {
      return ipcRenderer.invoke("mcp-init");
    },
    addServer(server: any): Promise<boolean> {
      return ipcRenderer.invoke("mcp-add-server", server);
    },
    updateServer(server: any): Promise<boolean> {
      return ipcRenderer.invoke("mcp-update-server", server);
    },
    activate(server: {
      key: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    }): Promise<{ error: any }> {
      return ipcRenderer.invoke("mcp-activate", server);
    },
    deactivated(clientName: string): Promise<{ error: any }> {
      return ipcRenderer.invoke("mcp-deactivate", clientName);
    },
    listTools(name?: string) {
      return ipcRenderer.invoke("mcp-list-tools", name);
    },
    callTool({ client, name, args, requestId }: { client: string; name: string; args: any; requestId?: string }) {
      return ipcRenderer.invoke("mcp-call-tool", {
        client,
        name,
        args,
        requestId,
      });
    },
    cancelToolCall(requestId: string): Promise<void> {
      return ipcRenderer.invoke("mcp-cancel-tool", requestId);
    },
    listPrompts(name?: string) {
      return ipcRenderer.invoke("mcp-list-prompts", name);
    },
    getPrompt({ client, name, args }: { client: string; name: string; args?: any }): Promise<any> {
      return ipcRenderer.invoke("mcp-get-prompt", { client, name, args });
    },
    getConfig(): Promise<any> {
      return ipcRenderer.invoke("mcp-get-config");
    },
    putConfig(config: any): Promise<boolean> {
      return ipcRenderer.invoke("mcp-put-config", config);
    },
    getActiveServers(): Promise<string[]> {
      return ipcRenderer.invoke("mcp-get-active-servers");
    },
  },
  crypto: {
    encrypt: BRIDGE.encryptor.encrypt,
    decrypt: BRIDGE.encryptor.decrypt,
  },
  openExternal(url: string) {
    return ipcRenderer.invoke("open-external", url);
  },
  getUserDataPath(paths?: string[]) {
    return ipcRenderer.invoke("get-user-data-path", paths);
  },
  db: {
    all<T>(sql: string, params: any | undefined = undefined): Promise<T[]> {
      return ipcRenderer.invoke("db-all", { sql, params });
    },
    get<T>(sql: string, id: any): Promise<T> {
      return ipcRenderer.invoke("db-get", { sql, id });
    },
    run(sql: string, params: any): Promise<boolean> {
      return ipcRenderer.invoke("db-run", { sql, params });
    },
    transaction(tasks: { sql: string; params: any[] }[]): Promise<boolean> {
      return ipcRenderer.invoke("db-transaction", tasks);
    },
  },
  getProtocol: () => ipcRenderer.invoke("get-protocol"),
  getDeviceInfo: () => ipcRenderer.invoke("get-device-info"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getSystemLanguage: () => ipcRenderer.invoke("get-system-language"),
  selectImageWithBase64: () => ipcRenderer.invoke("select-image-with-base64"),
  setTheme: (theme: ThemeType) => ipcRenderer.send("theme-changed", theme),
  embeddings: {
    getModelFileStatus: () => ipcRenderer.invoke("get-embedding-model-file-status"),
    removeModel: () => ipcRenderer.invoke("remove-embedding-model"),
    saveModelFile: (fileName: string, filePath: string) =>
      ipcRenderer.invoke("save-embedding-model-file", fileName, filePath),
  },
  knowledge: {
    selectFiles: () => ipcRenderer.invoke("select-knowledge-files"),
    importFile: ({
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
    }) =>
      ipcRenderer.invoke("import-knowledge-file", {
        file,
        collectionId,
      }),
    search: (collectionIds: string[], query: string) => ipcRenderer.invoke("search-knowledge", collectionIds, query),
    removeFile: (fileId: string) => ipcRenderer.invoke("remove-knowledge-file", fileId),
    removeCollection: (collectionId: string) => ipcRenderer.invoke("remove-knowledge-collection", collectionId),
    getChunk: (id: string) => ipcRenderer.invoke("get-knowledge-chunk", id),
    close: () => ipcRenderer.invoke("close-knowledge-database"),
  },
  download: (fileName: string, url: string) => ipcRenderer.invoke("download", fileName, url),
  cancelDownload: (fileName: string) => ipcRenderer.invoke("cancel-download", fileName),
  ingestEvent: (data: any) => ipcRenderer.invoke("ingest-event", data),
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => {
        func(...args);
      };
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    unsubscribe(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.removeListener(channel, func as any);
    },
    unsubscribeAll(channel: Channels) {
      ipcRenderer.removeAllListeners(channel);
    },
  },
  platform: platform(),
  document: {
    /**
     * @deprecated This method is temporary and will be removed in a future version.
     */
    loadFromBuffer: (buffer: Uint8Array, fileType: string) => {
      return ipcRenderer.invoke("load-document-buffer", buffer, fileType);
    },
  },
  documentLoader: {
    loadFromBuffer: (buffer: Uint8Array, mimeType?: string) => {
      return ipcRenderer.invoke("DocumentLoader::loadFromBuffer", buffer, mimeType) as Promise<DocumentContentPart[]>;
    },
    loadFromURI: (url: string, mimeType?: string) => {
      return ipcRenderer.invoke("DocumentLoader::loadFromURI", url, mimeType) as Promise<DocumentContentPart[]>;
    },
    loadFromFilePath: (file: string, mimeType?: string) => {
      return ipcRenderer.invoke("DocumentLoader::loadFromFilePath", file, mimeType) as Promise<DocumentContentPart[]>;
    },
  },
};

contextBridge.exposeInMainWorld("electron", electronHandler);

const envVars = {
  SUPA_PROJECT_ID: process.env.SUPA_PROJECT_ID,
  SUPA_KEY: process.env.SUPA_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NODE_ENV: process.env.NODE_ENV,
};
contextBridge.exposeInMainWorld("envVars", envVars);

export type ElectronHandler = typeof electronHandler;
export type EnvVars = typeof envVars;
