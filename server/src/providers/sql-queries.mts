import pgQuery from '@pgtyped/query';

import { IGetLastInvoiceNumbersQuery } from '../__generated__/sql-queries.types.mjs';

const { sql } = pgQuery;

export const getLastInvoiceNumbers = sql<IGetLastInvoiceNumbersQuery>`
    SELECT tax_invoice_number,
    user_description,
    financial_entity,
    event_amount,
    event_date
    FROM accounter_schema.all_transactions
    WHERE
    (account_number in ('466803', '1074', '1082', '5972')) AND
    event_amount > 0 AND
    (financial_entity not in ('Poalim', 'VAT') OR financial_entity IS NULL)
    ORDER BY event_date DESC;`;
