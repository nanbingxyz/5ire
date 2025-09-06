import { basename } from 'node:path';

import type { URILoader, URIResource } from './DocumentLoader';

/**
 * HTTP/HTTPS URI loader implementation that fetches resources from web URLs.
 * Handles network requests and converts HTTP responses into URIResource format.
 */
export class HttpURILoader implements URILoader {
  /**
   * Loads a resource from an HTTP or HTTPS URL.
   * 
   * @param url - The URL object representing the HTTP/HTTPS resource to fetch
   * @returns A promise that resolves to a URIResource containing the response stream and metadata
   * @throws {Error} If the network request fails or returns a non-200 status code
   */
  load = async (url: URL): Promise<URIResource> => {
    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      throw new Error(`Failed to load resource: ${url}`);
    }

    if (response.status !== 200) {
      throw new Error(`Failed to load resource: ${url}`);
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    // If body is null, treat it as an empty stream.
    if (!response.body) {
      return {
        mimeType: 'text/plain',
        size: 0,
        stream: new ReadableStream<Uint8Array>({
          /**
           * Initializes the stream by immediately closing it for empty responses.
           * 
           * @param controller - The ReadableStreamDefaultController to control the stream
           */
          start(controller) {
            controller.close();
          },
        }),
      };
    }

    return {
      mimeType:
        // If the Content-Type is 'application/octet-stream', treat it as unknown
        // and return undefined. Otherwise, use the provided Content-Type if available.
        contentType === 'application/octet-stream'
          ? undefined
          : contentType || undefined,
      fileName: basename(url.pathname),
      size: contentLength ? parseInt(contentLength, 10) : undefined,
      stream: response.body,
    };
  };

  /**
   * Returns the list of URI protocols supported by this loader.
   * 
   * @returns An array containing the supported protocols: 'http' and 'https'
   */
  getSupportedProtocols = () => {
    return ['http', 'https'];
  };
}

export default HttpURILoader;
