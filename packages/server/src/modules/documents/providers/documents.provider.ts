import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type { Optional, TimelessDateString } from '@shared/types';
import type {
  IDeleteDocumentParams,
  IDeleteDocumentQuery,
  IGetAllDocumentsParams,
  IGetAllDocumentsQuery,
  IGetDocumentsByChargeIdQuery,
  IGetDocumentsByFiltersParams,
  IGetDocumentsByFiltersQuery,
  IGetDocumentsByFinancialEntityIdsParams,
  IGetDocumentsByFinancialEntityIdsQuery,
  IGetDocumentsByIdsQuery,
  IGetDocumentsSummaryByChargeIdsQuery,
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

const getDocumentsByFinancialEntityIds = sql<IGetDocumentsByFinancialEntityIdsQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE charge_id IN(
    SELECT c.id as financial_entity_id
    FROM accounter_schema.charges c
    WHERE c.owner_id IN $$ownerIds
  )
  ORDER BY created_at DESC;
`;

const getDocumentsByIds = sql<IGetDocumentsByIdsQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE id IN $$Ids;
`;

const getDocumentsSummaryByChargeIds = sql<IGetDocumentsSummaryByChargeIdsQuery>`
  SELECT d.charge_id,
        min(d.date) FILTER (WHERE d.type = ANY
                                  (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AS min_event_date,
        max(d.date) FILTER (WHERE d.type = ANY
                                  (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AS max_event_date,
        sum(d.total_amount *
            CASE
                WHEN d.creditor_id = c.owner_id THEN 1
                ELSE '-1'::integer
                END::double precision)
        FILTER (WHERE b.can_settle_with_receipt = true AND (d.type = ANY
                                                            (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))                                                                   AS receipt_event_amount,
        sum(d.total_amount *
            CASE
                WHEN d.creditor_id = c.owner_id THEN 1
                ELSE '-1'::integer
                END::double precision) FILTER (WHERE d.type = ANY
                                                      (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))                         AS invoice_event_amount,
        sum(d.vat_amount *
            CASE
                WHEN d.creditor_id = c.owner_id THEN 1
                ELSE '-1'::integer
                END::double precision)
        FILTER (WHERE b.can_settle_with_receipt = true AND (d.type = ANY
                                                            (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))                                                                   AS receipt_vat_amount,
        sum(d.vat_amount *
            CASE
                WHEN d.creditor_id = c.owner_id THEN 1
                ELSE '-1'::integer
                END::double precision) FILTER (WHERE d.type = ANY
                                                      (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))                         AS invoice_vat_amount,
        count(*) FILTER (WHERE d.type = ANY
                                (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))                                               AS invoices_count,
        count(*) FILTER (WHERE d.type = ANY
                                (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type]))                                                                                                 AS receipts_count,
        count(*)                                                                                                                                                                                                                       AS documents_count,
        count(*) FILTER (WHERE (d.type = ANY
                                (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AND
                                (d.debtor_id IS NULL OR
                                d.creditor_id IS NULL OR d.date IS NULL OR
                                d.serial_number IS NULL OR
                                d.vat_amount IS NULL OR
                                d.total_amount IS NULL OR
                                d.charge_id IS NULL OR
                                d.currency_code IS NULL) OR d.type =
                                                            'UNPROCESSED'::accounter_schema.document_type) >
        0                                                                                                                                                                                                                              AS invalid_documents,
        array_agg(d.currency_code) FILTER (WHERE
            b.can_settle_with_receipt = true AND (d.type = ANY
                                                  (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])) OR
            (d.type = ANY
              (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])))                                                                AS currency_array
  FROM accounter_schema.documents d
          LEFT JOIN accounter_schema.charges c ON d.charge_id = c.id
          LEFT JOIN accounter_schema.businesses b
                    ON d.creditor_id = c.owner_id AND
                        d.debtor_id = b.id OR
                        d.creditor_id = b.id AND
                        d.debtor_id = c.owner_id
  WHERE d.charge_id IN $$chargeIds
  GROUP BY d.charge_id;
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
  )
  WHERE
    id = $documentId
  RETURNING *;`;

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
      debtor_id
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
      debtorId
    )
    RETURNING *;`;

const getDocumentsByFilters = sql<IGetDocumentsByFiltersQuery>`
  SELECT d.*
  FROM accounter_schema.documents d
  LEFT JOIN accounter_schema.extended_charges c ON c.id = d.charge_id
  WHERE
    ($isIDs = 0 OR d.id IN $$IDs)
    AND ($fromDate ::TEXT IS NULL OR d.date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR d.date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    AND ($fromVatDate ::TEXT IS NULL OR COALESCE(d.vat_report_date_override ,d.date)::TEXT::DATE >= date_trunc('day', $fromVatDate ::DATE))
    AND ($toVatDate ::TEXT IS NULL OR COALESCE(d.vat_report_date_override ,d.date)::TEXT::DATE <= date_trunc('day', $toVatDate ::DATE))
    AND ($isBusinessIDs = 0 OR d.debtor_id IN $$businessIDs OR d.creditor_id IN $$businessIDs)
    AND ($isOwnerIDs = 0 OR c.owner_id IN $$ownerIDs)
    AND ($isUnmatched = 0 OR c.transactions_count = 0 OR c.transactions_count IS NULL)
  ORDER BY created_at DESC;
`;

type IGetAdjustedDocumentsByFiltersParams = Optional<
  Omit<IGetDocumentsByFiltersParams, 'isIDs' | 'fromDate' | 'toDate' | 'isUnmatched'>,
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
    return getAllDocuments.run(params, this.dbProvider);
  }

  private async batchDocumentsByChargeIds(chargeIds: readonly string[]) {
    try {
      const docs = await getDocumentsByChargeId.run({ chargeIds }, this.dbProvider);

      return chargeIds.map(id => docs.filter(doc => doc.charge_id === id));
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

  public getInvoicesByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) =>
      this.batchDocumentsByChargeIds(keys).then(res =>
        res.map(docs =>
          docs.filter(
            doc =>
              doc.type === 'INVOICE' ||
              doc.type === 'INVOICE_RECEIPT' ||
              doc.type === 'CREDIT_INVOICE',
          ),
        ),
      ),
    {
      cacheKeyFn: key => `invoices-by-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public getReceiptsByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) =>
      this.batchDocumentsByChargeIds(keys).then(res =>
        res.map(docs =>
          docs.filter(doc => doc.type === 'RECEIPT' || doc.type === 'INVOICE_RECEIPT'),
        ),
      ),
    {
      cacheKeyFn: key => `receipts-by-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public async getDocumentsByFinancialEntityIds(params: IGetDocumentsByFinancialEntityIdsParams) {
    return getDocumentsByFinancialEntityIds.run(params, this.dbProvider);
  }

  private async batchDocumentsSummaryByChargeIds(chargeIds: readonly string[]) {
    try {
      const docsSummaries = await getDocumentsSummaryByChargeIds.run(
        { chargeIds },
        this.dbProvider,
      );

      return chargeIds.map(id => docsSummaries.find(summary => summary.charge_id === id));
    } catch (e) {
      console.error(e);
      return chargeIds.map(() => undefined);
    }
  }

  public getDocumentSummaryByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchDocumentsSummaryByChargeIds(keys),
    {
      cacheKeyFn: key => `document-summary-by-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public async updateDocument(params: IUpdateDocumentParams) {
    if (params.documentId) {
      const document = await this.getDocumentsByIdLoader.load(params.documentId);
      if (document?.charge_id) {
        this.clearCacheByChargeId(document.charge_id);
      }
      if (params.chargeId) {
        this.clearCacheByChargeId(params.chargeId);
      }
      this.clearCacheById(params.documentId);
    }
    return updateDocument.run(params, this.dbProvider);
  }

  public async deleteDocument(params: IDeleteDocumentParams) {
    if (params.documentId) {
      const document = await this.getDocumentsByIdLoader.load(params.documentId);
      if (document?.charge_id) {
        this.clearCacheByChargeId(document.charge_id);
      }
      this.clearCacheById(params.documentId);
    }
    return deleteDocument.run(params, this.dbProvider);
  }

  public async insertDocuments(params: IInsertDocumentsParams) {
    params.document.map(({ chargeId }) => (chargeId ? this.clearCacheByChargeId(chargeId) : null));
    return insertDocuments.run(params, this.dbProvider);
  }

  public getDocumentsByFilters(params: IGetAdjustedDocumentsByFiltersParams) {
    const isIDs = !!params?.IDs?.filter(Boolean).length;
    const isBusinessIDs = !!params?.businessIDs?.filter(Boolean).length;
    const isOwnerIDs = !!params?.ownerIDs?.filter(Boolean).length;

    const fullParams: IGetDocumentsByFiltersParams = {
      isIDs: isIDs ? 1 : 0,
      isBusinessIDs: isBusinessIDs ? 1 : 0,
      isOwnerIDs: isOwnerIDs ? 1 : 0,
      fromDate: null,
      toDate: null,
      fromVatDate: null,
      toVatDate: null,
      ...params,
      isUnmatched: params.unmatched ? 1 : 0,
      IDs: isIDs ? params.IDs! : [null],
      businessIDs: isBusinessIDs ? params.businessIDs! : [null],
      ownerIDs: isOwnerIDs ? params.ownerIDs! : [null],
    };
    return getDocumentsByFilters.run(fullParams, this.dbProvider);
  }

  public async replaceDocumentsChargeId(params: IReplaceDocumentsChargeIdParams) {
    if (params.assertChargeID) this.clearCacheByChargeId(params.assertChargeID);
    if (params.replaceChargeID) this.clearCacheByChargeId(params.replaceChargeID);
    return replaceDocumentsChargeId.run(params, this.dbProvider).then(docs => {
      docs.map(({ id }) => this.clearCacheById(id));
      return docs;
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

  public clearCache() {
    this.cache.clear();
  }

  public clearCacheById(id: string) {
    this.cache.delete(`document-${id}`);
  }

  public clearCacheByChargeId(chargeId: string) {
    this.cache.delete(`document-by-charge-${chargeId}`);
    this.cache.delete(`invoices-by-charge-${chargeId}`);
    this.cache.delete(`receipts-by-charge-${chargeId}`);
    this.cache.delete(`document-summary-by-charge-${chargeId}`);
  }
}
