import { fileURLToPath, format, pathToFileURL } from "node:url";
import { dataUriToBuffer } from "data-uri-to-buffer";
import type { URLDescription } from "@/main/model/url-description";

/**
 * Protocol constants used in URL parsing and formatting
 */
const PROTOCOL = {
  EXTERNAL: "external",
  DOCUMENT: "document",
  DOCUMENT_FRAGMENT: "document+fragment",
  INLINE: "data",
  FILE: "file",
  HTTP: "http",
  HTTPS: "https",
};

/**
 * A utility class for parsing and formatting various types of URLs
 * Supports external, document, file, HTTP, HTTPS, and inline data URLs
 */
export class URLParser {
  #isUUID(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  /**
   * Parses a string URL into a structured URLDescription object
   * @param value - The URL string to parse
   * @returns A URLDescription object representing the parsed URL
   */
  parse(value: string) {
    try {
      const url = new URL(value);

      if (url.protocol === `${PROTOCOL.EXTERNAL}:`) {
        const server = url.hostname;
        const origin = decodeURIComponent(url.searchParams.get("origin") || "");

        if (server && origin) {
          return {
            type: "external",
            server,
            origin,
            url,
          } satisfies URLDescription.External;
        }
      }

      if (url.protocol === `${PROTOCOL.DOCUMENT}:`) {
        const id = url.hostname;
        const name = decodeURIComponent(url.searchParams.get("name") || "");

        if (id && this.#isUUID(id)) {
          return {
            type: "document",
            id,
            url,
            name: name || undefined,
          } satisfies URLDescription.Document;
        }
      }

      if (url.protocol === `${PROTOCOL.DOCUMENT_FRAGMENT}:`) {
        const id = url.hostname;

        if (id && this.#isUUID(id)) {
          return {
            type: "document-fragment",
            id,
            url,
          } satisfies URLDescription.DocumentFragment;
        }
      }

      if (url.protocol === `${PROTOCOL.FILE}:`) {
        const path = fileURLToPath(url, {
          windows: process.platform === "win32",
        });

        if (path) {
          return {
            type: "file",
            path,
            url,
          } satisfies URLDescription.File;
        }
      }

      if (url.protocol === `${PROTOCOL.HTTP}:` || url.protocol === `${PROTOCOL.HTTPS}:`) {
        return {
          type: "http",
          url,
          schema: url.protocol.slice(0, -1) as "http",
        } satisfies URLDescription.HTTP;
      }

      if (url.protocol === `${PROTOCOL.INLINE}:`) {
        const result = dataUriToBuffer(url);

        return {
          type: "inline",
          mimetype: result.typeFull,
          data: Buffer.from(result.buffer),
        } satisfies URLDescription.Inline;
      }
    } catch {}

    return {
      type: "unknown",
      url: value,
    } satisfies URLDescription.Unknown;
  }

  /**
   * Formats a document URL from its components
   * @param id - The document ID
   * @param name - The document name
   * @returns A formatted document URL string
   */
  formatDocument(id: string, name?: string) {
    return format({
      protocol: PROTOCOL.DOCUMENT,
      hostname: id,
      query: {
        name: name ? encodeURIComponent(name) : undefined,
      },
    });
  }

  /**
   * Formats a document fragment URL from its components
   * @param id - The document fragment ID
   * @returns A formatted document fragment URL string
   */
  formatDocumentFragment(id: string) {
    return format({
      protocol: PROTOCOL.DOCUMENT_FRAGMENT,
      hostname: id,
    });
  }

  /**
   * Formats a file URL from its path
   * @param path - The file path
   * @returns A formatted file URL string
   */
  formatFile(path: string) {
    return pathToFileURL(path, { windows: process.platform === "win32" }).toString();
  }

  /**
   * Formats an inline data URL from its components
   * @param payload - The inline data components (excluding type and url)
   * @returns A formatted inline data URL string
   */
  formatInline(payload: Omit<URLDescription.Inline, "type" | "url">) {
    return `data:${payload.mimetype};base64,${Buffer.from(payload.data).toString("base64")}`;
  }

  /**
   * Formats an external URL from its components
   * @param server - The server id
   * @param uri - The original resource URI
   * @returns A formatted external URL string
   */
  formatExternal(server: string, uri: string) {
    return format({
      protocol: PROTOCOL.EXTERNAL,
      hostname: server,
      query: {
        origin: encodeURIComponent(uri),
      },
    });
  }
}
