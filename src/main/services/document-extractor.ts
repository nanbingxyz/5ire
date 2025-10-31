import { fileURLToPath } from "node:url";
import { fromBuffer } from "file-type";
import { readFile, stat } from "fs-extra";
import { parseOffice } from "officeparser";
import { default as parsePDF } from "pdf-parse";
import { MAX_DOCUMENT_SIZE, SUPPORTED_DOCUMENT_MIMETYPES } from "@/main/constants";
import { smartChunk } from "@/main/util";

export class DocumentExtractor {
  async #read(url: string) {
    const path = fileURLToPath(url);
    const stats = await stat(path).catch(() => {
      throw new Error(`Failed to load resource: ${url}`);
    });

    if (!stats.isFile()) {
      throw new Error(`Not a file: ${url}`);
    }

    if (stats.size > MAX_DOCUMENT_SIZE) {
      throw new Error(`File is too large: ${url}`);
    }

    const buffer = await readFile(path);
    const type = await fromBuffer(buffer);

    if (!type) {
      // if is utf-8 encoding, try to decode as utf-8

      throw new Error(`Failed to detect file type: ${url}`);
    }

    // @ts-expect-error
    if (!SUPPORTED_DOCUMENT_MIMETYPES.includes(type)) {
      throw new Error(`Unsupported file type: ${type}`);
    }

    return {
      mimetype: type as unknown as DocumentExtractor.Mimetype,
      buffer,
    };
  }

  async #parse(buffer: Buffer, mimetype: DocumentExtractor.Mimetype) {
    switch (mimetype) {
      case "text":
        return buffer.toString("utf8");
      case "application/pdf":
        // @ts-expect-error
        return parsePDF(buffer, {}).then((result) => result.text);
      default:
        return new Promise<string>((resolve, reject) => {
          parseOffice(buffer, (text: string, error: unknown) => {
            if (error) {
              return reject(error);
            }

            resolve(text);
          });
        });
    }
  }

  async #split(text: string) {
    return smartChunk(text);
  }

  async extract(url: string) {
    if (url.startsWith("file://")) {
      return this.#read(url).then(({ buffer, mimetype }) => {
        return this.#parse(buffer, mimetype).then(this.#split);
      });
    }
    // else if (url.startsWith("http://") || url.startsWith("https://")) {
    //
    // }
    else {
      throw new Error(`Unsupported document URL: ${url}`);
    }
  }
}

export namespace DocumentExtractor {
  export type Mimetype = (typeof SUPPORTED_DOCUMENT_MIMETYPES)[number] | "text";
}
