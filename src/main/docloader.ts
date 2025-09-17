/* eslint-disable max-classes-per-file */
import fs from 'fs';
import path from 'node:path';
import pdf from 'pdf-parse';
import officeParser from 'officeparser';
import { app } from 'electron';
import * as logging from './logging';

/**
 * Abstract base class for document loaders
 * Provides a common interface for loading different types of documents
 */
abstract class BaseLoader {
  /**
   * Reads the content of a file at the specified path
   * @param {string} filePath - The path to the file to read
   * @returns {Promise<string>} A promise that resolves to the file content as a string
   */
  protected abstract read(filePath: string): Promise<string>;

  /**
   * Loads a document by delegating to the read method
   * @param {string} filePath - The path to the file to load
   * @returns {Promise<string>} A promise that resolves to the loaded document content
   */
  async load(filePath: string): Promise<string> {
    return this.read(filePath);
  }
}

/**
 * Loader for plain text documents (txt, md, csv files)
 * Reads files using UTF-8 encoding
 */
class TextDocumentLoader extends BaseLoader {
  /**
   * Reads a text file and returns its content as a UTF-8 string
   * @param {fs.PathLike} filePath - The path to the text file
   * @returns {Promise<string>} A promise that resolves to the file content
   */
  async read(filePath: fs.PathLike): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }
}

/**
 * Loader for Microsoft Office documents (docx, pptx, xlsx files)
 * Uses the officeparser library to extract text content
 */
class OfficeLoader extends BaseLoader {
  /**
   * Parses an Office document and extracts its text content
   * @param {string} filePath - The path to the Office document
   * @returns {Promise<string>} A promise that resolves to the extracted text content
   */
  async read(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      officeParser.parseOffice(filePath, (text: string, error: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(text);
        }
      });
    });
  }
}

/**
 * Loader for PDF documents
 * Uses the pdf-parse library to extract text content from PDF files
 */
class PdfLoader extends BaseLoader {
  /**
   * Reads a PDF file and extracts its text content
   * @param {fs.PathLike} filePath - The path to the PDF file
   * @returns {Promise<string>} A promise that resolves to the extracted text content
   */
  async read(filePath: fs.PathLike): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }
}

/**
 * Loads a document from a file path based on the file type
 * Automatically selects the appropriate loader and processes the content
 * @param {string} filePath - The path to the document file
 * @param {string} fileType - The file extension/type (txt, md, csv, pdf, docx, pptx, xlsx)
 * @returns {Promise<string>} A promise that resolves to the processed document content
 * @throws {Error} When an unsupported file type is provided
 */
export async function loadDocument(
  filePath: string,
  fileType: string,
): Promise<string> {
  logging.info(`load file from  ${filePath} on ${process.platform}`);
  let Loader: new () => BaseLoader;
  switch (fileType) {
    case 'txt':
      Loader = TextDocumentLoader;
      break;
    case 'md':
      Loader = TextDocumentLoader;
      break;
    case 'csv':
      Loader = TextDocumentLoader;
      break;
    case 'pdf':
      Loader = PdfLoader;
      break;
    case 'docx':
      Loader = OfficeLoader;
      break;
    case 'pptx':
      Loader = OfficeLoader;
      break;
    case 'xlsx':
      Loader = OfficeLoader;
      break;
    default:
      throw new Error(`Miss Loader for: ${fileType}`);
  }
  const loader = new Loader();
  let result = await loader.load(filePath);
  result = result.replace(/ +/g, ' ');
  const paragraphs = result
    .split(/\r?\n\r?\n/)
    .map((i) => i.replace(/\s+/g, ' '))
    .filter((i) => i.trim() !== '');
  return paragraphs.join('\r\n\r\n');
}

/**
 * Loads a document from a buffer by writing it to a temporary file
 * Creates a temporary file in the system temp directory and loads it using loadDocument
 * @param {Uint8Array} buffer - The document content as a byte array
 * @param {string} fileType - The file extension/type to determine the appropriate loader
 * @returns {Promise<string>} A promise that resolves to the processed document content
 */
export const loadDocumentFromBuffer = (
  buffer: Uint8Array,
  fileType: string,
) => {
  const filePath = path.resolve(app.getPath('temp'), crypto.randomUUID());
  fs.writeFileSync(filePath, buffer);
  return loadDocument(filePath, fileType);
};

export default loadDocument;
