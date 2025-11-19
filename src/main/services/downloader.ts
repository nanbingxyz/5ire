import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureFile } from "fs-extra";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

/**
 * Downloader class handles file downloading functionality
 * Supports progress tracking, interruption control, and file integrity verification
 */
export class Downloader {
  #logger = Container.inject(Logger).scope("Downloader");

  /**
   * Downloads a file from the specified URL
   * @param options Download options including URL, interrupt signal, and progress callback
   * @returns Promise<Downloader.DownloadedFile> Information about the downloaded file
   * @throws Error when download fails or is interrupted
   */
  async download(options: Downloader.DownloadOptions) {
    const logger = this.#logger.scope("Download");

    logger.info(`Downloading ${options.url}`);

    const id = crypto.randomUUID();
    const dist = join(tmpdir(), id);
    const writer = createWriteStream(dist);
    const hash = createHash("sha512");

    await ensureFile(dist);

    let size = -1;

    if (options.signal?.aborted) {
      throw new Error(`Aborted`);
    }

    try {
      await fetch(options.url, { method: "HEAD", signal: options.signal }).then((response) => {
        if (!response.ok) {
          return;
        }

        const header = response.headers.get("content-length");

        if (header) {
          size = parseInt(header, 10);
        }
      });
    } catch {}

    return fetch(options.url, { signal: options.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to download ${options.url}`);
        }

        if (!response.body) {
          throw new Error(`Failed to download ${options.url}`);
        }

        const header = response.headers.get("content-length");

        if (header) {
          size = parseInt(header, 10);
        }

        if (!Number.isSafeInteger(size)) {
          size = -1;
        }

        return response.body.getReader();
      })
      .then(async (reader) => {
        let received = 0;

        while (true) {
          const next = await reader.read();

          if (next.done) {
            if (size < 0) {
              options.onProgress?.(received, received);
            }

            break;
          }

          writer.write(next.value);
          hash.update(next.value);

          received += next.value.length;

          options.onProgress?.(received, size);
        }

        logger.info(`Downloaded ${options.url}`);

        return {
          id,
          dist,
          hash: hash.digest("hex"),
        };
      })
      .catch((error) => {
        if (!options.signal?.aborted) {
          logger.capture(error, {
            reason: `Failed to download file: ${options.url}`,
          });
        }

        throw error;
      })
      .finally(() => {
        writer.close();
      });
  }
}

export namespace Downloader {
  /**
   * Download options configuration
   * Defines various configurable parameters in the download process
   */
  export type DownloadOptions = {
    /**
     * Interrupt signal
     * Used to cancel ongoing download operations
     */
    signal?: AbortSignal;
    /**
     * Download URL
     * The complete URL address of the file to be downloaded
     */
    url: string;
    /**
     * Download progress callback function
     * Called periodically during the download process to report progress
     * @param received - Number of bytes received
     * @param total - Total number of bytes, or -1 if unknown
     */
    onProgress?: (received: number, total: number) => void;
  };
}
