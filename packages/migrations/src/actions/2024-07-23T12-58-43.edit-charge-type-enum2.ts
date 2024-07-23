import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-07-23T12-58-43.edit-charge-type-enum2.sql',
  run: ({ sql }) => sql`
    UPDATE accounter_schema.charges
    SET type = 'FINANCIAL'::accounter_schema.charge_type
    WHERE type = 'REVALUATION';

    CREATE TYPE accounter_schema.charge_type_new AS ENUM ('CONVERSION', 'PAYROLL', 'FINANCIAL');

    DROP VIEW accounter_schema.extended_charges;

    DROP VIEW accounter_schema.extended_transactions;

    ALTER TABLE accounter_schema.charges
      ALTER COLUMN type TYPE accounter_schema.charge_type_new
        USING (type::text::accounter_schema.charge_type_new);
    
    DROP TYPE accounter_schema.charge_type;

    ALTER TYPE accounter_schema.charge_type_new RENAME TO charge_type;

    create or replace view accounter_schema.extended_transactions
      (id, charge_id, business_id, currency, debit_date, debit_timestamp, source_debit_date, event_date,
      account_id, account_type, amount, current_balance, source_description, source_details, created_at,
      updated_at, source_id, source_reference, source_origin, currency_rate, is_fee, charge_type)
    as
    SELECT DISTINCT ON (t.id) t.id,
      t.charge_id,
      t.business_id,
      t.currency,
      CASE
        WHEN ot.origin = 'ISRACARD'::text AND t.currency = 'ILS'::accounter_schema.currency AND
          t.debit_date IS NULL AND t.debit_date_override IS NULL THEN dd.event_date
        ELSE COALESCE(t.debit_date_override, t.debit_date)
        END             AS debit_date,
      ot.debit_timestamp,
      t.debit_date        AS source_debit_date,
      t.event_date,
      t.account_id,
      a.type              AS account_type,
      t.amount,
      t.current_balance,
      t.source_description,
      ot.source_details,
      t.created_at,
      t.updated_at,
      ot.raw_id           AS source_id,
      ot.reference_number AS source_reference,
      ot.origin           AS source_origin,
      ot.currency_rate,
      CASE
        WHEN f.id IS NULL THEN false
        ELSE true
        END             AS is_fee,
      c.type              AS charge_type
    FROM accounter_schema.transactions t
      LEFT JOIN accounter_schema.transactions_raw_list rt ON t.source_id = rt.id
      LEFT JOIN accounter_schema.charges c ON c.id = t.charge_id
      LEFT JOIN accounter_schema.financial_accounts a ON a.id = t.account_id
      LEFT JOIN accounter_schema.transactions_fees f ON f.id = t.id
      LEFT JOIN (SELECT isracard_creditcard_transactions.id::text                              AS raw_id,
          COALESCE(isracard_creditcard_transactions.voucher_number::text,
            isracard_creditcard_transactions.voucher_number_ratz::text)   AS reference_number,
          0                                                                      AS currency_rate,
          NULL::timestamp without time zone                                      AS debit_timestamp,
          'ISRACARD'::text                                                       AS origin,
          isracard_creditcard_transactions.card                                  AS card_number,
          COALESCE(isracard_creditcard_transactions.full_supplier_name_heb,
            isracard_creditcard_transactions.full_supplier_name_outbound) AS source_details
        FROM accounter_schema.isracard_creditcard_transactions
        UNION
        SELECT poalim_ils_account_transactions.id::text                                AS id,
          poalim_ils_account_transactions.reference_number::text                  AS reference_number,
          0                                                                       AS currency_rate,
          NULL::timestamp without time zone                                       AS debit_timestamp,
          'POALIM'::text                                                          AS origin,
          NULL::integer                                                           AS card_number,
          poalim_ils_account_transactions.beneficiary_details_data_message_detail AS source_details
        FROM accounter_schema.poalim_ils_account_transactions
        UNION
        SELECT poalim_eur_account_transactions.id::text               AS id,
          poalim_eur_account_transactions.reference_number::text AS reference_number,
          poalim_eur_account_transactions.currency_rate,
          NULL::timestamp without time zone                      AS debit_timestamp,
          'POALIM'::text                                         AS origin,
          NULL::integer                                          AS card_number,
          poalim_eur_account_transactions.event_details          AS source_details
        FROM accounter_schema.poalim_eur_account_transactions
        UNION
        SELECT poalim_gbp_account_transactions.id::text               AS id,
          poalim_gbp_account_transactions.reference_number::text AS reference_number,
          poalim_gbp_account_transactions.currency_rate,
          NULL::timestamp without time zone                      AS debit_timestamp,
          'POALIM'::text                                         AS origin,
          NULL::integer                                          AS card_number,
          poalim_gbp_account_transactions.event_details          AS source_details
        FROM accounter_schema.poalim_gbp_account_transactions
        UNION
        SELECT poalim_usd_account_transactions.id::text               AS id,
          poalim_usd_account_transactions.reference_number::text AS reference_number,
          poalim_usd_account_transactions.currency_rate,
          NULL::timestamp without time zone                      AS debit_timestamp,
          'POALIM'::text                                         AS origin,
          NULL::integer                                          AS card_number,
          poalim_usd_account_transactions.event_details          AS source_details
        FROM accounter_schema.poalim_usd_account_transactions
        UNION
        SELECT poalim_swift_account_transactions.id::text          AS id,
          poalim_swift_account_transactions.reference_number,
          0,
          NULL::timestamp without time zone                   AS debit_timestamp,
          'POALIM'::text                                      AS origin,
          NULL::integer                                       AS card_number,
          poalim_swift_account_transactions.charge_party_name AS source_details
        FROM accounter_schema.poalim_swift_account_transactions
        UNION
        SELECT kraken_ledger_records.ledger_id,
          kraken_ledger_records.ledger_id,
          CASE
            WHEN kraken_trades.price IS NOT NULL THEN 1::numeric / kraken_trades.price
            ELSE 0::numeric
            END                          AS currency_rate,
          kraken_ledger_records.value_date AS debit_timestamp,
          'KRAKEN'::text                   AS origin,
          NULL::integer                    AS card_number,
          NULL::character varying          AS source_details
        FROM accounter_schema.kraken_ledger_records
          LEFT JOIN accounter_schema.kraken_trades
            ON kraken_ledger_records.trade_ref_id = kraken_trades.trade_id
        UNION
        SELECT etana_account_transactions.transaction_id,
          etana_account_transactions.transaction_id,
          0,
          NULL::timestamp without time zone AS debit_timestamp,
          'ETANA'::text                     AS origin,
          NULL::integer                     AS card_number,
          NULL::character varying           AS source_details
        FROM accounter_schema.etana_account_transactions
        UNION
        SELECT etherscan_transactions.id::text   AS id,
          etherscan_transactions.transaction_hash,
          0,
          etherscan_transactions.event_date AS debit_timestamp,
          'ETHERSCAN'::text                 AS origin,
          NULL::integer                     AS card_number,
          NULL::character varying           AS source_details
        FROM accounter_schema.etherscan_transactions) ot ON ot.raw_id = COALESCE(rt.creditcard_id::text,
          rt.poalim_ils_id::text,
          rt.poalim_eur_id::text,
          rt.poalim_gbp_id::text,
          rt.poalim_swift_id::text,
          rt.poalim_usd_id::text,
          rt.kraken_id, rt.etana_id,
          rt.etherscan_id::text)
      LEFT JOIN (SELECT p.event_date,
            p.reference_number
          FROM accounter_schema.poalim_ils_account_transactions p
          WHERE p.activity_type_code = 491) dd
        ON dd.reference_number = ot.card_number AND dd.event_date > t.event_date AND
          dd.event_date < (t.event_date + '40 days'::interval)
    ORDER BY t.id, dd.event_date;

    create or replace view accounter_schema.extended_charges
      (id, owner_id, is_property, is_salary, accountant_reviewed, user_description, created_at, updated_at,
      tax_category_id, event_amount, transactions_min_event_date, transactions_max_event_date,
      transactions_min_debit_date, transactions_max_debit_date, transactions_event_amount, transactions_currency,
      transactions_count, invalid_transactions, documents_min_date, documents_max_date, documents_event_amount,
      documents_vat_amount, documents_currency, invoices_count, receipts_count, documents_count,
      invalid_documents, business_array, business_id, can_settle_with_receipt, tags, business_trip_id,
      ledger_count, ledger_financial_entities, ledger_min_value_date, ledger_max_value_date, ledger_min_invoice_date, ledger_max_invoice_date, years_of_relevance, invoice_payment_currency_diff, type)
    as
    WITH years_of_relevance AS (
      SELECT charge_id, array_agg(year_of_relevance) as years_of_relevance FROM accounter_schema.charge_spread
      GROUP BY charge_id
    )
    SELECT c.id,
      c.owner_id,
      c.is_property,
      c.type = 'PAYROLL'::accounter_schema.charge_type                                           AS is_salary,
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
      END                                                                                        AS transactions_currency,
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
      l.min_value_date                                                                           AS ledger_min_value_date,
      l.max_value_date                                                                           AS ledger_max_value_date,
      l.min_invoice_date                                                                         AS ledger_min_invoice_date,
      l.max_invoice_date                                                                         AS ledger_max_invoice_date,
      y.years_of_relevance,
      c.invoice_payment_currency_diff,
      c.type
    FROM accounter_schema.charges c
    LEFT JOIN (SELECT extended_transactions.charge_id,
        min(extended_transactions.event_date)                                 AS min_event_date,
        max(extended_transactions.event_date)                                 AS max_event_date,
        min(extended_transactions.debit_date)                                 AS min_debit_date,
        max(extended_transactions.debit_date)                                 AS max_debit_date,
        sum(extended_transactions.amount)                                     AS event_amount,
        count(*)                                                              AS transactions_count,
        count(*) FILTER (WHERE extended_transactions.business_id IS NULL OR
          extended_transactions.debit_date IS NULL) > 0                       AS invalid_transactions,
        array_agg(DISTINCT extended_transactions.currency)                    AS currency_array,
        array_agg(extended_transactions.account_id)                           AS account
      FROM accounter_schema.extended_transactions
      GROUP BY extended_transactions.charge_id) t ON t.charge_id = c.id
    LEFT JOIN (SELECT documents.charge_id,
        min(documents.date) FILTER (WHERE documents.type = ANY
          (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AS min_event_date,
        max(documents.date) FILTER (WHERE documents.type = ANY
          (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AS max_event_date,
        sum(documents.total_amount *
          CASE
            WHEN documents.creditor_id = charges.owner_id THEN 1
            ELSE '-1'::integer
            END::double precision) FILTER (WHERE businesses.can_settle_with_receipt = true AND
              (documents.type = ANY
              (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))                                                                                          AS receipt_event_amount,
        sum(documents.total_amount *
          CASE
            WHEN documents.creditor_id = charges.owner_id THEN 1
            ELSE '-1'::integer
            END::double precision) FILTER (WHERE documents.type = ANY
              (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))                                         AS invoice_event_amount,
        sum(documents.vat_amount *
          CASE
            WHEN documents.creditor_id = charges.owner_id THEN 1
            ELSE '-1'::integer
            END::double precision) FILTER (WHERE businesses.can_settle_with_receipt = true AND
              (documents.type = ANY
              (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])))                                                                                          AS receipt_vat_amount,
        sum(documents.vat_amount *
          CASE
            WHEN documents.creditor_id = charges.owner_id THEN 1
            ELSE '-1'::integer
            END::double precision) FILTER (WHERE documents.type = ANY
              (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))                                         AS invoice_vat_amount,
        count(*) FILTER (WHERE documents.type = ANY
          (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type]))                                                       AS invoices_count,
        count(*) FILTER (WHERE documents.type = ANY
          (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type]))                                                                                                         AS receipts_count,
        count(*)                                                                                                                                                                                                          AS documents_count,
        count(*) FILTER (WHERE (documents.type = ANY
          (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AND
          (documents.debtor_id IS NULL OR documents.creditor_id IS NULL OR
          documents.date IS NULL OR documents.serial_number IS NULL OR
          documents.vat_amount IS NULL OR documents.total_amount IS NULL OR
          documents.charge_id IS NULL OR
          documents.currency_code IS NULL) OR
          documents.type = 'UNPROCESSED'::accounter_schema.document_type) > 0                                                                                                                                               AS invalid_documents,
          array_agg(documents.currency_code) FILTER (WHERE
            businesses.can_settle_with_receipt = true AND (documents.type = ANY
              (ARRAY ['RECEIPT'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type])) OR
            (documents.type = ANY
              (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])))                                                                        AS currency_array
      FROM accounter_schema.documents
    LEFT JOIN accounter_schema.charges ON documents.charge_id = charges.id
    LEFT JOIN accounter_schema.businesses ON documents.creditor_id = charges.owner_id AND
      documents.debtor_id = businesses.id OR
      documents.creditor_id = businesses.id AND
      documents.debtor_id = charges.owner_id
      GROUP BY documents.charge_id) d ON d.charge_id = c.id
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
                                  CASE
                                      WHEN transactions_fees.id IS NULL THEN false
                                      ELSE true
                                      END AS is_fee
                            FROM accounter_schema.transactions
                                    LEFT JOIN accounter_schema.transactions_fees
                                              ON transactions.id = transactions_fees.id
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
                        LEFT JOIN accounter_schema.charges ON base.charge_id = charges.id) b2
              ON b2.charge_id = c.id
    LEFT JOIN accounter_schema.businesses b
              ON b.id = b2.filtered_business_array[1] AND array_length(b2.filtered_business_array, 1) = 1
    LEFT JOIN accounter_schema.business_tax_category_match tcm
              ON tcm.business_id = b.id AND tcm.owner_id = c.owner_id
    LEFT JOIN (SELECT tags_1.charge_id,
                      array_agg(tags_1.tag_id) AS tags_array
                FROM accounter_schema.charge_tags tags_1
                GROUP BY tags_1.charge_id) tags_table ON c.id = tags_table.charge_id
    LEFT JOIN accounter_schema.business_trip_charges btc ON btc.charge_id = c.id
    LEFT JOIN (SELECT count(DISTINCT l2.id)                                             AS ledger_count,
                      array_remove(array_agg(DISTINCT l2.financial_entity), NULL::uuid) AS ledger_financial_entities,
                      min(l2.value_date)                                  AS min_value_date,
                      max(l2.value_date)                                  AS max_value_date,
                      min(l2.invoice_date)                                AS min_invoice_date,
                      max(l2.invoice_date)                                AS max_invoice_date,
                      l2.charge_id
                FROM (SELECT ledger_records.charge_id,
                            ledger_records.id,
                            ledger_records.value_date,
                            ledger_records.invoice_date,
                            unnest(ARRAY [ledger_records.credit_entity1, ledger_records.credit_entity2, ledger_records.debit_entity1, ledger_records.debit_entity2]) AS financial_entity
                      FROM accounter_schema.ledger_records) l2
                GROUP BY l2.charge_id) l ON l.charge_id = c.id
    LEFT JOIN years_of_relevance y
      ON y.charge_id = c.id;
`,
} satisfies MigrationExecutor;
