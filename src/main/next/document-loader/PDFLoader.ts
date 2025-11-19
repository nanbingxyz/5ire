import { PDFParse } from "pdf-parse";
import type { ContentPart, Loader } from "./DocumentLoader";

/**
 * PDFLoader handles parsing PDF documents and extracting their text content.
 * Implements the Loader interface to provide PDF document processing capabilities.
 */
export class PDFLoader implements Loader {
  /**
   * Loads and parses a PDF document from a binary buffer.
   * Extracts all text content from the PDF and returns it as a single text content part.
   *
   * @param buffer - The PDF document data as a Uint8Array
   * @returns A promise that resolves to an array containing a single text content part
   * @throws Error if the PDF parsing fails
   */
  load = async (buffer: Uint8Array): Promise<ContentPart[]> => {
    try {
      const result = await new PDFParse({ data: buffer }).getText().then(({ text }) => text);

      return [
        {
          type: "text",
          text: result || "",
        },
      ];
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  /**
   * Returns the MIME types supported by this PDF loader.
   * Uses the file extensions mapping to determine supported MIME types.
   *
   * @returns An array of supported MIME type strings
   */
  getSupportedMimeTypes = () => {
    return Object.values(this.getSupportedFileExtensions());
  };

  /**
   * Returns the file extensions and their corresponding MIME types supported by this loader.
   * Currently supports PDF files with the 'application/pdf' MIME type.
   *
   * @returns An object mapping file extensions to their MIME types
   */
  getSupportedFileExtensions = () => {
    return {
      pdf: "application/pdf",
    };
  };
}

export default PDFLoader;
