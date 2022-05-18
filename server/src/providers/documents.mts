import pgQuery from '@pgtyped/query';
import { IGetDocsByChargeIdQuery, IGetEmailDocsQuery } from '../__generated__/documents.types.mjs';

const { sql } = pgQuery;

export const getEmailDocs = sql<IGetEmailDocsQuery>`
    SELECT *
    FROM accounter_schema.email_invoices
    ORDER BY email_received_date DESC;`;

export const getDocsByChargeId = sql<IGetDocsByChargeIdQuery>`
    SELECT *
    FROM accounter_schema.email_invoices
    WHERE transaction_id in $$chargeIds
    ORDER BY email_received_date DESC;`;
