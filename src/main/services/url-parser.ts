import { fileURLToPath, format, pathToFileURL } from "node:url";
import { dataUriToBuffer } from "data-uri-to-buffer";
import type { URLDescription } from "@/main/model/url-description";

/**
 * Protocol constants used in URL parsing and formatting
 */
const PROTOCOL = {
  EXTERNAL: "external",
  DOCUMENT: "document",
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
        const chunk = url.searchParams.get("chunk") ?? undefined;

        if (id && chunk) {
          return {
            type: "document",
            id,
            chunk,
            url,
          } satisfies URLDescription.Document;
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
   * @param payload - The document URL components (excluding type and url)
   * @returns A formatted document URL string
   */
  formatDocument(payload: Omit<URLDescription.Document, "type" | "url">) {
    return format({
      protocol: PROTOCOL.DOCUMENT,
      hostname: payload.id,
      query: {
        chunk: payload.chunk,
      },
    });
  }

  /**
   * Formats a file URL from its path
   * @param payload - The file path (excluding type and url)
   * @returns A formatted file URL string
   */
  formatFile(payload: Omit<URLDescription.File, "type" | "url">) {
    return pathToFileURL(payload.path, {
      windows: process.platform === "win32",
    }).toString();
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
   * @param payload - The external URL components (excluding type and url)
   * @returns A formatted external URL string
   */
  formatExternal(payload: Omit<URLDescription.External, "type" | "url">) {
    return format({
      protocol: PROTOCOL.EXTERNAL,
      hostname: payload.server,
      query: {
        origin: encodeURIComponent(payload.origin),
      },
    });
  }
}
