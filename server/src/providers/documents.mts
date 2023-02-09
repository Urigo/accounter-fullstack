import pgQuery, { TaggedQuery } from '@pgtyped/query';
import { IDatabaseConnection } from '@pgtyped/query/lib/tag.js';
import DataLoader from 'dataloader';
import {
  IDeleteDocumentQuery,
  IGetAllDocumentsQuery,
  IGetDocumentsByChargeIdQuery,
  IGetDocumentsByFiltersParams,
  IGetDocumentsByFiltersQuery,
  IGetDocumentsByFiltersResult,
  IGetDocumentsByFinancialEntityIdsQuery,
  IInsertDocumentsQuery,
  IUpdateDocumentQuery,
} from '../__generated__/documents.types.mjs';
import { Optional } from '../helpers/misc.mjs';
import { pool } from '../providers/db.mjs';
import { TimelessDateString } from '../scalars/timeless-date.mjs';

const { sql } = pgQuery;

export const getAllDocuments = sql<IGetAllDocumentsQuery>`
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

async function batchDocumentsByChargeIds(chargeIds: readonly string[]) {
  const docs = await getDocumentsByChargeId.run({ chargeIds }, pool);

  return chargeIds.map(id => docs.filter(doc => doc.charge_id === id));
}

export const getDocumentsByChargeIdLoader = new DataLoader(batchDocumentsByChargeIds, {
  cache: false,
});

export const getDocumentsByFinancialEntityIds = sql<IGetDocumentsByFinancialEntityIdsQuery>`
  SELECT *
  FROM accounter_schema.documents
  WHERE charge_id IN(
    SELECT at.id as financial_entity_id
    FROM accounter_schema.all_transactions at
    LEFT JOIN accounter_schema.financial_accounts fa
    ON  at.account_number = fa.account_number
    WHERE fa.owner IN $$financialEntityIds
    )
  ORDER BY created_at DESC;
`;

export const updateDocument = sql<IUpdateDocumentQuery>`
  UPDATE accounter_schema.documents
  SET
  charge_id = CASE
    WHEN $chargeId='NULL' THEN NULL
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
  )
  WHERE
    id = $documentId
  RETURNING *;
`;

export const deleteDocument = sql<IDeleteDocumentQuery>`
  DELETE FROM accounter_schema.documents
  WHERE id = $documentId
  RETURNING id;
`;

export const insertDocuments = sql<IInsertDocumentsQuery>`
    INSERT INTO accounter_schema.documents (
      image_url,
      file_url,
      type,
      serial_number,
      date,
      total_amount,
      currency_code,
      vat_amount,
      charge_id
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
  WHERE
    ($isIDs = 0 OR d.id IN $$IDs)
    AND ($fromDate ::TEXT IS NULL OR d.date::TEXT::DATE >= date_trunc('day', $fromDate ::DATE))
    AND ($toDate ::TEXT IS NULL OR d.date::TEXT::DATE <= date_trunc('day', $toDate ::DATE))
  ORDER BY created_at DESC;
`;

type IGetAdjustedDocumentsByFiltersParams = Optional<
  Omit<IGetDocumentsByFiltersParams, 'isIDs' | 'fromDate' | 'toDate'>,
  'IDs'
> & {
  fromDate?: TimelessDateString;
  toDate?: TimelessDateString;
};

const getAdjustedDocumentsByFilters: Pick<
  TaggedQuery<{
    params: IGetAdjustedDocumentsByFiltersParams;
    result: IGetDocumentsByFiltersResult;
  }>,
  'run'
> = {
  run(params: IGetAdjustedDocumentsByFiltersParams, dbConnection: IDatabaseConnection) {
    const isIDs = !!(params?.IDs?.length);

    const fullParams: IGetDocumentsByFiltersParams = {
      isIDs: isIDs ? 1 : 0,
      fromDate: null,
      toDate: null,
      ...params,
      IDs: isIDs ? params.IDs! : [null],
    };
    return getDocumentsByFilters.run(fullParams, dbConnection);
  },
};

export { getAdjustedDocumentsByFilters as getDocumentsByFilters };
