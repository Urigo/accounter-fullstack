import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';

import {
  IGetAllDocumentsQuery,
  IGetDocumentsByChargeIdQuery,
  IGetDocumentsByFinancialEntityIdsQuery,
} from '../__generated__/documents.types.mjs';
import { pool } from '../providers/db.mjs';

const { sql } = pgQuery;

export const getAllDocuments = sql<IGetAllDocumentsQuery>`
    SELECT *
    FROM accounter_schema.documents
    ORDER BY created_at DESC;`;

const getDocumentsByChargeId = sql<IGetDocumentsByChargeIdQuery>`
        SELECT *
        FROM accounter_schema.documents
        WHERE charge_id in $$chargeIds
        ORDER BY created_at DESC;`;

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
        ORDER BY created_at DESC;`;
