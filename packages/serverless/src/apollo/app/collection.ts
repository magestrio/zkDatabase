import { ModelDatabase, withTransaction } from '@zkdb/storage';
import GraphQLJSON from 'graphql-type-json';
import Joi from 'joi';
import { O1JS_VALID_TYPE } from '../../common/const.js';
import {
  createCollection,
  createIndex,
  listCollections,
} from '../../domain/use-case/collection.js';
import { PermissionsData } from '../types/permission.js';
import { SchemaData } from '../types/schema.js';
import publicWrapper, { authorizeWrapper } from '../validation.js';
import {
  collectionName,
  databaseName,
  groupName,
  networkId,
  permissionDetail,
} from './common.js';
import { TDatabaseRequest } from './database.js';

export const schemaField = Joi.object({
  name: Joi.string()
    .pattern(/^[a-z][a-zA-Z0-9_]+$/)
    .required(),
  kind: Joi.string()
    .valid(...O1JS_VALID_TYPE)
    .required(),
  indexed: Joi.boolean().optional(),
});

export const schemaFields = Joi.array().items(schemaField);

export type TCollectionRequest = TDatabaseRequest & {
  collectionName: string;
};

export type TCollectionCreateRequest = TCollectionRequest & {
  groupName: string;
  schema: SchemaData;
  indexes?: string[];
  permissions: PermissionsData;
};

export const CollectionRequest = Joi.object<TCollectionRequest>({
  collectionName,
  databaseName,
  networkId
});

export const CollectionCreateRequest = Joi.object<TCollectionCreateRequest>({
  collectionName,
  databaseName,
  groupName,
  schema: schemaFields,
  indexes: Joi.array().items(Joi.string().optional()),
  permissions: permissionDetail,
  networkId
});

export const typeDefsCollection = `#graphql
scalar JSON
type Query
type Mutation

extend type Query {
  collectionList(networkId: NetworkId!, databaseName: String!): [CollectionDescriptionOutput]!
  collectionExist(networkId: NetworkId!, databaseName: String!, collectionName: String!): Boolean
}

extend type Mutation {
  collectionCreate(
    networkId: NetworkId!,
    databaseName: String!, 
    collectionName: String!,
    groupName: String!,
    schema: [SchemaFieldInput!]!, 
    indexes: [String],
    permissions: PermissionDetailInput
  ): Boolean
}
`;

// Query
const collectionList = publicWrapper(
  Joi.object({
    databaseName,
    networkId,
  }),
  async (_root: unknown, args: TDatabaseRequest) =>
    listCollections(args.databaseName, "user-name", args.networkId)
);

const collectionExist = publicWrapper(
  Joi.object({
    databaseName,
    collectionName,
    networkId,
  }),
  async (_root: unknown, args: TCollectionRequest) =>
    (
      await ModelDatabase.getInstance(
        args.databaseName,
        args.networkId
      ).listCollections()
    ).some((collection) => collection === args.collectionName)
);

// Mutation
const collectionCreate = authorizeWrapper(
  CollectionCreateRequest,
  async (_root: unknown, args: TCollectionCreateRequest, ctx) => {
    const createCollectionResult = await withTransaction((session) =>
      createCollection(
        args.databaseName,
        args.collectionName,
        ctx.userName,
        args.groupName,
        args.schema,
        args.permissions,
        args.networkId,
        session
      )
    );

    if (args.indexes && args.indexes.length > 0 && createCollectionResult) {
      const indexResult = await createIndex(
        args.networkId,
        args.databaseName,
        ctx.userName,
        args.collectionName,
        args.indexes,
      );

      if (!indexResult) {
        throw Error('Failed to create index');
      }
    }

    return createCollectionResult;
  }
);

type TCollectionResolvers = {
  JSON: typeof GraphQLJSON;
  Query: {
    collectionList: typeof collectionList;
    collectionExist: typeof collectionExist;
  };
  Mutation: {
    collectionCreate: typeof collectionCreate;
  };
};

export const resolversCollection: TCollectionResolvers = {
  JSON: GraphQLJSON,
  Query: {
    collectionList,
    collectionExist,
  },
  Mutation: {
    collectionCreate,
  },
};
