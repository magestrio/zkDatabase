import { resolversDatabase, typeDefsDatabase } from './app/database.js';
import { resolversCollection, typeDefsCollection } from './app/collection.js';
import { resolversDocument, typeDefsDocument } from './app/document.js';
import {
  resolversCollectionIndex,
  typeDefsCollectionIndex,
} from './app/collection-index.js';
import { resolversUser, typeDefsUser } from './app/user.js';
import { resolversGroup, typeDefsGroup } from './app/group.js';
import { resolversPermission, typeDefsPermission } from './app/metadata.js';
import { resolversMerkleTree, typeDefsMerkleTree } from './app/merkle-tree.js';
import { resolversProof, typeDefsProof } from './app/proof.js';
import { typeCommonDefsDocument } from './app/types/document.js';
import {
  resolversDocumentHistory,
  typeDefsDocumentHistory,
} from './app/document-history.js';
import { typeCommonDefsCollection } from './app/types/collection.js';
import { typeCommonDefsMetadata } from './app/types/metadata.js';
import { resolversNetwork, typeDefsNetwork } from './app/network.js';

export const TypedefsApp = [
  typeDefsDatabase,
  typeDefsCollection,
  typeDefsDocument,
  typeDefsCollectionIndex,
  typeDefsUser,
  typeDefsGroup,
  typeDefsPermission,
  typeDefsMerkleTree,
  typeDefsProof,
  typeDefsDocumentHistory,
  typeCommonDefsDocument,
  typeCommonDefsCollection,
  typeCommonDefsMetadata,
  typeDefsNetwork
];

type Resolver =
  | typeof resolversDatabase
  | typeof resolversCollection
  | typeof resolversDocument
  | typeof resolversCollectionIndex
  | typeof resolversUser
  | typeof resolversGroup
  | typeof resolversPermission
  | typeof resolversMerkleTree
  | typeof resolversProof
  | typeof resolversDocumentHistory
  | typeof resolversNetwork;

export const ResolversApp: Resolver[] = [
  resolversDatabase,
  resolversCollection,
  resolversDocument,
  resolversCollectionIndex,
  resolversUser,
  resolversGroup,
  resolversPermission,
  resolversMerkleTree,
  resolversProof,
  resolversDocumentHistory,
  resolversNetwork
];
