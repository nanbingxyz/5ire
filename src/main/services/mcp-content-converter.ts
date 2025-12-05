import type { BlobResourceContents, ContentBlock, TextResourceContents } from "@modelcontextprotocol/sdk/types.js";
import { Container } from "@/main/internal/container";
import type { Part } from "@/main/model/content-specification";
import { URLParser } from "@/main/services/url-parser";

/**
 * MCP Content Block Converter
 *
 * This class is responsible for converting Model Context Protocol (MCP) content blocks
 * into the internal Part representation used throughout the application.
 */
export class MCPContentConverter {
  #urlParser = Container.inject(URLParser);

  /**
   * Converts an MCP resource URI to an appropriate URL for accessing the resource.
   *
   * When the MCP resource URI is an HTTP URL, it represents a resource on the web.
   * Servers should only use this scheme when clients can directly fetch and load the
   * resource from the web - that is, when clients don't need to read the resource
   * through the MCP server.
   *
   * @see https://modelcontextprotocol.io/specification/2025-06-18/server/resources#common-uri-schemes
   * @param uri - The resource URI returned by the MCP server
   * @param server - The MCP server ID
   */
  #convertResourceURI(uri: string, server: string) {
    try {
      const url = new URL(uri);

      if (url.protocol === "http:" || url.protocol === "https:") {
        return uri;
      }
    } catch {}

    return this.#urlParser.formatExternal(server, uri);
  }

  /**
   * Converts an MCP content block to the internally used generic Part type.
   *
   * @param block - The MCP content block to convert
   * @param serverId - The MCP server ID
   */
  convert(block: ContentBlock, serverId: string) {
    if (block.type === "text") {
      const text: Part.Text = {
        type: "text",
        text: block.text.trim(),
      };
      return text;
    }

    if (block.type === "image") {
      const file: Part.File = {
        type: "file",
        mimetype: block.mimeType,
        content: Buffer.from(block.data, "base64"),
      };

      return file;
    }

    if (block.type === "audio") {
      const file: Part.File = {
        type: "file",
        mimetype: block.mimeType,
        content: Buffer.from(block.data, "base64"),
      };

      return file;
    }

    if (block.type === "resource_link") {
      const ref: Part.Reference = {
        type: "reference",
        url: this.#convertResourceURI(block.uri, serverId),
        title: block.title || block.name,
        mimetype: block.mimeType,
        description: block.description,
      };

      return ref;
    }

    if (block.type === "resource") {
      return this.convertResourceContent(
        block.resource as TextResourceContents | BlobResourceContents,
        serverId,
        block.resource.uri,
      );
    }

    throw new Error(`Unknown content block type: ${block}`);
  }

  /**
   * Converts a resource content to the internally used generic Part type.
   *
   * @param content - The resource content to convert
   * @param serverId - The MCP server ID
   * @param uri - The resource URI
   */
  convertResourceContent(content: TextResourceContents | BlobResourceContents, serverId: string, uri: string) {
    if ("text" in content) {
      const resource: Part.Resource = {
        type: "resource",
        url: this.#convertResourceURI(uri, serverId),
        mimetype: content.mimeType || "text/plain",
        content: (content as TextResourceContents).text,
      };

      return resource;
    }

    const resource: Part.Resource = {
      type: "resource",
      url: this.#convertResourceURI(uri, serverId),
      mimetype: content.mimeType || "application/octet-stream",
      content: Buffer.from((content as BlobResourceContents).blob, "base64"),
    };

    return resource;
  }
}
