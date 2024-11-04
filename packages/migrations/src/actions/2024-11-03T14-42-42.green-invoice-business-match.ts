import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-11-03T14-42-42.green-invoice-business-match.sql',
  run: ({ sql }) => sql`
    create table if not exists accounter_schema.businesses_green_invoice_match
    (
        business_id      uuid                                                                              not null
            constraint businesses_green_invoice_match_pk
                primary key
            constraint businesses_green_invoice_match_businesses_id_fk
                references accounter_schema.businesses,
        green_invoice_id uuid                                                                              not null
            constraint businesses_green_invoice_match_pk_2
                unique,
        remark           text,
        emails           text[],
        document_type    accounter_schema.document_type default 'PROFORMA'::accounter_schema.document_type not null
    );

    create unique index if not exists businesses_green_invoice_match_business_id_uindex
        on accounter_schema.businesses_green_invoice_match (business_id);

    create unique index if not exists businesses_green_invoice_match_green_invoice_id_uindex
        on accounter_schema.businesses_green_invoice_match (green_invoice_id);
`,
} satisfies MigrationExecutor;
