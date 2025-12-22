import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '../../../shared/helpers/index.js';
import type { Optional, TimelessDateString } from '../../../shared/types/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  IDeleteDocumentParams,
  IDeleteDocumentQuery,
  IGetAllDocumentsParams,
  IGetAllDocumentsQuery,
  IGetAllDocumentsResult,
  IGetDocumentsByBusinessIdsQuery,
  IGetDocumentsByChargeIdQuery,
  IGetDocumentsByExtendedFiltersParams,
  IGetDocumentsByExtendedFiltersQuery,
  IGetDocumentsByFiltersParams,
  IGetDocumentsByFiltersQuery,
  IGetDocumentsByHashesQuery,
  IGetDocumentsByIdsQuery,
  IGetDocumentsByMissingRequiredInfoQuery,
  IInsertDocumentsParams,
  IInsertDocumentsQuery,
  IReplaceDocumentsChargeIdParams,
  IReplaceDocumentsChargeIdQuery,
  IUpdateDocumentParams,
  IUpdateDocumentQuery,
} from '../types.js';

const getAllDocuments = sql<IGetAllDocumentsQuery>`
  SELECT *
  FROM accounter_schema.documents
  ORDER BY created_at DESC;
`;

const getDocumentsByChargeId = sql<IGetDocumentsByChargeIdQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE charge_id in $$chargeIds
  ORDER BY created_at DESC;
`;

const getDocumentsByIds = sql<IGetDocumentsByIdsQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE id IN $$Ids;
`;

const getDocumentsByBusinessIds = sql<IGetDocumentsByBusinessIdsQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE debtor_id IN $$Ids OR creditor_id IN $$Ids;
`;

const getDocumentsByHashes = sql<IGetDocumentsByHashesQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE file_hash IN $$hashes;
`;

const getDocumentsByMissingRequiredInfo = sql<IGetDocumentsByMissingRequiredInfoQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE charge_id IS NOT NULL
  AND (image_url IS NULL AND file_url IS NULL) -- missing link
  OR (type <> 'OTHER'
      AND (serial_number IS NULL
          OR date IS NULL
          OR total_amount IS NULL
          OR currency_code IS NULL
          OR vat_amount IS NULL
          OR debtor_id IS NULL
          OR creditor_id IS NULL));
`;

const updateDocument = sql<IUpdateDocumentQuery>`
  UPDATE accounter_schema.documents
  SET
  charge_id = CASE
    WHEN $chargeId='00000000-0000-0000-0000-000000000000' THEN NULL
    ELSE COALESCE(
      $chargeId::UUID,
      charge_id,
      NULL
    ) END,
  currency_code = COALESCE(
    $currencyCode,
    currency_code,
    NULL
  ),
  date = COALESCE(
    $date,
    date,
    NULL
  ),
  file_url = COALESCE(
    $fileUrl,
    file_url,
    NULL
  ),
  id = COALESCE(
    id,
    id,
    NULL
  ),
  image_url = COALESCE(
    $imageUrl,
    image_url,
    NULL
  ),
  modified_at = NOW(),
  serial_number = COALESCE(
    $serialNumber,
    serial_number,
    NULL
  ),
  total_amount = COALESCE(
    $totalAmount,
    total_amount,
    NULL
  ),
  type = COALESCE(
    $type,
    type,
    NULL
  ),
  vat_amount = COALESCE(
    $vatAmount,
    vat_amount,
    NULL
  ),
  is_reviewed = COALESCE(
    $isReviewed,
    is_reviewed
  ),
  creditor_id = COALESCE(
    $creditorId,
    creditor_id
  ),
  debtor_id = COALESCE(
    $debtorId,
    debtor_id
  ),
  no_vat_amount = COALESCE(
    $noVatAmount,
    no_vat_amount
  ),
  vat_report_date_override = COALESCE(
    $vatReportDateOverride,
    vat_report_date_override
  ),
  allocation_number = COALESCE(
    $allocationNumber,
    allocation_number
  ),
  exchange_rate_override = COALESCE(
    $exchangeRateOverride,
    exchange_rate_override
  ),
  description = COALESCE(
    $description,
    description
  ),
  remarks = COALESCE(
    $remarks,
    remarks
  )
  WHERE
    id = $documentId
  RETURNING *;
`;

const deleteDocument = sql<IDeleteDocumentQuery>`
  DELETE FROM accounter_schema.documents
  WHERE id = $documentId
  RETURNING id;
`;

const insertDocuments = sql<IInsertDocumentsQuery>`
    INSERT INTO accounter_schema.documents (
      image_url,
      file_url,
      type,
      serial_number,
      date,
      total_amount,
      currency_code,
      vat_amount,
      charge_id,
      vat_report_date_override,
      no_vat_amount,
      creditor_id,
      debtor_id,
      allocation_number,
      exchange_rate_override,
      file_hash,
      description,
      remarks
    )
    VALUES $$document(
      image,
      file,
      documentType,
      serialNumber,
      date,
      amount,
      currencyCode,
      vat,
      chargeId,
      vatReportDateOverride,
      noVatAmount,
      creditorId,
      debtorId,
      allocationNumber,
      exchangeRateOverride,
      fileHash,
      description,
      remarks
    )
    RETURNING *;`;

const getDocumentsByFilters = sql<IGetDocumentsByFiltersQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE
    ($isIDs = 0 OR id IN $$IDs)
    AND ($fromVatDate ::TEXT IS NULL OR COALESCE(vat_report_date_override ,date)::TEXT::DATE >= date_trunc('day', $fromVatDate ::DATE))
    AND ($toVatDate ::TEXT IS NULL OR COALESCE(vat_report_date_override ,date)::TEXT::DATE <= date_trunc('day', $toVatDate ::DATE))
    AND ($isBusinessIDs = 0 OR debtor_id IN $$businessIDs OR creditor_id IN $$businessIDs)
  ORDER BY created_at DESC;
`;

const getDocumentsByExtendedFilters = sql<IGetDocumentsByExtendedFiltersQuery>`
  SELECT d.*
  FROM accounter_schema.documents d
  LEFT JOIN accounter_schema.extended_charges c ON c.id = d.charge_id
  WHERE
    ($isIDs = 0 OR d.id IN $$IDs)
    AND ($fromVatDate ::TEXT IS NULL OR COALESCE(d.vat_report_date_override ,d.date)::TEXT::DATE >= date_trunc('day', $fromVatDate ::DATE))
    AND ($toVatDate ::TEXT IS NULL OR COALESCE(d.vat_report_date_override ,d.date)::TEXT::DATE <= date_trunc('day', $toVatDate ::DATE))
    AND ($fromDate ::TEXT IS NULL OR d.date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR d.date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    AND ($isBusinessIDs = 0 OR d.debtor_id IN $$businessIDs OR d.creditor_id IN $$businessIDs)
    AND ($isOwnerIDs = 0 OR c.owner_id IN $$ownerIDs)
    AND ($isUnmatched = 0 OR c.transactions_count = 0 OR c.transactions_count IS NULL)
  ORDER BY created_at DESC;
`;

type IGetAdjustedDocumentsByFiltersParams = Optional<
  Omit<IGetDocumentsByFiltersParams, 'isIDs'>,
  'IDs' | 'businessIDs'
>;

type IGetAdjustedDocumentsByExtendedFiltersParams = Optional<
  Omit<IGetDocumentsByExtendedFiltersParams, 'isIDs' | 'fromDate' | 'toDate' | 'isUnmatched'>,
  'IDs' | 'businessIDs' | 'ownerIDs'
> & {
  fromDate?: TimelessDateString | null;
  toDate?: TimelessDateString | null;
  unmatched?: boolean | null;
};

const replaceDocumentsChargeId = sql<IReplaceDocumentsChargeIdQuery>`
  UPDATE accounter_schema.documents
  SET charge_id = $assertChargeID
  WHERE charge_id = $replaceChargeID
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DocumentsProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public async getAllDocuments(params: IGetAllDocumentsParams) {
    const cached = this.cache.get<IGetAllDocumentsResult[]>('all-documents');
    if (cached) {
      return Promise.resolve(cached);
    }
    return getAllDocuments.run(params, this.dbProvider).then(res => {
      if (res) {
        this.cache.set('all-documents', res);
        res.map(doc => {
          this.cache.set(`document-${doc.id}`, doc);
          this.cache.delete(`document-by-charge-${doc.charge_id}`);
        });
      }
      return res;
    });
  }

  private async batchDocumentsByChargeIds(chargeIds: readonly string[]) {
    const uniqueIDs = [...new Set(chargeIds)];
    try {
      const docs = await getDocumentsByChargeId.run({ chargeIds: uniqueIDs }, this.dbProvider);

      return chargeIds.map(id =>
        docs.filter(doc => {
          this.cache.set(`document-${doc.id}`, doc);
          return doc.charge_id === id;
        }),
      );
    } catch (e) {
      console.error(e);
      return chargeIds.map(() => []);
    }
  }

  public getDocumentsByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchDocumentsByChargeIds(keys),
    {
      cacheKeyFn: key => `document-by-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public getDocumentsByFilters(params: IGetAdjustedDocumentsByFiltersParams) {
    const isIDs = !!params?.IDs?.filter(Boolean).length;
    const isBusinessIDs = !!params?.businessIDs?.filter(Boolean).length;

    const fullParams: IGetDocumentsByFiltersParams = {
      isIDs: isIDs ? 1 : 0,
      isBusinessIDs: isBusinessIDs ? 1 : 0,
      fromVatDate: null,
      toVatDate: null,
      ...params,
      IDs: isIDs ? params.IDs! : [null],
      businessIDs: isBusinessIDs ? params.businessIDs! : [null],
    };
    return getDocumentsByFilters.run(fullParams, this.dbProvider).then(res => {
      res.map(doc => {
        this.cache.set(`document-${doc.id}`, doc);
        this.cache.delete(`document-by-charge-${doc.charge_id}`);
      });
      return res;
    });
  }

  public getDocumentsByExtendedFilters(params: IGetAdjustedDocumentsByExtendedFiltersParams) {
    const isIDs = !!params?.IDs?.filter(Boolean).length;
    const isBusinessIDs = !!params?.businessIDs?.filter(Boolean).length;
    const isOwnerIDs = !!params?.ownerIDs?.filter(Boolean).length;

    const fullParams: IGetDocumentsByExtendedFiltersParams = {
      isIDs: isIDs ? 1 : 0,
      isBusinessIDs: isBusinessIDs ? 1 : 0,
      isOwnerIDs: isOwnerIDs ? 1 : 0,
      fromVatDate: null,
      toVatDate: null,
      ...params,
      isUnmatched: params.unmatched ? 1 : 0,
      IDs: isIDs ? params.IDs! : [null],
      businessIDs: isBusinessIDs ? params.businessIDs! : [null],
      ownerIDs: isOwnerIDs ? params.ownerIDs! : [null],
    };
    return getDocumentsByExtendedFilters.run(fullParams, this.dbProvider).then(res => {
      res.map(doc => {
        this.cache.set(`document-${doc.id}`, doc);
        this.cache.delete(`document-by-charge-${doc.charge_id}`);
      });
      return res;
    });
  }

  private async batchDocumentsByIds(ids: readonly string[]) {
    const uniqueIDs = [...new Set(ids)];
    try {
      const docs = await getDocumentsByIds.run({ Ids: uniqueIDs }, this.dbProvider);

      return ids.map(id => docs.find(doc => doc.id === id));
    } catch (e) {
      console.error(e);
      return ids.map(() => null);
    }
  }

  public getDocumentsByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchDocumentsByIds(keys),
    {
      cacheKeyFn: key => `document-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchDocumentsByBusinessIds(businessIds: readonly string[]) {
    const uniqueIDs = [...new Set(businessIds)];
    try {
      const docs = await getDocumentsByBusinessIds.run({ Ids: uniqueIDs }, this.dbProvider);

      return businessIds.map(id =>
        docs.filter(doc => doc.creditor_id === id || doc.debtor_id === id),
      );
    } catch (e) {
      console.error(e);
      return businessIds.map(() => null);
    }
  }

  public getDocumentsByBusinessIdLoader = new DataLoader(
    (businessIds: readonly string[]) => this.batchDocumentsByBusinessIds(businessIds),
    {
      cacheKeyFn: key => `documents-by-business-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchDocumentsByHash(hashes: readonly number[]) {
    const uniqueHashes = [...new Set(hashes)];
    try {
      const docs = await getDocumentsByHashes.run(
        { hashes: uniqueHashes.map(hash => hash.toString()) },
        this.dbProvider,
      );

      return hashes.map(hash => docs.find(doc => doc.file_hash === hash.toString()));
    } catch (e) {
      console.error(e);
      return hashes.map(() => null);
    }
  }

  public getDocumentByHash = new DataLoader(
    (hashes: readonly number[]) => this.batchDocumentsByHash(hashes),
    {
      cacheKeyFn: hash => `document-hash-${hash}`,
      cacheMap: this.cache,
    },
  );

  public async getDocumentsByMissingRequiredInfo() {
    return getDocumentsByMissingRequiredInfo.run(undefined, this.dbProvider);
  }

  public async updateDocument(params: IUpdateDocumentParams) {
    if (params.documentId) {
      const document = await this.getDocumentsByIdLoader.load(params.documentId);
      if (document) {
        this.cache.delete(`document-by-charge-${document.charge_id}`);
      }
      this.invalidateById(params.documentId);
    }
    return updateDocument.run(params, this.dbProvider);
  }

  public async deleteDocument(params: IDeleteDocumentParams) {
    if (params.documentId) {
      const document = await this.getDocumentsByIdLoader.load(params.documentId);
      if (document) {
        this.cache.delete(`document-by-charge-${document.charge_id}`);
      }
      this.invalidateById(params.documentId);
    }
    return deleteDocument.run(params, this.dbProvider);
  }

  public async insertDocuments(params: IInsertDocumentsParams) {
    if (params.document.length) {
      params.document.map(doc => {
        if (doc.chargeId) this.invalidateByChargeId(doc.chargeId);
      });
    }
    return insertDocuments.run(params, this.dbProvider);
  }

  public async replaceDocumentsChargeId(params: IReplaceDocumentsChargeIdParams) {
    if (params.assertChargeID) {
      this.invalidateByChargeId(params.assertChargeID);
    }
    if (params.replaceChargeID) {
      this.invalidateByChargeId(params.replaceChargeID);
    }
    return replaceDocumentsChargeId.run(params, this.dbProvider);
  }

  public async invalidateById(id: string) {
    const document = await this.getDocumentsByIdLoader.load(id);
    if (document) {
      this.cache.delete(`document-by-charge-${document.charge_id}`);
      this.cache.delete(`document-hash-${document.file_hash}`);
      this.cache.delete(`documents-by-business-${document.debtor_id}`);
      this.cache.delete(`documents-by-business-${document.creditor_id}`);
    }
    this.cache.delete(`document-${id}`);
    this.cache.delete('all-documents');
  }

  public async invalidateByChargeId(chargeId: string) {
    const documents = await this.getDocumentsByChargeIdLoader.load(chargeId);
    documents.map(doc => {
      this.cache.delete(`document-${doc.id}`);
      this.cache.delete(`documents-by-business-${doc.debtor_id}`);
      this.cache.delete(`documents-by-business-${doc.creditor_id}`);
    });
    this.cache.delete(`document-by-charge-${chargeId}`);
    this.cache.delete('all-documents');
  }

  public clearCache() {
    this.cache.clear();
  }
}
