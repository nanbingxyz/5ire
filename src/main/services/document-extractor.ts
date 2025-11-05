import { fileURLToPath } from "node:url";
import { fromBuffer } from "file-type";
import { readFile, stat } from "fs-extra";
import { parseOffice } from "officeparser";
import { PDFParse } from "pdf-parse";
import { MAX_DOCUMENT_SIZE, SUPPORTED_DOCUMENT_MIMETYPES } from "@/main/constants";
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
    const type = await fromBuffer(buffer);

    if (!type) {
      // if is utf-8 encoding, try to decode as utf-8

      throw new Error(`Failed to detect file type: ${url}`);
    }

    // @ts-expect-error
    if (!SUPPORTED_DOCUMENT_MIMETYPES.includes(type.mime)) {
      throw new Error(`Unsupported file type: ${type.mime}`);
    }

    return {
      mimetype: type.mime as unknown as DocumentExtractor.Mimetype,
      buffer,
    };
  }

  /**
   * Parse document content of the specified type
   * @param buffer Binary data of the document
   * @param mimetype MIME type of the document
   * @returns Promise<string> Parsed text content
   */
  async #parse(buffer: Buffer, mimetype: DocumentExtractor.Mimetype) {
    switch (mimetype) {
      case "text":
        return buffer.toString("utf8");
      case "application/pdf":
        return new PDFParse({ data: buffer }).getText().then(({ text }) => text);
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
   * Supported document MIME types
   * Includes types derived from SUPPORTED_DOCUMENT_MIMETYPES constant and text type
   */
  export type Mimetype = (typeof SUPPORTED_DOCUMENT_MIMETYPES)[number] | "text";

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
    mimetype: Mimetype;
    /**
     * Size of the document in bytes
     */
    size: number;
  };
}
