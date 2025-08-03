import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-08-03T15-08-25.add-charge-open-docs-flag.sql',
  run: ({ sql }) => sql`
drop view accounter_schema.extended_charges;

create or replace view accounter_schema.extended_charges
            (id, owner_id, is_property, accountant_status, user_description, created_at, updated_at, tax_category_id,
             event_amount, transactions_min_event_date, transactions_max_event_date, transactions_min_debit_date,
             transactions_max_debit_date, transactions_event_amount, transactions_currency, transactions_count,
             invalid_transactions, documents_min_date, documents_max_date, documents_event_amount, documents_vat_amount,
             documents_currency, invoices_count, receipts_count, documents_count, invalid_documents, open_docs_flag, business_array,
             business_id, can_settle_with_receipt, tags, business_trip_id, ledger_count, ledger_financial_entities,
             ledger_min_value_date, ledger_max_value_date, ledger_min_invoice_date, ledger_max_invoice_date,
             years_of_relevance, invoice_payment_currency_diff, type, optional_vat, no_invoices_required,
             documents_optional_flag)
as
WITH years_of_relevance AS (SELECT charge_spread.charge_id,
                                   array_agg(charge_spread.year_of_relevance) AS years_of_relevance
                            FROM accounter_schema.charge_spread
                            GROUP BY charge_spread.charge_id),
     transactions_by_charge AS (SELECT transactions.charge_id,
                                       min(transactions.event_date)                                             AS min_event_date,
                                       max(transactions.event_date)                                             AS max_event_date,
                                       min(COALESCE(transactions.debit_date_override, transactions.debit_date)) AS min_debit_date,
                                       max(COALESCE(transactions.debit_date_override, transactions.debit_date)) AS max_debit_date,
                                       sum(transactions.amount)                                                 AS event_amount,
                                       count(*)                                                                 AS transactions_count,
                                       count(*) FILTER (WHERE transactions.business_id IS NULL OR
                                                              COALESCE(transactions.debit_date_override, transactions.debit_date) IS NULL) >
                                       0                                                                        AS invalid_transactions,
                                       array_agg(DISTINCT transactions.currency)                                AS currency_array,
                                       array_agg(transactions.account_id)                                       AS account
                                FROM accounter_schema.transactions
                                GROUP BY transactions.charge_id),
     documents_by_charge AS (SELECT documents.charge_id,
                                    min(documents.date) FILTER (WHERE documents.type = ANY
                                                                      (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AS min_event_date,
                                    min(documents.date)                                                                                                                                                                                                                    AS min_any_event_date,
                                    max(documents.date) FILTER (WHERE documents.type = ANY
                                                                      (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AS max_event_date,
                                    max(documents.date)                                                                                                                                                                                                                    AS max_any_event_date,
                                    sum(documents.total_amount *
                                        CASE
                                            WHEN documents.creditor_id = charges.owner_id THEN 1
                                            ELSE '-1'::integer
                                            END::double precision)
                                    FILTER (WHERE businesses.can_settle_with_receipt = true AND (documents.type = ANY
                                                                                                 (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))                                                                  AS receipt_event_amount,
                                    sum(documents.total_amount *
                                        CASE
                                            WHEN documents.creditor_id = charges.owner_id THEN 1
                                            ELSE '-1'::integer
                                            END::double precision) FILTER (WHERE documents.type = ANY
                                                                                 (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))                                 AS invoice_event_amount,
                                    sum(documents.vat_amount *
                                        CASE
                                            WHEN documents.creditor_id = charges.owner_id THEN 1
                                            ELSE '-1'::integer
                                            END::double precision)
                                    FILTER (WHERE businesses.can_settle_with_receipt = true AND (documents.type = ANY
                                                                                                 (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))                                                                  AS receipt_vat_amount,
                                    sum(documents.vat_amount *
                                        CASE
                                            WHEN documents.creditor_id = charges.owner_id THEN 1
                                            ELSE '-1'::integer
                                            END::double precision) FILTER (WHERE documents.type = ANY
                                                                                 (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))                                 AS invoice_vat_amount,
                                    count(*) FILTER (WHERE documents.type = ANY
                                                           (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))                                                       AS invoices_count,
                                    count(*) FILTER (WHERE documents.type = ANY
                                                           (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type]))                                                                                                         AS receipts_count,
                                    count(*)                                                                                                                                                                                                                               AS documents_count,
                                    count(*) FILTER (WHERE (documents.type = ANY
                                                            (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AND
                                                           (documents.debtor_id IS NULL OR
                                                            documents.creditor_id IS NULL OR documents.date IS NULL OR
                                                            documents.serial_number IS NULL OR
                                                            documents.vat_amount IS NULL OR
                                                            documents.total_amount IS NULL OR
                                                            documents.charge_id IS NULL OR
                                                            documents.currency_code IS NULL) OR documents.type =
                                                                                                'UNPROCESSED'::accounter_schema.document_type) >
                                    0                                                                                                                                                                                                                                      AS invalid_documents,
                                    array_agg(documents.currency_code) FILTER (WHERE
                                        businesses.can_settle_with_receipt = true AND (documents.type = ANY
                                                                                       (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])) OR
                                        (documents.type = ANY
                                         (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])))                                                                        AS currency_array,
                                    COALESCE(BOOL_OR(documents_issued.status = 'OPEN'), false)                                                                                                                                                                                                  AS open_docs_flag
                             FROM accounter_schema.documents
                                      LEFT JOIN accounter_schema.charges ON documents.charge_id = charges.id
                                      LEFT JOIN accounter_schema.businesses
                                                ON documents.creditor_id = charges.owner_id AND
                                                   documents.debtor_id = businesses.id OR
                                                   documents.creditor_id = businesses.id AND
                                                   documents.debtor_id = charges.owner_id
                                      LEFT JOIN accounter_schema.documents_issued
                                                ON documents.id = documents_issued.id
                             GROUP BY documents.charge_id),
     businesses_by_charge AS (SELECT base.charge_id,
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
                                          SELECT documents.charge_id,
                                                 documents.creditor_id,
                                                 false AS bool
                                          FROM accounter_schema.documents
                                          WHERE documents.creditor_id IS NOT NULL
                                          UNION
                                          SELECT documents.charge_id,
                                                 documents.debtor_id,
                                                 false AS bool
                                          FROM accounter_schema.documents
                                          WHERE documents.debtor_id IS NOT NULL
                                          UNION
                                          SELECT ledger_records.charge_id,
                                                 ledger_records.credit_entity1,
                                                 true AS bool
                                          FROM accounter_schema.ledger_records
                                          WHERE ledger_records.credit_entity1 IS NOT NULL
                                          UNION
                                          SELECT ledger_records.charge_id,
                                                 ledger_records.credit_entity2,
                                                 true AS bool
                                          FROM accounter_schema.ledger_records
                                          WHERE ledger_records.credit_entity2 IS NOT NULL
                                          UNION
                                          SELECT ledger_records.charge_id,
                                                 ledger_records.debit_entity1,
                                                 true AS bool
                                          FROM accounter_schema.ledger_records
                                          WHERE ledger_records.debit_entity1 IS NOT NULL
                                          UNION
                                          SELECT ledger_records.charge_id,
                                                 ledger_records.debit_entity2,
                                                 true AS bool
                                          FROM accounter_schema.ledger_records
                                          WHERE ledger_records.debit_entity2 IS NOT NULL) b_1
                                    GROUP BY b_1.charge_id) base
                                       LEFT JOIN accounter_schema.charges ON base.charge_id = charges.id),
     tags_by_charge AS (SELECT tags_1.charge_id,
                               array_agg(tags_1.tag_id) AS tags_array
                        FROM accounter_schema.charge_tags tags_1
                        GROUP BY tags_1.charge_id),
     ledger_by_charge AS (SELECT count(DISTINCT l2.id)                                             AS ledger_count,
                                 array_remove(array_agg(DISTINCT l2.financial_entity), NULL::uuid) AS ledger_financial_entities,
                                 min(l2.value_date)                                                AS min_value_date,
                                 max(l2.value_date)                                                AS max_value_date,
                                 min(l2.invoice_date)                                              AS min_invoice_date,
                                 max(l2.invoice_date)                                              AS max_invoice_date,
                                 l2.charge_id
                          FROM (SELECT ledger_records.charge_id,
                                       ledger_records.id,
                                       ledger_records.value_date,
                                       ledger_records.invoice_date,
                                       unnest(ARRAY [ledger_records.credit_entity1, ledger_records.credit_entity2, ledger_records.debit_entity1, ledger_records.debit_entity2]) AS financial_entity
                                FROM accounter_schema.ledger_records) l2
                          GROUP BY l2.charge_id)
SELECT c.id,
       c.owner_id,
       d.id IS NOT NULL                                                                             AS is_property,
       c.accountant_status,
       c.user_description,
       c.created_at,
       c.updated_at,
       COALESCE(c.tax_category_id, tcm.tax_category_id)                                             AS tax_category_id,
       COALESCE(documents_by_charge.invoice_event_amount::numeric, documents_by_charge.receipt_event_amount::numeric,
                transactions_by_charge.event_amount)                                                AS event_amount,
       transactions_by_charge.min_event_date                                                        AS transactions_min_event_date,
       transactions_by_charge.max_event_date                                                        AS transactions_max_event_date,
       transactions_by_charge.min_debit_date                                                        AS transactions_min_debit_date,
       transactions_by_charge.max_debit_date                                                        AS transactions_max_debit_date,
       transactions_by_charge.event_amount                                                          AS transactions_event_amount,
       CASE
           WHEN array_length(transactions_by_charge.currency_array, 1) = 1 THEN transactions_by_charge.currency_array[1]
           ELSE NULL::accounter_schema.currency
           END                                                                                      AS transactions_currency,
       transactions_by_charge.transactions_count,
       transactions_by_charge.invalid_transactions,
       COALESCE(documents_by_charge.min_event_date,
                documents_by_charge.min_any_event_date)                                             AS documents_min_date,
       COALESCE(documents_by_charge.max_event_date,
                documents_by_charge.max_any_event_date)                                             AS documents_max_date,
       COALESCE(documents_by_charge.invoice_event_amount,
                documents_by_charge.receipt_event_amount)                                           AS documents_event_amount,
       COALESCE(documents_by_charge.invoice_vat_amount,
                documents_by_charge.receipt_vat_amount)                                             AS documents_vat_amount,
       CASE
           WHEN array_length(documents_by_charge.currency_array, 1) = 1 THEN documents_by_charge.currency_array[1]
           ELSE NULL::accounter_schema.currency
           END                                                                                      AS documents_currency,
       documents_by_charge.invoices_count,
       documents_by_charge.receipts_count,
       documents_by_charge.documents_count,
       documents_by_charge.invalid_documents,
       documents_by_charge.open_docs_flag,
       businesses_by_charge.business_array,
       b.id                                                                                         AS business_id,
       COALESCE(b.can_settle_with_receipt, false)                                                   AS can_settle_with_receipt,
       tags_by_charge.tags_array                                                                    AS tags,
       btc.business_trip_id,
       ledger_by_charge.ledger_count,
       ledger_by_charge.ledger_financial_entities,
       ledger_by_charge.min_value_date                                                              AS ledger_min_value_date,
       ledger_by_charge.max_value_date                                                              AS ledger_max_value_date,
       ledger_by_charge.min_invoice_date                                                            AS ledger_min_invoice_date,
       ledger_by_charge.max_invoice_date                                                            AS ledger_max_invoice_date,
       y.years_of_relevance,
       c.invoice_payment_currency_diff,
       c.type,
       c.optional_vat,
       COALESCE(b.no_invoices_required, false)                                                      AS no_invoices_required,
       c.documents_optional_flag
FROM accounter_schema.charges c
         LEFT JOIN transactions_by_charge ON transactions_by_charge.charge_id = c.id
         LEFT JOIN documents_by_charge ON documents_by_charge.charge_id = c.id
         LEFT JOIN businesses_by_charge ON businesses_by_charge.charge_id = c.id
         LEFT JOIN accounter_schema.businesses b ON b.id = businesses_by_charge.filtered_business_array[1] AND
                                                    array_length(businesses_by_charge.filtered_business_array, 1) = 1
         LEFT JOIN accounter_schema.business_tax_category_match tcm
                   ON tcm.business_id = b.id AND tcm.owner_id = c.owner_id
         LEFT JOIN tags_by_charge ON c.id = tags_by_charge.charge_id
         LEFT JOIN accounter_schema.business_trip_charges btc ON btc.charge_id = c.id
         LEFT JOIN ledger_by_charge ON ledger_by_charge.charge_id = c.id
         LEFT JOIN years_of_relevance y ON y.charge_id = c.id
         LEFT JOIN accounter_schema.depreciation d ON d.charge_id = c.id;
`,
} satisfies MigrationExecutor;
