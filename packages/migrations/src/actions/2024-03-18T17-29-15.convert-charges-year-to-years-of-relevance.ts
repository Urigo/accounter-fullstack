import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-03-18T17-29-15.convert-charges-year-to-years-of-relevance.sql',
  run: ({ sql }) => sql`
    -- replace single-year column with multiple-year column
    alter table accounter_schema.charges
        add years_of_relevance date[];
    
    update accounter_schema.charges
        set years_of_relevance = Array[year_of_relevance]
        where year_of_relevance is not null;
    
    -- update view
    drop view accounter_schema.extended_charges;

    create or replace view accounter_schema.extended_charges
                (id, owner_id, is_conversion, is_property, is_salary, accountant_reviewed, user_description, created_at,
                updated_at, tax_category_id, event_amount, transactions_min_event_date, transactions_max_event_date,
                transactions_min_debit_date, transactions_max_debit_date, transactions_event_amount, transactions_currency,
                transactions_count, invalid_transactions, documents_min_date, documents_max_date, documents_event_amount,
                documents_vat_amount, documents_currency, invoices_count, receipts_count, documents_count,
                invalid_documents, business_array, business_id, can_settle_with_receipt, tags, business_trip_id,
                ledger_count, ledger_financial_entities, years_of_relevance)
    as
    SELECT c.id,
        c.owner_id,
        c.is_conversion,
        c.is_property,
        'salary'::accounter_schema.tags_enum = ANY (tags_table.tags_array)                         AS is_salary,
        c.accountant_reviewed,
        c.user_description,
        c.created_at,
        c.updated_at,
        COALESCE(c.tax_category_id, tcm.tax_category_id)                                           AS tax_category_id,
        COALESCE(d.invoice_event_amount::numeric, d.receipt_event_amount::numeric, t.event_amount) AS event_amount,
        t.min_event_date                                                                           AS transactions_min_event_date,
        t.max_event_date                                                                           AS transactions_max_event_date,
        t.min_debit_date                                                                           AS transactions_min_debit_date,
        t.max_debit_date                                                                           AS transactions_max_debit_date,
        t.event_amount                                                                             AS transactions_event_amount,
        CASE
            WHEN array_length(t.currency_array, 1) = 1 THEN t.currency_array[1]
            ELSE NULL::accounter_schema.currency
            END                                                                                    AS transactions_currency,
        t.transactions_count,
        t.invalid_transactions,
        d.min_event_date                                                                           AS documents_min_date,
        d.max_event_date                                                                           AS documents_max_date,
        COALESCE(d.invoice_event_amount, d.receipt_event_amount)                                   AS documents_event_amount,
        COALESCE(d.invoice_vat_amount, d.receipt_vat_amount)                                       AS documents_vat_amount,
        CASE
            WHEN array_length(d.currency_array, 1) = 1 THEN d.currency_array[1]
            ELSE NULL::accounter_schema.currency
            END                                                                                    AS documents_currency,
        d.invoices_count,
        d.receipts_count,
        d.documents_count,
        d.invalid_documents,
        b2.business_array,
        b.id                                                                                       AS business_id,
        COALESCE(b.can_settle_with_receipt, false)                                                 AS can_settle_with_receipt,
        tags_table.tags_array                                                                      AS tags,
        btc.business_trip_id,
        l.ledger_count,
        l.ledger_financial_entities,
        c.years_of_relevance
    FROM accounter_schema.charges c
            LEFT JOIN (SELECT extended_transactions.charge_id,
                            min(extended_transactions.event_date)                                AS min_event_date,
                            max(extended_transactions.event_date)                                AS max_event_date,
                            min(extended_transactions.debit_date)                                AS min_debit_date,
                            max(extended_transactions.debit_date)                                AS max_debit_date,
                            sum(extended_transactions.amount)                                    AS event_amount,
                            count(*)                                                             AS transactions_count,
                            count(*) FILTER (WHERE extended_transactions.business_id IS NULL OR
                                                    extended_transactions.debit_date IS NULL) > 0 AS invalid_transactions,
                            array_agg(DISTINCT extended_transactions.currency)                   AS currency_array,
                            array_agg(extended_transactions.account_id)                          AS account
                        FROM accounter_schema.extended_transactions
                        GROUP BY extended_transactions.charge_id) t ON t.charge_id = c.id
            LEFT JOIN (SELECT documents.charge_id_new,
                            min(documents.date) FILTER (WHERE documents.type = ANY
                                                                (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type])) AS min_event_date,
                            max(documents.date) FILTER (WHERE documents.type = ANY
                                                                (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type])) AS max_event_date,
                            sum(documents.total_amount *
                                CASE
                                    WHEN documents.creditor_id = charges.owner_id THEN 1
                                    ELSE '-1'::integer
                                    END::double precision) FILTER (WHERE businesses.can_settle_with_receipt = true AND
                                                                            (documents.type = ANY
                                                                            (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))                               AS receipt_event_amount,
                            sum(documents.total_amount *
                                CASE
                                    WHEN documents.creditor_id = charges.owner_id THEN 1
                                    ELSE '-1'::integer
                                    END::double precision) FILTER (WHERE documents.type = ANY
                                                                            (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type]))                                 AS invoice_event_amount,
                            sum(documents.vat_amount *
                                CASE
                                    WHEN documents.creditor_id = charges.owner_id THEN 1
                                    ELSE '-1'::integer
                                    END::double precision) FILTER (WHERE businesses.can_settle_with_receipt = true AND
                                                                            (documents.type = ANY
                                                                            (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))                               AS receipt_vat_amount,
                            sum(documents.vat_amount *
                                CASE
                                    WHEN documents.creditor_id = charges.owner_id THEN 1
                                    ELSE '-1'::integer
                                    END::double precision) FILTER (WHERE documents.type = ANY
                                                                            (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type]))                                 AS invoice_vat_amount,
                            count(*) FILTER (WHERE documents.type = ANY
                                                    (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type]))                                                       AS invoices_count,
                            count(*) FILTER (WHERE documents.type = ANY
                                                    (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type]))                                                       AS receipts_count,
                            count(*)                                                                                                                                                                             AS documents_count,
                            count(*) FILTER (WHERE (documents.type = ANY
                                                    (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type])) AND
                                                    (documents.debtor_id IS NULL OR documents.creditor_id IS NULL OR
                                                    documents.date IS NULL OR documents.serial_number IS NULL OR
                                                    documents.vat_amount IS NULL OR documents.total_amount IS NULL OR
                                                    documents.charge_id_new IS NULL OR
                                                    documents.currency_code IS NULL) OR
                                                    documents.type = 'UNPROCESSED'::accounter_schema.document_type) >
                            0                                                                                                                                                                                    AS invalid_documents,
                            array_agg(documents.currency_code) FILTER (WHERE
                                businesses.can_settle_with_receipt = true AND (documents.type = ANY
                                                                                (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])) OR
                                (documents.type = ANY
                                    (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))                                                                        AS currency_array
                        FROM accounter_schema.documents
                                LEFT JOIN accounter_schema.charges ON documents.charge_id_new = charges.id
                                LEFT JOIN accounter_schema.businesses ON documents.creditor_id = charges.owner_id AND
                                                                        documents.debtor_id = businesses.id OR
                                                                        documents.creditor_id = businesses.id AND
                                                                        documents.debtor_id = charges.owner_id
                        GROUP BY documents.charge_id_new) d ON d.charge_id_new = c.id
            LEFT JOIN (SELECT base.charge_id,
                            array_remove(base.business_array, charges.owner_id)          AS business_array,
                            array_remove(base.filtered_business_array, charges.owner_id) AS filtered_business_array
                        FROM (SELECT b_1.charge_id,
                                    array_agg(DISTINCT b_1.business_id)          AS business_array,
                                    array_remove(array_agg(DISTINCT
                                                            CASE
                                                                WHEN b_1.is_fee THEN NULL::uuid
                                                                ELSE b_1.business_id
                                                                END), NULL::uuid) AS filtered_business_array
                            FROM (SELECT transactions.charge_id,
                                        transactions.business_id,
                                        transactions.is_fee
                                    FROM accounter_schema.transactions
                                    WHERE transactions.business_id IS NOT NULL
                                    UNION
                                    SELECT documents.charge_id_new,
                                        documents.creditor_id,
                                        false AS bool
                                    FROM accounter_schema.documents
                                    WHERE documents.creditor_id IS NOT NULL
                                    UNION
                                    SELECT documents.charge_id_new,
                                        documents.debtor_id,
                                        false AS bool
                                    FROM accounter_schema.documents
                                    WHERE documents.debtor_id IS NOT NULL) b_1
                            GROUP BY b_1.charge_id) base
                                LEFT JOIN accounter_schema.charges ON base.charge_id = charges.id) b2
                    ON b2.charge_id = c.id
            LEFT JOIN accounter_schema.businesses b
                    ON b.id = b2.filtered_business_array[1] AND array_length(b2.filtered_business_array, 1) = 1
            LEFT JOIN accounter_schema.business_tax_category_match tcm
                    ON tcm.business_id = b.id AND tcm.owner_id = c.owner_id
            LEFT JOIN (SELECT tags_1.charge_id,
                            array_agg(tags_1.tag_name) AS tags_array
                        FROM accounter_schema.tags tags_1
                        GROUP BY tags_1.charge_id) tags_table ON c.id = tags_table.charge_id
            LEFT JOIN accounter_schema.business_trip_charges btc ON btc.charge_id = c.id
            LEFT JOIN (SELECT count(DISTINCT l2.id)                                             AS ledger_count,
                            array_remove(array_agg(DISTINCT l2.financial_entity), NULL::uuid) AS ledger_financial_entities,
                            l2.charge_id
                        FROM (SELECT ledger_records.charge_id,
                                    ledger_records.id,
                                    unnest(ARRAY [ledger_records.credit_entity1, ledger_records.credit_entity2, ledger_records.debit_entity1, ledger_records.debit_entity2]) AS financial_entity
                            FROM accounter_schema.ledger_records) l2
                        GROUP BY l2.charge_id) l ON l.charge_id = c.id;
    
    -- drop single-year column
    alter table accounter_schema.charges
        drop column year_of_relevance;
`,
} satisfies MigrationExecutor;
