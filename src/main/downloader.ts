import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { app } from 'electron';

/**
 * Manages file downloads in an Electron application with progress tracking and cancellation support
 */
export default class Downloader {
  /** The Electron BrowserWindow instance */
  private win: any;

  /** Map of active downloads indexed by filename */
  private downloads: { [key: string]: any } = {};

  /** Callback function called when a download fails */
  private onFailed: Function | undefined;

  /**
   * Creates a new Downloader instance and sets up download event handlers
   * @param {any} win - The Electron BrowserWindow instance
   * @param {Object} callbacks - Callback functions for download events
   * @param {Function} callbacks.onStart - Called when a download starts with fileName
   * @param {Function} callbacks.onCompleted - Called when a download completes with fileName and savePath
   * @param {Function} callbacks.onFailed - Called when a download fails with fileName, savePath, and state
   * @param {Function} callbacks.onProgress - Called during download progress with fileName and progress ratio
   */
  constructor(
    win: any,
    { onStart, onCompleted, onFailed, onProgress } = {
      onStart: (fileName: string) => {},
      onCompleted: (fileName: string, savePath: string) => {},
      onFailed: (fileName: string, savePath: string, state: string) => {},
      onProgress: (fileName: string, progress: number) => {},
    },
  ) {
    this.win = win;
    this.onFailed = onFailed;

    this.win.webContents.session.on('will-download', (evt: any, item: any) => {
      const fileName = item.getFilename();
      const savePath = path.join(
        app.getPath('userData'),
        'downloads',
        item.getFilename(),
      );
      item.setSavePath(savePath);

      const download = this.downloads[item.getFilename()];
      if (download?.cancelled) {
        delete this.downloads[item.getFilename()];
        item.cancel();
        try {
          fs.unlinkSync(savePath);
        } catch (e) {
          log.error('error deleting file', savePath, e);
        }
        onFailed && onFailed(fileName, savePath, 'cancelled');
        return;
      }
      this.downloads[fileName] = item;
      onStart && onStart(fileName);

      item.on('updated', (_: any, state: string) => {
        if (state === 'progressing') {
          const progress = item.getReceivedBytes() / item.getTotalBytes();
          onProgress && onProgress(fileName, progress);
        }
      });

      item.once('done', (_: Electron.Event, state: string) => {
        log.debug(`Download ${state}`, fileName);
        if (state === 'completed') {
          onCompleted && onCompleted(fileName, savePath);
        } else {
          fs.unlink(savePath, (err) => {
            if (err) {
              log.warn('error deleting file', savePath, err);
            }
          });
          onFailed && onFailed(fileName, savePath, state);
        }
        delete this.downloads[fileName];
      });
    });
  }

  /**
   * Initiates a download from the specified URL
   * @param {string} fileName - The name to use for the downloaded file
   * @param {string} url - The URL to download from
   */
  download(fileName: string, url: string) {
    this.downloads[fileName] = { pending: true };
    this.win.webContents.session.downloadURL(url);
  }

  /**
   * Cancels an active download or marks a pending download for cancellation
   * @param {string} fileName - The name of the file to cancel downloading
   */
  cancel(fileName: string) {
    let item = this.downloads[fileName];
    if (!item) {
      this.downloads[fileName] = item = { pending: true };
    }
    if (!item.pending) {
      log.debug(`Cancelling download ${fileName}`);
      item.cancel();
      delete this.downloads[fileName];
      this.onFailed && this.onFailed(fileName, 'cancelled');
      fs.unlink(item.getSavePath(), (error) => {
        if (error) {
          log.warn('error deleting file', item.getSavePath(), error);
        }
      });
    } else {
      item.cancelled = true;
      log.warn('Download not started yet, set to be cancelled on start');
    }
  }
}
