import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureFile } from "fs-extra";
import { Container } from "@/main/internal/container";
import { Logger } from "@/main/services/logger";

export class Downloader {
  #logger = Container.inject(Logger).scope("Downloader");

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
        logger.capture(error, `Failed to download file: ${options.url}`);

        throw error;
      })
      .finally(() => {
        writer.close();
      });
  }
}

export namespace Downloader {
  export type DownloadOptions = {
    /**
     * Abort signal
     */
    signal?: AbortSignal;
    /**
     * Download URL
     */
    url: string;
    /**
     * Download progress callback
     *
     * @param received - Received bytes
     * @param total - Total bytes, if unknown, set to -1
     */
    onProgress?: (received: number, total: number) => void;
  };
}
