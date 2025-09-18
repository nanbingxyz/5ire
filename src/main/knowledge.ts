import path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import { Schema, Field, FixedSizeList, Utf8, Float16 } from 'apache-arrow';
import { Data } from '@lancedb/lancedb';
import { captureException } from './logging';
import { loadDocument } from './docloader';
import { randomId, smartChunk } from './util';
import { embed } from './embedder';

const TABLE_NAME = 'knowledge';
const dim = 1024;

const knowledgeSchema = new Schema([
  new Field('id', new Utf8()),
  new Field('collection_id', new Utf8()),
  new Field('file_id', new Utf8()),
  new Field('content', new Utf8()),
  new Field(
    'vector',
    new FixedSizeList(dim, new Field('item', new Float16(), true)),
    false,
  ),
]);

/**
 * Manages vector database operations for knowledge storage and retrieval
 */
export default class Knowledge {
  private static db: any;

  /**
   * Gets the database instance, initializing it if necessary
   * @returns {Promise<any>} The database instance
   */
  public static async getDatabase() {
    if (!this.db) {
      try {
        this.db = await this.init();
      } catch (err: any) {
        captureException(err);
      }
    }
    return this.db;
  }

  /**
   * Initializes the LanceDB database and creates the knowledge table if it doesn't exist
   * @returns {Promise<any>} The initialized database instance
   */
  private static async init() {
    const lancedb = await import('@lancedb/lancedb');
    const uri = path.join(app.getPath('userData'), 'lancedb.db');
    const db = await lancedb.connect(uri);
    const tableNames = await db.tableNames();
    log.debug('Existing tables:', tableNames.join(', '));
    if (!tableNames.includes(TABLE_NAME)) {
      await db.createEmptyTable(TABLE_NAME, knowledgeSchema);
      log.debug('create table knowledge');
    }
    return db;
  }

  /**
   * Closes the database connection and clears the instance
   * @returns {Promise<void>}
   */
  public static async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Imports a file by loading its content, chunking it, generating embeddings, and storing in the database
   * @param {Object} params - Import parameters
   * @param {Object} params.file - File information containing id, path, name, size, and type
   * @param {string} params.collectionId - ID of the collection to associate with the file
   * @param {Function} [params.onProgress] - Optional callback for progress updates
   * @param {Function} [params.onSuccess] - Optional callback for successful completion
   * @returns {Promise<void>}
   */
  public static async importFile({
    file,
    collectionId,
    onProgress,
    onSuccess,
  }: {
    file: {
      id: string;
      path: string;
      name: string;
      size: number;
      type: string;
    };
    collectionId: string;
    onProgress?: (filePath: string, total: number, done: number) => void;
    onSuccess?: (data: any) => void;
  }) {
    const textContent = await loadDocument(file.path, file.type);
    const chunks = smartChunk(textContent);
    const vectors = await embed(chunks, (total, done) => {
      if (onProgress) {
        onProgress(file.path, total, done);
      }
    });
    const data = vectors.map((vector: Float32Array, index: number) => {
      return {
        id: randomId(),
        collection_id: collectionId,
        file_id: file.id,
        content: chunks[index],
        vector,
      };
    });
    await this.add(data);
    onSuccess &&
      onSuccess({
        collectionId,
        file,
        numOfChunks: vectors.length,
      });
  }

  /**
   * Adds data to the knowledge table
   * @param {Data} data - The data to add to the table
   * @param {Object} [options] - Optional configuration
   * @param {boolean} [options.stayOpen] - Whether to keep the table connection open
   * @returns {Promise<void>}
   */
  public static async add(data: Data, options?: { stayOpen: boolean }) {
    const db = await this.getDatabase();
    const table = await db.openTable(TABLE_NAME);
    await table.add(data);
    if (!options?.stayOpen) {
      await table.close();
    }
  }

  /**
   * Retrieves a specific chunk by its ID
   * @param {string} id - The ID of the chunk to retrieve
   * @param {Object} [options] - Optional configuration
   * @param {boolean} [options.stayOpen] - Whether to keep the table connection open
   * @returns {Promise<Object|null>} The chunk data or null if not found
   */
  public static async getChunk(id: string, options?: { stayOpen: boolean }) {
    const db = await this.getDatabase();
    const table = await db.openTable(TABLE_NAME);
    log.debug('getChunk: ', id);
    const result = await table
      .query()
      .where(`id = "${id}"`)
      .select(['id', 'collection_id', 'file_id', 'content'])
      .toArray();
    if (!options?.stayOpen) {
      await table.close();
    }
    if (result.length > 0) {
      return {
        id: result[0].id,
        collectionId: result[0].collection_id,
        fileId: result[0].file_id,
        content: result[0].content,
      };
    }
    return null;
  }

  /**
   * Performs vector similarity search across specified collections
   * @param {string[]} collectionIds - Array of collection IDs to search within
   * @param {string} query - The search query text
   * @param {Object} [options] - Optional configuration
   * @param {boolean} [options.stayOpen] - Whether to keep the table connection open
   * @param {number} [options.limit] - Maximum number of results to return (default: 6)
   * @returns {Promise<Array>} Array of matching chunks with similarity scores
   */
  public static async search(
    collectionIds: string[],
    query: string,
    options?: { stayOpen?: boolean; limit?: number },
  ) {
    const db = await this.getDatabase();
    const table = await db.openTable(TABLE_NAME);
    const vectors = await embed([query]);
    const result = await table
      .search(vectors[0])
      .where(`collection_id in ('${collectionIds.join(',')}')`)
      .select(['id', 'collection_id', 'file_id', 'content'])
      .limit(options?.limit || 6)
      .toArray();
    if (!options?.stayOpen) {
      await table.close();
    }
    return result.map((item: any) => ({
      id: item.id,
      collectionId: item.collection_id,
      fileId: item.file_id,
      content: item.content,
    }));
  }

  /**
   * Removes records from the knowledge table based on provided criteria
   * @param {Object} criteria - Deletion criteria (at least one must be provided)
   * @param {string} [criteria.id] - Specific record ID to delete
   * @param {string} [criteria.collectionId] - Collection ID to delete all records from
   * @param {string} [criteria.fileId] - File ID to delete all records from
   * @param {Object} [options] - Optional configuration
   * @param {boolean} [options.stayOpen] - Whether to keep the table connection open
   * @returns {Promise<boolean>} True if deletion was successful, false otherwise
   */
  public static async remove(
    {
      id,
      collectionId,
      fileId,
    }: { id?: string; collectionId?: string; fileId?: string },
    options?: { stayOpen: boolean },
  ) {
    if (!id && !collectionId && !fileId) {
      log.warn('id, collectionId, fileId are all undefined');
      return false;
    }
    let table = null;
    try {
      const db = await this.getDatabase();
      table = await db.openTable(TABLE_NAME);
      if (id) {
        await table.delete(`id = "${id}"`);
      } else if (fileId) {
        await table.delete(`file_id = "${fileId}"`);
      } else if (collectionId) {
        await table.delete(`collection_id = "${collectionId}"`);
      }

      return true;
    } catch (err: any) {
      captureException(err);
      return false;
    } finally {
      if (table && !options?.stayOpen) {
        await table.close();
      }
    }
  }
}
