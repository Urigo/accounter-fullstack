import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';

import {
  IGetAllDocumentsQuery,
  IGetDocumentsByChargeIdQuery,
  IGetDocumentsByFinancialEntityIdsQuery,
  IUpdateDocumentQuery,
} from '../__generated__/documents.types.mjs';
import { pool } from '../providers/db.mjs';

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

export const getDocumentsByChargeIdLoader = new DataLoader(batchDocumentsByChargeIds, { cache: false });

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
  charge_id = COALESCE(
    $chargeId,
    charge_id,
    NULL
  ),
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
  )
  WHERE
    id = $documentId
  RETURNING *;
`;
