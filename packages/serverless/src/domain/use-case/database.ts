import {
  DatabaseEngine,
  DbSetting,
  ModelDatabase,
  ModelDbSetting,
  ModelNetwork,
} from '@zkdb/storage';
import { ClientSession } from 'mongodb';
import { Fill } from '@orochi-network/queue';
import ModelDocumentMetadata from '../../model/database/document-metadata.js';
import ModelGroup from '../../model/database/group.js';
import { ModelCollectionMetadata } from '../../model/database/collection-metadata.js';
import ModelUserGroup from '../../model/database/user-group.js';
import { Database } from '../types/database.js';
import { Pagination, PaginationReturn } from '../types/pagination.js';
import { isUserExist } from './user.js';
import { FilterCriteria } from '../utils/document.js';
import { readCollectionInfo } from './collection.js';

// eslint-disable-next-line import/prefer-default-export
export async function createDatabase(
  databaseName: string,
  merkleHeight: number,
  actor: string,
  appPublicKey: string,
  networkId: string
) {
  // Case database already exist
  if (await DatabaseEngine.getInstance().isDatabase(databaseName)) {
    // Ensure database existing
    throw new Error(`Database name ${databaseName} already taken`);
  }
  await ModelDocumentMetadata.init(databaseName);
  await ModelCollectionMetadata.init(databaseName);
  await ModelGroup.init(databaseName);
  await ModelUserGroup.init(databaseName);

  const modelNetwork = ModelNetwork.getInstance();

  const networks = await (
    await modelNetwork.find({ id: networkId, active: true })
  ).toArray();

  if (networks.length > 0) {
    await ModelDbSetting.getInstance().createSetting({
      databaseName,
      merkleHeight,
      appPublicKey,
      databaseOwner: actor,
      networkId,
    });
  } else {
    throw Error('Wrong Network Type');
  }
  return true;
}

export async function getDatabases(
  filter: FilterCriteria,
  pagination?: Pagination
): Promise<PaginationReturn<Database[]>> {
  const dbEngine = DatabaseEngine.getInstance();
  const databasesInfo = await dbEngine.client.db().admin().listDatabases();

  if (!databasesInfo?.databases?.length) {
    return {
      data: [],
      totalSize: 0,
      offset: pagination?.offset ?? 0,
    };
  }

  const databaseInfoMap: Record<string, { sizeOnDisk: number }> =
    databasesInfo.databases.reduce<Record<string, { sizeOnDisk: number }>>(
      (acc, dbInfo) => ({
        ...acc,
        [dbInfo.name]: { sizeOnDisk: dbInfo.sizeOnDisk || 0 },
      }),
      {}
    );

  const modelSetting = ModelDbSetting.getInstance();

  const settings = await modelSetting.findSettingsByFields(filter, {
    skip: pagination?.offset,
    limit: pagination?.limit,
  });

  if (!settings?.length) {
    // When user don't have any DB
    return {
      data: [],
      totalSize: 0,
      offset: pagination?.offset ?? 0,
    };
  }

  const collectionsCache: Record<string, string[]> = {};

  const databases: Database[] = (
    await Fill(
      settings.map((setting: DbSetting) => async () => {
        const { databaseName, merkleHeight, databaseOwner } = setting;
        const dbInfo = databaseInfoMap[databaseName];
        const databaseSize = dbInfo ? dbInfo.sizeOnDisk : null;

        const collectionNames =
          collectionsCache[databaseName] ||
          (collectionsCache[databaseName] =
            await ModelDatabase.getInstance(databaseName).listCollections());

        const promises = collectionNames.map(
          (collectionName) => async () =>
            readCollectionInfo(databaseName, collectionName)
        );

        const collections = (await Fill(promises))
          .map(({ result }) => result)
          .filter(Boolean);

        return {
          databaseName,
          databaseOwner,
          merkleHeight,
          databaseSize,
          collections,
        } as Database;
      })
    )
  )
    .map(({ result }) => result)
    .filter(Boolean);

  return {
    data: databases.filter(Boolean),
    offset: pagination?.offset ?? 0,
    totalSize: await modelSetting.count(filter),
  };
}

export async function getDatabaseSetting(
  databaseName: string
): Promise<DbSetting> {
  const setting = await ModelDbSetting.getInstance().getSetting(databaseName);

  if (setting) {
    return setting;
  }

  throw Error('Setting has not been found');
}

export async function isDatabaseOwner(
  databaseName: string,
  actor: string,
  session?: ClientSession
): Promise<boolean> {
  const setting = await ModelDbSetting.getInstance().getSetting(databaseName, {
    session,
  });
  if (setting) {
    return setting.databaseOwner === actor;
  }

  throw Error('Setting has not been found');
}

export async function changeDatabaseOwner(
  databaseName: string,
  actor: string,
  newOwner: string
): Promise<boolean> {
  const dbSetting = await getDatabaseSetting(databaseName);
  const dbOwner = dbSetting.databaseOwner;

  if (actor === dbOwner) {
    if (await isUserExist(newOwner)) {
      const result = await ModelDbSetting.getInstance().changeDatabaseOwner(
        databaseName,
        newOwner
      );

      return result.acknowledged;
    }

    throw Error(`User ${newOwner} does not exist`);
  }

  throw Error('You do not have permission to change the db owner');
}
