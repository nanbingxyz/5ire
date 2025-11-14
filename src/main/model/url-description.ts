/**
 * Metadata descriptions for some known, processable URLs
 */
export type URLDescription =
  | URLDescription.HTTP
  | URLDescription.File
  | URLDescription.Inline
  | URLDescription.External
  | URLDescription.Document
  | URLDescription.Unknown;

export namespace URLDescription {
  /**
   * Describes an HTTP URL
   */
  export type HTTP = {
    /**
     * Type; fixed as "http"; identifies this as an HTTP URL
     */
    type: "http";
    /**
     * Protocol of the URL; can be http or https
     */
    schema: "http" | "https";
    /**
     * URL
     */
    url: URL;
  };

  /**
   * Describes a file URL
   */
  export type File = {
    /**
     * Type; fixed as "file"; identifies this as a file URL
     */
    type: "file";
    /**
     * File path
     */
    path: string;
    /**
     * URL object
     */
    url: URL;
  };

  /**
   * Describes an inline data URL
   */
  export type Inline = {
    /**
     * Type; fixed as "inline"; identifies this as an inline data URL
     */
    type: "inline";
    /**
     * Media type of the inline data
     */
    mimetype: string;
    /**
     * Inline data
     */
    data: Uint8Array;
  };

  /**
   * Describes a resource URL; points to a resource in an MCP
   */
  export type External = {
    /**
     * Type; fixed as "external"; identifies this as an MCP resource URL
     */
    type: "external";
    /**
     * Original resource URL; is the complete resource URL returned by MCP
     */
    origin: string;
    /**
     * MCP service ID to which the resource belongs
     */
    server: string;
    /**
     * URL object
     */
    url: URL;
  };

  /**
   * Describes a document URL; points to a document or document fragment in a knowledge base
   */
  export type Document = {
    /**
     * Type; fixed as "document"; identifies this as a document URL
     */
    type: "document";
    /**
     * Knowledge base document ID
     */
    id: string;
    /**
     * Document fragment ID; if present, indicates that the URL points to a document fragment;
     * otherwise, indicates that the URL points to the entire document
     */
    chunk?: string;
    /**
     * URL object
     */
    url: URL;
  };

  /**
   * Describes an unknown URL; may refer to a URL that cannot be parsed or whose protocol is unrecognized
   */
  export type Unknown = {
    /**
     * Type; fixed as "unknown"; identifies this as an unknown URL
     */
    type: "unknown";
    /**
     * URL
     */
    url: string;
  };
}
