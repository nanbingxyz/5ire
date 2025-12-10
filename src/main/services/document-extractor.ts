import { fileURLToPath } from "node:url";
import { fileTypeFromBuffer } from "file-type";
import { readFile, stat } from "fs-extra";
import { PDFParse } from "pdf-parse";
import { CanvasFactory } from "pdf-parse/worker";
import {
  COMMON_BINARY_DOCUMENT_FILE_MIMETYPES,
  COMMON_TEXTUAL_FILE_MIMETYPES,
  MAX_DOCUMENT_SIZE,
} from "@/main/constants";
import { smartChunk } from "@/main/util";

/**
 * DocumentExtractor class is used to extract text content from documents in different formats
 * Supports text extraction and chunking processing for PDF, Office documents and other formats
 */
export class DocumentExtractor {
  /**
   * Read the document file at the specified URL
   * @param url Document file URL path (file:// protocol)
   * @returns Promise<DocumentExtractor.Mimetype, Buffer> Promise containing file type and binary data
   * @throws Error when file does not exist, is not a file type, is too large, or file type is not supported
   */
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

    let mimetype = await fileTypeFromBuffer(buffer).then((info) => info?.mime as string | undefined);

    if (!mimetype) {
      const ext = path.split(".").pop()?.toLowerCase();

      if (ext) {
        if (ext in COMMON_TEXTUAL_FILE_MIMETYPES) {
          // @ts-expect-error
          mimetype = COMMON_TEXTUAL_FILE_MIMETYPES[ext];
        }

        if (ext in COMMON_BINARY_DOCUMENT_FILE_MIMETYPES) {
          // @ts-expect-error
          mimetype = COMMON_BINARY_DOCUMENT_FILE_MIMETYPES[ext];
        }
      }
    }

    if (!mimetype) {
      throw new Error(`Failed to detect file type: ${url}`);
    }

    if (
      ![
        ...Object.values(COMMON_TEXTUAL_FILE_MIMETYPES),
        ...Object.values(COMMON_BINARY_DOCUMENT_FILE_MIMETYPES),
      ].includes(mimetype)
    ) {
      throw new Error(`Unsupported file type: ${mimetype}`);
    }

    return {
      mimetype: mimetype,
      buffer,
    };
  }

  /**
   * Parse document content of the specified type
   * @param buffer Binary data of the document
   * @param mimetype MIME type of the document
   * @returns Promise<string> Parsed text content
   */
  async #parse(buffer: Buffer, mimetype: string) {
    if (mimetype === "application/pdf") {
      return import("pdf-parse").then(async (mod) => {
        console.log(PDFParse.setWorker());
        return new mod.PDFParse({ data: buffer, CanvasFactory }).getText().then(({ text }) => text);
      });
    }

    if (Object.values(COMMON_BINARY_DOCUMENT_FILE_MIMETYPES).includes(mimetype)) {
      return import("officeparser").then(async (mod) => {
        return new Promise<string>((resolve, reject) => {
          mod.parseOffice(buffer, (text: string, error: unknown) => {
            if (error) {
              return reject(error);
            }

            resolve(text);
          });
        });
      });
    }

    return buffer.toString("utf8");
  }

  /**
   * Split text content into appropriately sized chunks
   * @param text Text content to be split
   * @returns Promise<string[]> Array of split text chunks
   */
  async #split(text: string) {
    return smartChunk(text);
  }

  /**
   * Extract text content from the specified URL document and perform chunking processing
   * @param url Document file URL path
   * @returns Promise<DocumentExtractor.Result> Object containing extracted texts, mimetype and size
   * @throws Error when URL protocol is not supported
   */
  async extract(url: string) {
    if (url.startsWith("file://")) {
      return this.#read(url).then(async ({ buffer, mimetype }) => {
        return this.#parse(buffer, mimetype)
          .then(this.#split)
          .then((texts) => {
            return {
              texts,
              mimetype,
              size: buffer.length,
            } satisfies DocumentExtractor.Result;
          });
      });
    }
    // TODO: support other protocols
    else {
      throw new Error(`Unsupported document URL: ${url}`);
    }
  }
}

export namespace DocumentExtractor {
  /**
   * Extracted document result
   */
  export type Result = {
    /**
     * Array of extracted text chunks
     */
    texts: string[];
    /**
     * MIME type of the document
     */
    mimetype: string;
    /**
     * Size of the document in bytes
     */
    size: number;
  };
}
