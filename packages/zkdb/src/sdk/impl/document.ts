import { IApiClient, TProofStatus } from '@zkdb/api';
import { Field } from 'o1js';
import { DocumentEncoded, ProvableTypeString } from '../schema';
import {
  MerkleWitness,
  Ownership,
  Permissions,
  Document,
  ProofStatus,
} from '../../types';
import { ZKDocument } from '../interfaces';
import { NetworkId } from '../../types/network';

export class ZKDocumentImpl implements ZKDocument {
  private databaseName: string;
  private collectionName: string;
  private _documentEncoded: DocumentEncoded;
  private _id: string;
  private createdAt: Date;
  private apiClient: IApiClient;
  private networkId: NetworkId;

  constructor(
    databaseName: string,
    collectionName: string,
    document: Document,
    apiClient: IApiClient,
    networkId: NetworkId
  ) {
    this.databaseName = databaseName;
    this.collectionName = collectionName;
    this._documentEncoded = document.documentEncoded;
    this._id = document.id;
    this.createdAt = document.createdAt;
    this.apiClient = apiClient;
    this.networkId = networkId;
  }

  async getProofStatus(): Promise<ProofStatus> {
    const result = await this.apiClient.proof.status({
      databaseName: this.databaseName,
      collectionName: this.collectionName,
      docId: this._id,
      networkId: this.networkId
    });

    switch (result.unwrap()) {
      case TProofStatus.QUEUED:
        return 'queue';
      case TProofStatus.PROVING:
        return 'proving';
      case TProofStatus.PROVED:
        return 'proved';
      case TProofStatus.FAILED:
        return 'failed';
    }
  }

  async changeGroup(groupName: string): Promise<void> {
    const result = await this.apiClient.ownership.setOwnership({
      networkId: this.networkId,
      databaseName: this.databaseName,
      collectionName: this.collectionName,
      docId: this._id,
      grouping: 'Group',
      newOwner: groupName,
    });

    result.unwrap();
  }

  async changeOwner(userName: string): Promise<void> {
    const result = await this.apiClient.ownership.setOwnership({
      networkId: this.networkId,
      databaseName: this.databaseName,
      collectionName: this.collectionName,
      docId: this._id,
      grouping: 'User',
      newOwner: userName,
    });

    result.unwrap();
  }

  async setPermissions(permissions: Permissions): Promise<Ownership> {
    const remotePermissions = await this.getOwnership();

    const result = await this.apiClient.permission.set({
      networkId: this.networkId,
      databaseName: this.databaseName,
      collectionName: this.collectionName,
      docId: this._id,
      permission: {
        permissionOwner: {
          ...remotePermissions.permissionOwner,
          ...permissions.permissionOwner,
        },
        permissionGroup: {
          ...remotePermissions.permissionGroup,
          ...permissions.permissionGroup,
        },
        permissionOther: {
          ...remotePermissions.permissionOther,
          ...permissions.permissionOther,
        },
      },
    });

    return result.unwrap();
  }

  async getOwnership(): Promise<Ownership> {
    const result = await this.apiClient.permission.get({
      networkId: this.networkId,
      databaseName: this.databaseName,
      collectionName: this.collectionName,
      docId: this._id,
    });

    return result.unwrap();
  }

  async getWitness(): Promise<MerkleWitness> {
    const result = await this.apiClient.merkle.witness({
      networkId: this.networkId,
      databaseName: this.databaseName,
      docId: this._id,
    });

    return result.unwrap().map((node) => ({
      isLeft: node.isLeft,
      sibling: Field(node.sibling),
    }));
  }

  toSchema<
    T extends {
      new (..._args: any): InstanceType<T>;
      deserialize: (_doc: DocumentEncoded) => any;
    },
  >(type: T): InstanceType<T> {
    if (this._documentEncoded.length > 0) {
      return type.deserialize(this._documentEncoded);
    }
    throw Error();
  }

  public getId(): string {
    return this._id;
  }

  public getDocumentEncoded(): DocumentEncoded {
    return this._documentEncoded;
  }

  async delete(): Promise<MerkleWitness> {
    const result = await this.apiClient.doc.delete({
      networkId: this.networkId,
      databaseName: this.databaseName,
      collectionName: this.collectionName,
      documentQuery: JSON.parse(JSON.stringify({ docId: this._id })),
    });

    const merkleWitness = result.unwrap();

    return merkleWitness.map((node) => ({
      isLeft: node.isLeft,
      sibling: Field(node.sibling),
    }));
  }

  async getDocumentHistory(): Promise<ZKDocument[]> {
    const result = await this.apiClient.doc.history({
      databaseName: this.databaseName,
      networkId: this.networkId,
      collectionName: this.collectionName,
      docId: this._id,
    });

    return result.unwrap().documents.map(
      (document) =>
        new ZKDocumentImpl(
          this.databaseName,
          this.collectionName,
          {
            id: document.docId,
            documentEncoded: document.fields.map((field) => ({
              name: field.name,
              kind: field.kind as ProvableTypeString,
              value: field.value,
            })),
            createdAt: document.createdAt,
          },
          this.apiClient,
          this.networkId
        )
    );
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }
}
