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
  IGetIssuedDocumentsByClientIdsQuery,
  IGetIssuedDocumentsByExternalIdsQuery,
  IGetIssuedDocumentsByIdsQuery,
  IGetIssuedDocumentsByTypeParams,
  IGetIssuedDocumentsByTypeQuery,
  IInsertIssuedDocumentsParams,
  IInsertIssuedDocumentsQuery,
  IUpdateIssuedDocumentByExternalIdParams,
  IUpdateIssuedDocumentByExternalIdQuery,
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

const getIssuedDocumentsByClientIds = sql<IGetIssuedDocumentsByClientIdsQuery>`
  SELECT d.*, di.external_id, di.status, di.linked_document_ids
  FROM accounter_schema.documents_issued di
  LEFT JOIN accounter_schema.documents d
    ON di.id = d.id
  WHERE d.debtor_id IN $$clientIds OR d.creditor_id IN $$clientIds;
`;

const getIssuedDocumentsByType = sql<IGetIssuedDocumentsByTypeQuery>`
  SELECT d.*, di.external_id, di.status, di.linked_document_ids
  FROM accounter_schema.documents_issued di
  LEFT JOIN accounter_schema.documents d
    ON di.id = d.id
  WHERE d.type = $type
  ORDER BY d.serial_number DESC
  LIMIT $limit;
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

const updateIssuedDocumentByExternalId = sql<IUpdateIssuedDocumentByExternalIdQuery>`
  UPDATE accounter_schema.documents_issued
  SET
  id = COALESCE(
    $documentId,
    id
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
    external_id = $externalId
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

  private async batchIssuedDocumentsByClientIds(clientIds: readonly string[]) {
    const uniqueClientIDs = [...new Set(clientIds)];
    try {
      const docs = await getIssuedDocumentsByClientIds.run(
        { clientIds: uniqueClientIDs },
        this.dbProvider,
      );

      return clientIds.map(id =>
        docs.filter(doc => {
          this.cache.set(`issued-document-${doc.id}`, doc);
          return doc.creditor_id === id || doc.debtor_id === id;
        }),
      );
    } catch (e) {
      const message = 'Error fetching issued documents by client IDs';
      console.error(message, e);
      throw new Error(message);
    }
  }

  public getIssuedDocumentsByClientIdLoader = new DataLoader(
    (clientIds: readonly string[]) => this.batchIssuedDocumentsByClientIds(clientIds),
    {
      cache: false,
      cacheKeyFn: id => `issued-documents-client-${id}`,
      cacheMap: this.cache,
    },
  );

  public async getIssuedDocumentsByType(params: IGetIssuedDocumentsByTypeParams) {
    return getIssuedDocumentsByType.run(params, this.dbProvider).then(res => {
      if (res) {
        res.map(doc => {
          this.cache.set(`issued-document-${doc.id}`, doc);
        });
      }
      return res;
    });
  }

  public async updateIssuedDocument(params: IUpdateIssuedDocumentParams) {
    if (params.documentId) {
      this.invalidateById(params.documentId);
    }
    return updateIssuedDocument.run(params, this.dbProvider);
  }

  public async updateIssuedDocumentByExternalId(params: IUpdateIssuedDocumentByExternalIdParams) {
    return updateIssuedDocumentByExternalId.run(params, this.dbProvider).then(res => {
      if (res[0]?.id) {
        this.invalidateById(res[0].id);
      }
      return res;
    });
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
    this.cache.delete([`issued-document-${id}`, 'all-issued-documents']);
  }

  public clearCache() {
    this.cache.clear();
  }
}
