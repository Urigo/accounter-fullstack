import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from 'modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
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
  WHERE charge_id_new in $$chargeIds
  ORDER BY created_at DESC;
`;

const getDocumentsByFinancialEntityIds = sql<IGetDocumentsByFinancialEntityIdsQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE charge_id_new IN(
    SELECT c.id as financial_entity_id
    FROM accounter_schema.charges c
    WHERE c.owner_id IN $$ownerIds
  )
  ORDER BY created_at DESC;
`;

const updateDocument = sql<IUpdateDocumentQuery>`
  UPDATE accounter_schema.documents
  SET
  charge_id_new = CASE
    WHEN $chargeId='NULL' THEN NULL
    ELSE COALESCE(
      $chargeId::UUID,
      charge_id_new,
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
      charge_id_new
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
      chargeId
    )
    RETURNING *;`;

const getDocumentsByFilters = sql<IGetDocumentsByFiltersQuery>`
  SELECT d.*
  FROM accounter_schema.documents d
  LEFT JOIN accounter_schema.charges c ON c.id = d.charge_id_new
  WHERE
    ($isIDs = 0 OR d.id IN $$IDs)
    AND ($fromDate ::TEXT IS NULL OR d.date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR d.date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
    AND ($isBusinessIDs = 0 OR d.debtor_id IN $$businessIDs OR d.creditor_id IN $$businessIDs)
    AND ($isOwnerIDs = 0 OR c.owner_id IN $$ownerIDs)
  ORDER BY created_at DESC;
`;

type IGetAdjustedDocumentsByFiltersParams = Optional<
  Omit<IGetDocumentsByFiltersParams, 'isIDs' | 'fromDate' | 'toDate'>,
  'IDs' | 'businessIDs' | 'ownerIDs'
> & {
  fromDate?: TimelessDateString | null;
  toDate?: TimelessDateString | null;
};

const replaceDocumentsChargeId = sql<IReplaceDocumentsChargeIdQuery>`
  UPDATE accounter_schema.documents
  SET charge_id_new = $assertChargeID
  WHERE charge_id_new = $replaceChargeID
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class DocumentsProvider {
  constructor(private dbProvider: DBProvider) {}

  public async getAllDocuments(params: IGetAllDocumentsParams) {
    return getAllDocuments.run(params, this.dbProvider);
  }

  private async batchDocumentsByChargeIds(chargeIds: readonly string[]) {
    const uniqueIDs = [...new Set(chargeIds)];
    try {
      const docs = await getDocumentsByChargeId.run({ chargeIds: uniqueIDs }, this.dbProvider);

      return chargeIds.map(id => docs.filter(doc => doc.charge_id_new === id));
    } catch (e) {
      console.error(e);
      return chargeIds.map(() => []);
    }
  }

  public getDocumentsByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchDocumentsByChargeIds(keys),
    {
      cache: false,
    },
  );

  public async getDocumentsByFinancialEntityIds(params: IGetDocumentsByFinancialEntityIdsParams) {
    return getDocumentsByFinancialEntityIds.run(params, this.dbProvider);
  }

  public async updateDocument(params: IUpdateDocumentParams) {
    return updateDocument.run(params, this.dbProvider);
  }

  public async deleteDocument(params: IDeleteDocumentParams) {
    return deleteDocument.run(params, this.dbProvider);
  }

  public async insertDocuments(params: IInsertDocumentsParams) {
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
      ...params,
      IDs: isIDs ? params.IDs! : [null],
      businessIDs: isBusinessIDs ? params.businessIDs! : [null],
      ownerIDs: isOwnerIDs ? params.ownerIDs! : [null],
    };
    return getDocumentsByFilters.run(fullParams, this.dbProvider);
  }

  public async replaceDocumentsChargeId(params: IReplaceDocumentsChargeIdParams) {
    return replaceDocumentsChargeId.run(params, this.dbProvider);
  }
}
