import pgQuery from '@pgtyped/query';
import {
  IGetDocsByChargeIdQuery,
  IGetEmailDocsQuery,
  IGetLastInvoiceNumbersQuery,
} from '../__generated__/sqlQueries.types.mjs';

const { sql } = pgQuery;

export const getLastInvoiceNumbers = sql<IGetLastInvoiceNumbersQuery>`
    SELECT tax_invoice_number,
    user_description,
    financial_entity,
    event_amount,
    event_date
    FROM accounter_schema.all_transactions
    WHERE
    (account_number in ('466803', '1074', '1082')) AND
    event_amount > 0 AND
    (financial_entity not in ('Poalim', 'VAT') OR financial_entity IS NULL)
    ORDER BY event_date DESC;`;

export const getEmailDocs = sql<IGetEmailDocsQuery>`
    SELECT *
    FROM accounter_schema.email_invoices
    ORDER BY email_received_date DESC;`;

export const getDocsByChargeId = sql<IGetDocsByChargeIdQuery>`
    SELECT *
    FROM accounter_schema.email_invoices
    WHERE transaction_id in $$chargeIds
    ORDER BY email_received_date DESC;`;
