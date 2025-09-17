// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */

import v8 from 'v8';
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { platform } from 'os';
import { ThemeType } from 'types/appearance';
import type { ContentPart as DocumentContentPart } from './next/document-loader/DocumentLoader';

// Setting the file descriptor limit
if (process.platform !== 'win32') {
  process.setFdLimit(4096);
}

// Setting V8 memory limit
v8.setFlagsFromString('--max-old-space-size=4096');

/**
 * Available IPC channels for communication between renderer and main processes
 */
export type Channels =
  | 'ipc-5ire'
  | 'app-upgrade-start'
  | 'app-upgrade-end'
  | 'app-upgrade-error'
  | 'app-upgrade-not-available'
  | 'native-theme-change'
  | 'sign-in'
  | 'install-tool'
  | 'minimize-app'
  | 'maximize-app'
  | 'download-started'
  | 'download-progress'
  | 'download-completed'
  | 'download-failed'
  | 'knowledge-import-progress'
  | 'knowledge-import-success'
  | 'get-embedding-model-file-status'
  | 'save-embedding-model-file'
  | 'remove-embedding-model'
  | 'close-app'
  | 'mcp-server-loaded'
  | 'install-tool-listener-ready'
  | 'show-context-menu'
  | 'context-menu-command'
  | 'stream-data'
  | 'stream-end'
  | 'stream-error';

/**
 * Main electron handler object that provides access to main process functionality
 */
const electronHandler = {
  /**
   * Initiates application upgrade process
   * @returns {Promise<void>} Promise that resolves when upgrade starts
   */
  upgrade: () => ipcRenderer.invoke('quit-and-upgrade'),
  
  /**
   * Makes HTTP requests through the main process
   * @param {Object} options - Request configuration
   * @param {string} options.url - Target URL
   * @param {string} options.method - HTTP method
   * @param {Record<string, string>} [options.headers] - Request headers
   * @param {string} [options.body] - Request body
   * @param {string} [options.proxy] - Proxy configuration
   * @param {boolean} [options.isStream] - Whether request is streaming
   * @returns {Promise<any>} Promise resolving to response data
   */
  request: (options: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
    proxy?: string;
    isStream?: boolean;
  }) => ipcRenderer.invoke('request', options),
  
  /**
   * Cancels an ongoing HTTP request
   * @param {string} requestId - ID of request to cancel
   * @returns {Promise<void>} Promise that resolves when request is cancelled
   */
  cancelRequest: (requestId: string) =>
    ipcRenderer.invoke('cancel-request', requestId),
  
  /**
   * Persistent storage interface for application data
   */
  store: {
    /**
     * Retrieves value from persistent storage
     * @param {string} key - Storage key
     * @param {any} [defaultValue] - Default value if key doesn't exist
     * @returns {any} Stored value or default
     */
    get(key: string, defaultValue?: any | undefined): any {
      return ipcRenderer.sendSync('get-store', key, defaultValue);
    },
    
    /**
     * Stores value in persistent storage
     * @param {string} key - Storage key
     * @param {any} val - Value to store
     */
    set(key: string, val: any) {
      ipcRenderer.sendSync('set-store', key, val);
    },
  },
  
  /**
   * Model Context Protocol (MCP) server management interface
   */
  mcp: {
    /**
     * Initializes MCP system
     * @returns {Promise<any>} Promise resolving to initialization result
     */
    init() {
      return ipcRenderer.invoke('mcp-init');
    },
    
    /**
     * Adds new MCP server configuration
     * @param {any} server - Server configuration object
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    addServer(server: any): Promise<boolean> {
      return ipcRenderer.invoke('mcp-add-server', server);
    },
    
    /**
     * Updates existing MCP server configuration
     * @param {any} server - Updated server configuration
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    updateServer(server: any): Promise<boolean> {
      return ipcRenderer.invoke('mcp-update-server', server);
    },
    
    /**
     * Activates MCP server with specified configuration
     * @param {Object} server - Server activation parameters
     * @param {string} server.key - Server identifier key
     * @param {string} [server.command] - Command to execute
     * @param {string[]} [server.args] - Command arguments
     * @param {Record<string, string>} [server.env] - Environment variables
     * @returns {Promise<{error: any}>} Promise resolving to activation result
     */
    activate(server: {
      key: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
    }): Promise<{ error: any }> {
      return ipcRenderer.invoke('mcp-activate', server);
    },
    
    /**
     * Deactivates MCP client by name
     * @param {string} clientName - Name of client to deactivate
     * @returns {Promise<{error: any}>} Promise resolving to deactivation result
     */
    deactivated(clientName: string): Promise<{ error: any }> {
      return ipcRenderer.invoke('mcp-deactivate', clientName);
    },
    
    /**
     * Lists available tools from MCP servers
     * @param {string} [name] - Optional server name filter
     * @returns {Promise<any>} Promise resolving to tools list
     */
    listTools(name?: string) {
      return ipcRenderer.invoke('mcp-list-tools', name);
    },
    
    /**
     * Executes MCP tool with specified parameters
     * @param {Object} params - Tool execution parameters
     * @param {string} params.client - Client identifier
     * @param {string} params.name - Tool name
     * @param {any} params.args - Tool arguments
     * @param {string} [params.requestId] - Optional request identifier
     * @returns {Promise<any>} Promise resolving to tool execution result
     */
    callTool({
      client,
      name,
      args,
      requestId,
    }: {
      client: string;
      name: string;
      args: any;
      requestId?: string;
    }) {
      return ipcRenderer.invoke('mcp-call-tool', {
        client,
        name,
        args,
        requestId,
      });
    },
    
    /**
     * Cancels ongoing tool execution
     * @param {string} requestId - Request identifier to cancel
     * @returns {Promise<void>} Promise that resolves when cancellation completes
     */
    cancelToolCall(requestId: string): Promise<void> {
      return ipcRenderer.invoke('mcp-cancel-tool', requestId);
    },
    
    /**
     * Lists available prompts from MCP servers
     * @param {string} [name] - Optional server name filter
     * @returns {Promise<any>} Promise resolving to prompts list
     */
    listPrompts(name?: string) {
      return ipcRenderer.invoke('mcp-list-prompts', name);
    },
    
    /**
     * Retrieves specific prompt from MCP server
     * @param {Object} params - Prompt retrieval parameters
     * @param {string} params.client - Client identifier
     * @param {string} params.name - Prompt name
     * @param {any} [params.args] - Optional prompt arguments
     * @returns {Promise<any>} Promise resolving to prompt data
     */
    getPrompt({
      client,
      name,
      args,
    }: {
      client: string;
      name: string;
      args?: any;
    }): Promise<any> {
      return ipcRenderer.invoke('mcp-get-prompt', { client, name, args });
    },
    
    /**
     * Retrieves MCP configuration
     * @returns {Promise<any>} Promise resolving to configuration object
     */
    getConfig(): Promise<any> {
      return ipcRenderer.invoke('mcp-get-config');
    },
    
    /**
     * Updates MCP configuration
     * @param {any} config - New configuration object
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    putConfig(config: any): Promise<boolean> {
      return ipcRenderer.invoke('mcp-put-config', config);
    },
    
    /**
     * Gets list of currently active MCP servers
     * @returns {Promise<string[]>} Promise resolving to array of active server names
     */
    getActiveServers(): Promise<string[]> {
      return ipcRenderer.invoke('mcp-get-active-servers');
    },
  },
  
  /**
   * Cryptographic operations interface
   */
  crypto: {
    /**
     * Encrypts text using specified key
     * @param {string} text - Text to encrypt
     * @param {string} key - Encryption key
     * @returns {Promise<any>} Promise resolving to encrypted data
     */
    encrypt(text: string, key: string) {
      return ipcRenderer.invoke('encrypt', text, key);
    },
    
    /**
     * Decrypts encrypted text using key and initialization vector
     * @param {string} encrypted - Encrypted text
     * @param {string} key - Decryption key
     * @param {string} iv - Initialization vector
     * @returns {Promise<any>} Promise resolving to decrypted text
     */
    decrypt(encrypted: string, key: string, iv: string) {
      return ipcRenderer.invoke('decrypt', encrypted, key, iv);
    },
    
    /**
     * Generates HMAC-SHA256 hash in hexadecimal format
     * @param {string} data - Data to hash
     * @param {string} key - HMAC key
     * @returns {Promise<string>} Promise resolving to hex-encoded hash
     */
    hmacSha256Hex(data: string, key: string) {
      return ipcRenderer.invoke('hmac-sha256-hex', data, key);
    },
  },
  
  /**
   * Opens URL in external browser
   * @param {string} url - URL to open
   * @returns {Promise<void>} Promise that resolves when URL is opened
   */
  openExternal(url: string) {
    return ipcRenderer.invoke('open-external', url);
  },
  
  /**
   * Gets user data directory path with optional subdirectories
   * @param {string[]} [paths] - Optional path segments to append
   * @returns {Promise<string>} Promise resolving to full path
   */
  getUserDataPath(paths?: string[]) {
    return ipcRenderer.invoke('get-user-data-path', paths);
  },
  
  /**
   * Database operations interface
   */
  db: {
    /**
     * Executes SQL query and returns all matching rows
     * @template T
     * @param {string} sql - SQL query string
     * @param {any} [params] - Query parameters
     * @returns {Promise<T[]>} Promise resolving to array of result rows
     */
    all<T>(sql: string, params: any | undefined = undefined): Promise<T[]> {
      return ipcRenderer.invoke('db-all', { sql, params });
    },
    
    /**
     * Executes SQL query and returns single row
     * @template T
     * @param {string} sql - SQL query string
     * @param {any} id - Query parameter
     * @returns {Promise<T>} Promise resolving to single result row
     */
    get<T>(sql: string, id: any): Promise<T> {
      return ipcRenderer.invoke('db-get', { sql, id });
    },
    
    /**
     * Executes SQL statement that modifies data
     * @param {string} sql - SQL statement
     * @param {any} params - Statement parameters
     * @returns {Promise<boolean>} Promise resolving to success status
     */
    run(sql: string, params: any): Promise<boolean> {
      return ipcRenderer.invoke('db-run', { sql, params });
    },
    
    /**
     * Executes multiple SQL statements as atomic transaction
     * @param {Array<{sql: string, params: any[]}>} tasks - Array of SQL tasks
     * @returns {Promise<boolean>} Promise resolving to transaction success status
     */
    transaction(tasks: { sql: string; params: any[] }[]): Promise<boolean> {
      return ipcRenderer.invoke('db-transaction', tasks);
    },
  },
  
  /**
   * Gets application protocol scheme
   * @returns {Promise<string>} Promise resolving to protocol string
   */
  getProtocol: () => ipcRenderer.invoke('get-protocol'),
  
  /**
   * Retrieves device information
   * @returns {Promise<any>} Promise resolving to device info object
   */
  getDeviceInfo: () => ipcRenderer.invoke('get-device-info'),
  
  /**
   * Gets current application version
   * @returns {Promise<string>} Promise resolving to version string
   */
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  /**
   * Gets current native theme setting
   * @returns {Promise<string>} Promise resolving to theme name
   */
  getNativeTheme: () => ipcRenderer.invoke('get-native-theme'),
  
  /**
   * Gets system language setting
   * @returns {Promise<string>} Promise resolving to language code
   */
  getSystemLanguage: () => ipcRenderer.invoke('get-system-language'),
  
  /**
   * Opens file dialog to select image and returns base64 data
   * @returns {Promise<string>} Promise resolving to base64 image data
   */
  selectImageWithBase64: () => ipcRenderer.invoke('select-image-with-base64'),
  
  /**
   * Notifies main process of theme change
   * @param {ThemeType} theme - New theme setting
   */
  setTheme: (theme: ThemeType) => ipcRenderer.send('theme-changed', theme),
  
  /**
   * Embedding model management interface
   */
  embeddings: {
    /**
     * Gets status of embedding model file
     * @returns {Promise<any>} Promise resolving to model file status
     */
    getModelFileStatus: () =>
      ipcRenderer.invoke('get-embedding-model-file-status'),
    
    /**
     * Removes embedding model from storage
     * @returns {Promise<any>} Promise resolving to removal result
     */
    removeModel: () => ipcRenderer.invoke('remove-embedding-model'),
    
    /**
     * Saves embedding model file to storage
     * @param {string} fileName - Name of model file
     * @param {string} filePath - Path to model file
     * @returns {Promise<any>} Promise resolving to save result
     */
    saveModelFile: (fileName: string, filePath: string) =>
      ipcRenderer.invoke('save-embedding-model-file', fileName, filePath),
  },
  
  /**
   * Knowledge base management interface
   */
  knowledge: {
    /**
     * Opens file dialog to select knowledge files
     * @returns {Promise<any>} Promise resolving to selected files
     */
    selectFiles: () => ipcRenderer.invoke('select-knowledge-files'),
    
    /**
     * Imports file into knowledge collection
     * @param {Object} params - Import parameters
     * @param {Object} params.file - File information
     * @param {string} params.file.id - File identifier
     * @param {string} params.file.path - File path
     * @param {string} params.file.name - File name
     * @param {number} params.file.size - File size in bytes
     * @param {string} params.file.type - File MIME type
     * @param {string} params.collectionId - Target collection identifier
     * @returns {Promise<any>} Promise resolving to import result
     */
    importFile: ({
      file,
      collectionId,
    }: {
      file: {
        id: string;
        path: string;
        name: string;
        size: number;
        type: string;
      };
      collectionId: string;
    }) =>
      ipcRenderer.invoke('import-knowledge-file', {
        file,
        collectionId,
      }),
    
    /**
     * Searches knowledge collections for query
     * @param {string[]} collectionIds - Array of collection IDs to search
     * @param {string} query - Search query string
     * @returns {Promise<any>} Promise resolving to search results
     */
    search: (collectionIds: string[], query: string) =>
      ipcRenderer.invoke('search-knowledge', collectionIds, query),
    
    /**
     * Removes file from knowledge base
     * @param {string} fileId - ID of file to remove
     * @returns {Promise<any>} Promise resolving to removal result
     */
    removeFile: (fileId: string) =>
      ipcRenderer.invoke('remove-knowledge-file', fileId),
    
    /**
     * Removes entire knowledge collection
     * @param {string} collectionId - ID of collection to remove
     * @returns {Promise<any>} Promise resolving to removal result
     */
    removeCollection: (collectionId: string) =>
      ipcRenderer.invoke('remove-knowledge-collection', collectionId),
    
    /**
     * Retrieves specific knowledge chunk by ID
     * @param {string} id - Chunk identifier
     * @returns {Promise<any>} Promise resolving to chunk data
     */
    getChunk: (id: string) => ipcRenderer.invoke('get-knowledge-chunk', id),
    
    /**
     * Closes knowledge database connection
     * @returns {Promise<void>} Promise that resolves when database is closed
     */
    close: () => ipcRenderer.invoke('close-knowledge-database'),
  },
  
  /**
   * Downloads file from URL to local storage
   * @param {string} fileName - Name for downloaded file
   * @param {string} url - URL to download from
   * @returns {Promise<any>} Promise resolving to download result
   */
  download: (fileName: string, url: string) =>
    ipcRenderer.invoke('download', fileName, url),
  
  /**
   * Cancels ongoing download
   * @param {string} fileName - Name of file being downloaded
   * @returns {Promise<any>} Promise resolving to cancellation result
   */
  cancelDownload: (fileName: string) =>
    ipcRenderer.invoke('cancel-download', fileName),
  
  /**
   * Sets native theme preference
   * @param {'light' | 'dark' | 'system'} theme - Theme preference
   * @returns {Promise<void>} Promise that resolves when theme is set
   */
  setNativeTheme: (theme: 'light' | 'dark' | 'system') =>
    ipcRenderer.invoke('set-native-theme', theme),
  
  /**
   * Sends event data for ingestion/analytics
   * @param {any} data - Event data to ingest
   * @returns {Promise<any>} Promise resolving to ingestion result
   */
  ingestEvent: (data: any) => ipcRenderer.invoke('ingest-event', data),
  
  /**
   * IPC renderer communication interface
   */
  ipcRenderer: {
    /**
     * Sends message to main process on specified channel
     * @param {Channels} channel - IPC channel name
     * @param {...unknown[]} args - Message arguments
     */
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    
    /**
     * Registers listener for messages on specified channel
     * @param {Channels} channel - IPC channel name
     * @param {(...args: unknown[]) => void} func - Message handler function
     * @returns {() => void} Function to remove the listener
     */
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => {
        func(...args);
      };
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    
    /**
     * Registers one-time listener for messages on specified channel
     * @param {Channels} channel - IPC channel name
     * @param {(...args: unknown[]) => void} func - Message handler function
     */
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    
    /**
     * Removes specific listener from channel
     * @param {Channels} channel - IPC channel name
     * @param {(...args: unknown[]) => void} func - Handler function to remove
     */
    unsubscribe(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.removeListener(channel, func as any);
    },
    
    /**
     * Removes all listeners from specified channel
     * @param {Channels} channel - IPC channel name
     */
    unsubscribeAll(channel: Channels) {
      ipcRenderer.removeAllListeners(channel);
    },
  },
  
  /**
   * Current platform identifier
   */
  platform: platform(),
  
  /**
   * Legacy document loading interface
   */
  document: {
    /**
     * @deprecated This method is temporary and will be removed in a future version.
     * Loads document from buffer data
     * @param {Uint8Array} buffer - Document buffer data
     * @param {string} fileType - Document file type
     * @returns {Promise<any>} Promise resolving to document content
     */
    loadFromBuffer: (buffer: Uint8Array, fileType: string) => {
      return ipcRenderer.invoke('load-document-buffer', buffer, fileType);
    },
  },
  
  /**
   * Modern document loading interface
   */
  documentLoader: {
    /**
     * Loads document content from buffer data
     * @param {Uint8Array} buffer - Document buffer data
     * @param {string} [mimeType] - Optional MIME type hint
     * @returns {Promise<DocumentContentPart[]>} Promise resolving to document content parts
     */
    loadFromBuffer: (buffer: Uint8Array, mimeType?: string) => {
      return ipcRenderer.invoke(
        'DocumentLoader::loadFromBuffer',
        buffer,
        mimeType,
      ) as Promise<DocumentContentPart[]>;
    },
    
    /**
     * Loads document content from URI
     * @param {string} url - Document URI
     * @param {string} [mimeType] - Optional MIME type hint
     * @returns {Promise<DocumentContentPart[]>} Promise resolving to document content parts
     */
    loadFromURI: (url: string, mimeType?: string) => {
      return ipcRenderer.invoke(
        'DocumentLoader::loadFromURI',
        url,
        mimeType,
      ) as Promise<DocumentContentPart[]>;
    },
    
    /**
     * Loads document content from file path
     * @param {string} file - File path
     * @param {string} [mimeType] - Optional MIME type hint
     * @returns {Promise<DocumentContentPart[]>} Promise resolving to document content parts
     */
    loadFromFilePath: (file: string, mimeType?: string) => {
      return ipcRenderer.invoke(
        'DocumentLoader::loadFromFilePath',
        file,
        mimeType,
      ) as Promise<DocumentContentPart[]>;
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

/**
 * Environment variables exposed to renderer process
 */
const envVars = {
  SUPA_PROJECT_ID: process.env.SUPA_PROJECT_ID,
  SUPA_KEY: process.env.SUPA_KEY,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NODE_ENV: process.env.NODE_ENV,
};
contextBridge.exposeInMainWorld('envVars', envVars);

/**
 * Type definition for the electron handler object
 */
export type ElectronHandler = typeof electronHandler;

/**
 * Type definition for environment variables object
 */
export type EnvVars = typeof envVars;
