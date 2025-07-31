import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteIssuedDocumentParams,
  IDeleteIssuedDocumentQuery,
  IGetAllIssuedDocumentsParams,
  IGetAllIssuedDocumentsQuery,
  IGetAllIssuedDocumentsResult,
  IGetIssuedDocumentsByExternalIdsQuery,
  IGetIssuedDocumentsByIdsQuery,
  IInsertIssuedDocumentsParams,
  IInsertIssuedDocumentsQuery,
  IUpdateIssuedDocumentParams,
  IUpdateIssuedDocumentQuery,
} from '../types.js';

const getAllIssuedDocuments = sql<IGetAllIssuedDocumentsQuery>`
  SELECT *
  FROM accounter_schema.documents_issued;
`;

const getIssuedDocumentsByIds = sql<IGetIssuedDocumentsByIdsQuery>`
  SELECT *
  FROM accounter_schema.documents_issued
  WHERE id IN $$Ids;
`;

const getIssuedDocumentsByExternalIds = sql<IGetIssuedDocumentsByExternalIdsQuery>`
  SELECT *
  FROM accounter_schema.documents_issued
  WHERE external_id IN $$externalIds;
`;

const updateIssuedDocument = sql<IUpdateIssuedDocumentQuery>`
  UPDATE accounter_schema.documents_issued
  SET
  external_id = COALESCE(
    $externalId,
    external_id
  ),
  status = COALESCE(
    $status,
    status
  ),
  linked_document_ids = COALESCE(
    $linkedDocumentIds,
    linked_document_ids
  )
  WHERE
    id = $documentId
  RETURNING *;
`;

const deleteIssuedDocument = sql<IDeleteIssuedDocumentQuery>`
  DELETE FROM accounter_schema.documents_issued
  WHERE id = $documentId
  RETURNING id;
`;

const insertIssuedDocuments = sql<IInsertIssuedDocumentsQuery>`
    INSERT INTO accounter_schema.documents_issued (
      id,
      external_id,
      status,
      linked_document_ids
    )
    VALUES $$issuedDocuments(
      id,
      external_id,
      status,
      linked_document_ids
    )
    RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class IssuedDocumentsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public async getAllIssuedDocuments(params: IGetAllIssuedDocumentsParams) {
    const cached = this.cache.get<IGetAllIssuedDocumentsResult[]>('all-issued-documents');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllIssuedDocuments.run(params, this.dbProvider).then(res => {
      if (res) {
        this.cache.set('all-issued-documents', res);
        res.map(doc => {
          this.cache.set(`issued-document-${doc.id}`, doc);
        });
      }
      return res;
    });
  }

  private async batchIssuedDocumentsByIds(ids: readonly string[]) {
    const uniqueIDs = [...new Set(ids)];
    try {
      const docs = await getIssuedDocumentsByIds.run({ Ids: uniqueIDs }, this.dbProvider);

      return ids.map(id => docs.find(doc => doc.id === id));
    } catch (e) {
      console.error(e);
      return ids.map(() => null);
    }
  }

  public getIssuedDocumentsByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchIssuedDocumentsByIds(ids),
    {
      cacheKeyFn: id => `issued-document-${id}`,
      cacheMap: this.cache,
    },
  );

  private async batchIssuedDocumentsByExternalIds(externalIds: readonly string[]) {
    const uniqueExternalIDs = [...new Set(externalIds)];
    try {
      const docs = await getIssuedDocumentsByExternalIds.run(
        { externalIds: uniqueExternalIDs },
        this.dbProvider,
      );

      return externalIds.map(id => docs.find(doc => doc.external_id === id));
    } catch (e) {
      console.error(e);
      return externalIds.map(() => null);
    }
  }

  public getIssuedDocumentsByExternalIdLoader = new DataLoader(
    (externalIds: readonly string[]) => this.batchIssuedDocumentsByExternalIds(externalIds),
    {
      cacheKeyFn: id => `issued-document-external-${id}`,
      cacheMap: this.cache,
    },
  );

  public async updateIssuedDocument(params: IUpdateIssuedDocumentParams) {
    if (params.documentId) {
      this.invalidateById(params.documentId);
    }
    return updateIssuedDocument.run(params, this.dbProvider);
  }

  public async deleteIssuedDocument(params: IDeleteIssuedDocumentParams) {
    if (params.documentId) {
      this.invalidateById(params.documentId);
    }
    return deleteIssuedDocument.run(params, this.dbProvider);
  }

  public async insertIssuedDocuments(params: IInsertIssuedDocumentsParams) {
    this.cache.delete('all-issued-documents');
    return insertIssuedDocuments.run(params, this.dbProvider);
  }

  public async invalidateById(id: string) {
    this.cache.delete(`issued-document-${id}`);
    this.cache.delete('all-issued-documents');
  }

  public clearCache() {
    this.cache.clear();
  }
}
