/* eslint global-require: off, no-console: off, promise/always-return: off */
// import 'v8-compile-cache';
import os, { version } from 'node:os';
import fs from 'node:fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  app,
  dialog,
  nativeImage,
  BrowserWindow,
  shell,
  ipcMain,
  nativeTheme,
} from 'electron';
import crypto from 'crypto';
import { Deeplink } from 'electron-deeplink';
import Store from 'electron-store';
import * as logging from './logging';
import axiom from '../vendors/axiom';
import MenuBuilder from './menu';
import { getFileInfo, getFileType, resolveHtmlPath } from './util';
import './sqlite';
import Downloader from './downloader';
import { Embedder } from './embedder';
import initCrashReporter from '../CrashReporter';
import { encrypt, decrypt } from './crypt';
import ModuleContext from './mcp';
import Knowledge from './knowledge';
import {
  SUPPORTED_FILE_TYPES,
  MAX_FILE_SIZE,
  SUPPORTED_IMAGE_TYPES,
} from '../consts';

dotenv.config({
  path: app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.resolve(process.cwd(), '.env'),
});

logging.init();

logging.info('Main process start...');

/**
 * 每次打开一个协议 URL，系统都会启动一个新的应用，需要应用自己去判断，把 URL 当做参数传给已有的应用，还是自己直接处理
 * 获取单实例锁
 */
/**
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果获取失败，说明已经有实例在运行了，直接退出
  app.quit();
}
*/

const mcp = new ModuleContext();
const store = new Store();

let downloader: Downloader;
let mainWindow: BrowserWindow | null = null;
const protocol = app.isPackaged ? 'app.5ire' : 'app.5ire.dev';

// IPCs
ipcMain.on('ipc-5ire', async (event) => {
  event.reply('ipc-5ire', {
    darkMode: nativeTheme.shouldUseDarkColors,
  });
});

ipcMain.on('get-store', (evt, key, defaultValue) => {
  evt.returnValue = store.get(key, defaultValue);
});

ipcMain.on('set-store', (evt, key, val) => {
  store.set(key, val);
  evt.returnValue = val;
});

ipcMain.on('minimize-app', () => {
  mainWindow?.minimize();
});
ipcMain.on('maximize-app', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow?.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('close-app', () => {
  mainWindow?.close();
});

ipcMain.handle('encrypt', (_event, text: string, key: string) => {
  return encrypt(text, key);
});

ipcMain.handle(
  'decrypt',
  (_event, encrypted: string, key: string, iv: string) => {
    return decrypt(encrypted, key, iv);
  },
);

ipcMain.handle('get-protocol', () => {
  return protocol;
});

ipcMain.handle('get-device-info', async () => {
  return {
    arch: os.arch(),
    platform: os.platform(),
    type: os.type(),
  };
});

ipcMain.handle('hmac-sha256-hex', (_, data: string, key: string) => {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('ingest-event', (_, data) => {
  axiom.ingest(data);
});

ipcMain.handle('open-external', (_, data) => {
  shell.openExternal(data);
});

ipcMain.handle('get-user-data-path', (_, paths) => {
  if (paths) {
    return path.join(app.getPath('userData'), ...paths);
  }
  return app.getPath('userData');
});

ipcMain.handle('set-native-theme', (_, theme: 'light' | 'dark' | 'system') => {
  nativeTheme.themeSource = theme;
});

ipcMain.handle('get-native-theme', () => {
  if (nativeTheme.themeSource === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return nativeTheme.themeSource;
});

ipcMain.handle('get-system-language', () => {
  return app.getLocale();
});

ipcMain.handle('get-embedding-model-file-status', () => {
  return Embedder.getFileStatus();
});
ipcMain.handle('remove-embedding-model', () => {
  Embedder.removeModel();
});
ipcMain.handle(
  'save-embedding-model-file',
  (_, fileName: string, filePath: string) => {
    Embedder.saveModelFile(fileName, filePath);
  },
);

ipcMain.handle(
  'import-knowledge-file',
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
        mainWindow?.webContents.send(
          'knowledge-import-progress',
          filePath,
          total,
          done,
        );
      },
      onSuccess: (data: any) => {
        mainWindow?.webContents.send('knowledge-import-success', data);
      },
    });
  },
);

ipcMain.handle('select-knowledge-files', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Documents',
          extensions: [
            'doc',
            'docx',
            'pdf',
            'md',
            'txt',
            'csv',
            'pptx',
            'xlsx',
          ],
        },
      ],
    });
    if (result.filePaths.length > 20) {
      dialog.showErrorBox('Error', 'Please not more than 20 files a time.');
      return '[]';
    }
    const files = [];
    for (const filePath of result.filePaths) {
      const fileType = await getFileType(filePath);
      if (!SUPPORTED_FILE_TYPES[fileType]) {
        dialog.showErrorBox(
          'Error',
          `Unsupported file type ${fileType} for ${filePath}`,
        );
        return '[]';
      }
      const fileInfo: any = await getFileInfo(filePath);
      if (fileInfo.size > MAX_FILE_SIZE) {
        dialog.showErrorBox(
          'Error',
          `the size of ${filePath} exceeds the limit (${MAX_FILE_SIZE / (1024 * 1024)
          } MB})`,
        );
        return '[]';
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

ipcMain.handle('select-image-with-base64', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: ['jpg', 'png', 'jpeg'],
        },
      ],
    });
    const filePath = result.filePaths[0];
    const fileType = await getFileType(filePath);
    if (!SUPPORTED_IMAGE_TYPES[fileType]) {
      dialog.showErrorBox(
        'Error',
        `Unsupported file type ${fileType} for ${filePath}`,
      );
      return null;
    }
    const fileInfo: any = await getFileInfo(filePath);
    if (fileInfo.size > MAX_FILE_SIZE) {
      dialog.showErrorBox(
        'Error',
        `the size of ${filePath} exceeds the limit (${MAX_FILE_SIZE / (1024 * 1024)
        } MB})`,
      );
      return null;
    }
    const blob = fs.readFileSync(filePath);
    const base64 = Buffer.from(blob).toString('base64');
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

ipcMain.handle(
  'search-knowledge',
  async (_, collectionIds: string[], query: string) => {
    const result = await Knowledge.search(collectionIds, query, { limit: 4 });
    return JSON.stringify(result);
  },
);
ipcMain.handle('remove-knowledge-file', async (_, fileId: string) => {
  return await Knowledge.remove({ fileId });
});
ipcMain.handle(
  'remove-knowledge-collection',
  async (_, collectionId: string) => {
    return await Knowledge.remove({ collectionId });
  },
);
ipcMain.handle('get-knowledge-chunk', async (_, chunkId: string) => {
  return await Knowledge.getChunk(chunkId);
});
ipcMain.handle('download', (_, fileName: string, url: string) => {
  downloader.download(fileName, url);
});
ipcMain.handle('cancel-download', (_, fileName: string) => {
  downloader.cancel(fileName);
});

/** mcp */
ipcMain.handle('mcp-init', async () => {
  mcp.init().then(async () => {
    // https://github.com/sindresorhus/fix-path
    logging.info('mcp initialized');
    await mcp.load();
    mainWindow?.webContents.send('mcp-server-loaded', mcp.getClientNames());
  });
});
ipcMain.handle('mcp-add-server', async (_, config) => {
  return await mcp.addServer(config);
});
ipcMain.handle('mcp-update-server', async (_, config) => {
  return await mcp.updateServer(config);
});

ipcMain.handle('mcp-activate', async (_, config) => {
  return await mcp.activate(config);
});
ipcMain.handle('mcp-deactivate', async (_, clientName: string) => {
  return await mcp.deactivate(clientName);
});
ipcMain.handle('mcp-list-tools', async (_, name: string) => {
  return await mcp.listTools(name);
});
ipcMain.handle(
  'mcp-call-tool',
  async (_, args: { client: string; name: string; args: any }) => {
    return await mcp.callTool(args);
  },
);
ipcMain.handle('mcp-get-config', async () => {
  return await mcp.getConfig();
});

ipcMain.handle('mcp-put-config', async (_, config) => {
  return await mcp.putConfig(config);
});
ipcMain.handle('mcp-get-active-servers', () => {
  return mcp.getClientNames();
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(logging.info);
};

const createWindow = async () => {
  if (isDebug) {
    // await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    minWidth: 468,
    minHeight: 600,
    frame: false,
    autoHideMenuBar: true,
    // trafficLightPosition: { x: 15, y: 18 },
    icon: getAssetPath('icon.png'),
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', async () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    mainWindow.show();
    const fixPath = (await import('fix-path')).default;
    fixPath();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  nativeTheme.on('updated', () => {
    if (mainWindow) {
      mainWindow.webContents.send(
        'native-theme-change',
        nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
      );
    }
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((evt: any) => {
    shell.openExternal(evt.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.once('did-fail-load', () => {
    setTimeout(() => {
      mainWindow?.reload();
    }, 1000);
  });

  downloader = new Downloader(mainWindow, {
    onStart: (fileName: string) => {
      mainWindow?.webContents.send('download-started', fileName);
    },
    onCompleted: (fileName: string, savePath: string) => {
      mainWindow?.webContents.send('download-completed', fileName, savePath);
    },
    onFailed: (fileName: string, savePath: string, state: string) => {
      mainWindow?.webContents.send(
        'download-failed',
        fileName,
        savePath,
        state,
      );
    },
    onProgress: (fileName: string, progress: number) => {
      mainWindow?.webContents.send('download-progress', fileName, progress);
    },
  });
};

/**
 * Set Dock icon
 */
if (app.dock) {
  const dockIcon = nativeImage.createFromPath(
    `${app.getAppPath()}/assets/dockicon.png`,
  );
  app.dock.setIcon(dockIcon);
}

app.setName('5ire');

app
  .whenReady()
  .then(async () => {
    createWindow();
    // Remove this if your app does not use auto updates
    // eslint-disable-next-line
    new AppUpdater();

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });

    app.on('will-finish-launching', () => {
      initCrashReporter();
    });

    app.on('window-all-closed', () => {
      // Respect the OSX convention of having the application in memory even
      // after all windows have been closed
      if (process.platform !== 'darwin') {
        app.quit();
      }
      axiom.flush();
    });

    app.on('before-quit', () => {
      ipcMain.removeAllListeners();
      mcp.close();
    });

    app.on(
      'certificate-error',
      (event, _webContents, _url, _error, _certificate, callback) => {
        // 允许私有证书
        event.preventDefault();
        callback(true);
      },
    );
    axiom.ingest([{ app: 'launch' }]);
  })
  .catch(logging.captureException);

/**
 * Register deeplink
 * 只能放在最外层，on才能接受到事件。（createWindow中注册无法接受到事件）
 * 待观察
 */

logging.info(`Registering protocol:`, protocol);
const deeplink = new Deeplink({
  app,
  // @ts-ignore 虽然这时mainWindow为null,但由于是传入的引用，调用时已实例化
  mainWindow,
  protocol,
  isDev: isDebug,
  debugLogging: isDebug,
});
deeplink.on('received', (link: string) => {
  const { host, hash } = new URL(link);
  if (host === 'login-callback') {
    const params = new URLSearchParams(hash.substring(1));
    mainWindow?.webContents.send('sign-in', {
      accessToken: params.get('access_token'),
      refreshToken: params.get('refresh_token'),
    });
  } else {
    logging.captureException(`Invalid deeplink, ${link}`);
  }
});

process.on('uncaughtException', (error) => {
  logging.captureException(error);
});

process.on('unhandledRejection', (reason: any, promise) => {
  logging.captureException(reason);
});
