import Joi from 'joi';
import GraphQLJSON from 'graphql-type-json';
import { withTransaction } from '@zkdb/storage';
import { authorizeWrapper } from '../validation.js';
import { TCollectionRequest } from './collection.js';
import { DocumentRecord } from '../../model/abstract/document.js';
import {
  collectionName,
  databaseName,
  documentField,
  networkId,
  pagination,
  permissionDetail,
} from './common.js';
import {
  createDocument,
  deleteDocument,
  readDocument,
  searchDocuments,
  updateDocument,
  findDocumentsWithMetadata,
} from '../../domain/use-case/document.js';
import { PermissionsData } from '../types/permission.js';
import { TDocumentFields } from '../types/document.js';
import { Pagination } from '../types/pagination.js';
import mapPagination from '../mapper/pagination.js';
import { gql } from '../../helper/common.js';

export type TDocumentFindRequest = TCollectionRequest & {
  documentQuery: { [key: string]: string };
};

export type TDocumentsFindRequest = TCollectionRequest & {
  documentQuery: { [key: string]: string };
  pagination: Pagination;
};

export type TDocumentCreateRequest = TCollectionRequest & {
  documentRecord: DocumentRecord;
  documentPermission: PermissionsData;
};

export type TDocumentUpdateRequest = TCollectionRequest & {
  documentQuery: { [key: string]: string };
  documentRecord: TDocumentFields;
};

export const DOCUMENT_FIND_REQUEST = Joi.object<TDocumentFindRequest>({
  databaseName,
  collectionName,
  documentQuery: Joi.object(),
  networkId
});

export const DOCUMENTS_FIND_REQUEST = Joi.object<TDocumentsFindRequest>({
  databaseName,
  collectionName,
  documentQuery: Joi.object(),
  pagination,
  networkId
});

export const DOCUMENT_CREATE_REQUEST = Joi.object<TDocumentCreateRequest>({
  databaseName,
  collectionName,
  documentPermission: permissionDetail.required(),
  documentRecord: Joi.required(),
  networkId
});

export const DOCUMENT_UPDATE_REQUEST = Joi.object<TDocumentUpdateRequest>({
  databaseName,
  collectionName,
  documentQuery: Joi.object(),
  documentRecord: Joi.required(),
  networkId
});

export const typeDefsDocument = gql`
  #graphql
  scalar JSON
  type Query
  type Mutation

  type MerkleWitness {
    isLeft: Boolean!
    sibling: String!
  }

  input PermissionRecordInput {
    system: Boolean
    create: Boolean
    read: Boolean
    write: Boolean
    delete: Boolean
  }

  input PermissionDetailInput {
    permissionOwner: PermissionRecordInput
    permissionGroup: PermissionRecordInput
    permissionOther: PermissionRecordInput
  }

  type DocumentsWithMetadataOutput {
    document: DocumentOutput!
    metadata: DocumentMetadataOutput!
    proofStatus: String
  }

  type DocumentPaginationOutput {
    data: [DocumentOutput]!
    totalSize: Int!
    offset: Int!
  }

  extend type Query {
    documentFind(
      networkId: NetworkId!
      databaseName: String!
      collectionName: String!
      documentQuery: JSON!
    ): DocumentOutput
    documentsFind(
      networkId: NetworkId!
      databaseName: String!
      collectionName: String!
      documentQuery: JSON!
      pagination: PaginationInput
    ): DocumentPaginationOutput!
    documentsWithMetadataFind(
      networkId: NetworkId!
      databaseName: String!
      collectionName: String!
      query: JSON!
      pagination: PaginationInput
    ): [DocumentsWithMetadataOutput]!
  }

  extend type Mutation {
    documentCreate(
      networkId: NetworkId!
      databaseName: String!
      collectionName: String!
      documentRecord: [DocumentRecordInput!]!
      documentPermission: PermissionDetailInput
    ): [MerkleWitness!]!

    documentUpdate(
      networkId: NetworkId!
      databaseName: String!
      collectionName: String!
      documentQuery: JSON!
      documentRecord: [DocumentRecordInput!]!
    ): [MerkleWitness!]!

    documentDrop(
      networkId: NetworkId!
      databaseName: String!
      collectionName: String!
      documentQuery: JSON!
    ): [MerkleWitness!]!
  }
`;

// Query
const documentFind = authorizeWrapper(
  DOCUMENT_FIND_REQUEST,
  async (_root: unknown, args: TDocumentFindRequest, ctx) => {
    const document = await withTransaction((session) =>
      readDocument(
        args.networkId,
        args.databaseName,
        args.collectionName,
        ctx.userName,
        args.documentQuery,
        session
      )
    );

    if (!document) {
      return null;
    }

    return {
      docId: document.docId,
      fields: document.fields,
      createdAt: document.createdAt,
    };
  }
);

const documentsFind = authorizeWrapper(
  DOCUMENTS_FIND_REQUEST,
  async (_root: unknown, args: TDocumentsFindRequest, ctx) => {
    return withTransaction(async (session) => {
      const documents = await searchDocuments(
        args.networkId,
        args.databaseName,
        args.collectionName,
        ctx.userName,
        args.documentQuery,
        mapPagination(args.pagination),
        session
      );

      return documents;
    });
  }
);

const documentsWithMetadataFind = authorizeWrapper(
  Joi.object().optional(),
  async (_root: unknown, args: TDocumentsFindRequest, ctx) => {
    return withTransaction(async (session) => {
      const documents = await findDocumentsWithMetadata(
        args.networkId,
        args.databaseName,
        args.collectionName,
        ctx.userName,
        args.documentQuery,
        mapPagination(args.pagination),
        session
      );

      return documents;
    });
  }
);

// Mutation
const documentCreate = authorizeWrapper(
  DOCUMENT_CREATE_REQUEST,
  async (_root: unknown, args: TDocumentCreateRequest, ctx) => {
    return withTransaction((session) =>
      createDocument(
        args.networkId,
        args.databaseName,
        args.collectionName,
        ctx.userName,
        args.documentRecord as any,
        args.documentPermission,
        session
      )
    );
  }
);

const documentUpdate = authorizeWrapper(
  DOCUMENT_UPDATE_REQUEST,
  async (_root: unknown, args: TDocumentUpdateRequest, ctx) => {
    for (let i = 0; i < args.documentRecord.length; i += 1) {
      const { error } = documentField.validate(args.documentRecord[i]);
      if (error)
        throw new Error(
          `DocumentRecord ${args.documentRecord[i].name} is not valid ${error.message}`
        );
    }

    return withTransaction((session) =>
      updateDocument(
        args.networkId,
        args.databaseName,
        args.collectionName,
        ctx.userName,
        args.documentQuery,
        args.documentRecord as any,
        session
      )
    );
  }
);

const documentDrop = authorizeWrapper(
  DOCUMENT_FIND_REQUEST,
  async (_root: unknown, args: TDocumentFindRequest, ctx) => {
    return withTransaction((session) =>
      deleteDocument(
        args.networkId,
        args.databaseName,
        args.collectionName,
        ctx.userName,
        args.documentQuery,
        session
      )
    );
  }
);

type TDocumentResolver = {
  JSON: typeof GraphQLJSON;
  Query: {
    documentFind: typeof documentFind;
    documentsFind: typeof documentsFind;
    documentsWithMetadataFind: typeof documentsWithMetadataFind;
  };
  Mutation: {
    documentCreate: typeof documentCreate;
    documentUpdate: typeof documentUpdate;
    documentDrop: typeof documentDrop;
  };
};

export const resolversDocument: TDocumentResolver = {
  JSON: GraphQLJSON,
  Query: {
    documentFind,
    documentsFind,
    documentsWithMetadataFind,
  },
  Mutation: {
    documentCreate,
    documentUpdate,
    documentDrop,
  },
};
