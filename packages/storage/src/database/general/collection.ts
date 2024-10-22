import {
  CreateIndexesOptions,
  IndexSpecification,
  Document,
  DropIndexesOptions,
} from 'mongodb';
import { isOk } from '../../helper/common.js';
import ModelBasic from '../base/basic.js';
import ModelDatabase from './database.js';
import logger from '../../helper/logger.js';
import { DatabaseEngine } from '../database-engine.js';
import { NetworkId } from '../global/network.js';

/**
 * Handles collection operations. Extends ModelBasic.
 * This class should not be used directly.
 */
export class ModelCollection<T extends Document> extends ModelBasic<T> {
  private static instances: Map<string, ModelCollection<any>> = new Map();

  private constructor(databaseName: string, collectionName: string) {
    super(databaseName, collectionName);
  }

  public static getInstance<T extends Document>(
    databaseName: string,
    collectionName: string,
    networkId?: NetworkId
  ): ModelCollection<T> {
    const dbName = networkId
      ? DatabaseEngine.getValidName(databaseName, networkId)
      : databaseName;
    const key = `${dbName}.${collectionName}`;
    if (!ModelCollection.instances.has(key)) {
      ModelCollection.instances.set(
        key,
        new ModelCollection<T>(dbName, collectionName)
      );
    }
    return ModelCollection.instances.get(key) as ModelCollection<T>;
  }

  public async isExist(): Promise<boolean> {
    if (!this.collectionName) {
      return false;
    }
    return this.dbEngine.isCollection(this.databaseName, this.collectionName);
  }

  public async create(
    indexSpecs: IndexSpecification,
    indexOptions?: CreateIndexesOptions
  ): Promise<string> {
    if (!this.databaseName || !this.collectionName) {
      throw new Error('Database and collection were not set');
    }
    return this.collection.createIndex(indexSpecs, indexOptions);
  }

  public async drop(): Promise<boolean> {
    if (!this.collectionName) {
      logger.debug('collectionName is null');
      return false;
    }
    await this.db.dropCollection(this.collectionName);
    return true;
  }

  public async index(
    indexSpec: IndexSpecification,
    indexOptions?: CreateIndexesOptions
  ): Promise<boolean> {
    return isOk(async () =>
      this.collection.createIndex(indexSpec, indexOptions)
    );
  }

  public async isIndexed(indexName: string): Promise<boolean> {
    const indexArray = await this.collection.listIndexes().toArray();
    return indexArray.some((index) => index.name === indexName);
  }

  public async dropIndex(
    indexName: string,
    options?: DropIndexesOptions
  ): Promise<boolean> {
    return isOk(async () => this.collection.dropIndex(indexName, options));
  }

  public async listIndexes(): Promise<string[]> {
    const keySet = new Set<string>();
    (await this.collection.listIndexes().toArray()).forEach((index) => {
      Object.keys(index.key).forEach((key) => keySet.add(key));
    });
    return Array.from(keySet);
  }

  public async size(): Promise<number> {
    return (await this.db.command({ collStats: this.collectionName })).size;
  }

  public async info() {
    return this.db.command({ collStats: this.collectionName });
  }
}

export default ModelCollection;
