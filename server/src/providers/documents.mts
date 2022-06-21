import pgQuery from '@pgtyped/query';
import DataLoader from 'dataloader';

import {
  IGetDocsByChargeIdQuery,
  IGetDocsByFinancialEntityIdsQuery,
  IGetEmailDocsQuery,
} from '../__generated__/documents.types.mjs';
import { pool } from '../providers/db.mjs';

const { sql } = pgQuery;

export const getEmailDocs = sql<IGetEmailDocsQuery>`
    SELECT *
    FROM accounter_schema.email_invoices
    ORDER BY email_received_date DESC;`;

const getDocsByChargeId = sql<IGetDocsByChargeIdQuery>`
        SELECT *
        FROM accounter_schema.email_invoices
        WHERE transaction_id in $$chargeIds
        ORDER BY email_received_date DESC;`;

async function batchDocsByChargeIds(chargeIds: readonly string[]) {
  const docs = await getDocsByChargeId.run({ chargeIds }, pool);

  return chargeIds.map(id => docs.filter(doc => doc.transaction_id === id));
}

export const getDocsByChargeIdLoader = new DataLoader(batchDocsByChargeIds, { cache: false });

export const getDocsByFinancialEntityIds = sql<IGetDocsByFinancialEntityIdsQuery>`
        SELECT *
        FROM accounter_schema.email_invoices
        WHERE transaction_id IN(
          SELECT at.id as financial_entity_id
          FROM accounter_schema.all_transactions at
          LEFT JOIN accounter_schema.financial_accounts fa
          ON  at.account_number = fa.account_number
          WHERE fa.owner IN $$financialEntityIds
          )
        ORDER BY email_received_date DESC;`;
