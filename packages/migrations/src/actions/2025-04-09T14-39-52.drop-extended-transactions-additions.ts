import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-04-09T14-39-52.drop-extended-transactions-additions.sql',
  run: ({ sql }) => sql`
create or replace view accounter_schema.extended_charges
  (id, owner_id, is_property, accountant_status, user_description, created_at, updated_at, tax_category_id,
   event_amount, transactions_min_event_date, transactions_max_event_date, transactions_min_debit_date,
   transactions_max_debit_date, transactions_event_amount, transactions_currency, transactions_count,
   invalid_transactions, documents_min_date, documents_max_date, documents_event_amount, documents_vat_amount,
   documents_currency, invoices_count, receipts_count, documents_count, invalid_documents, business_array,
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
                          max(documents.date) FILTER (WHERE documents.type = ANY
                                                            (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])) AS max_event_date,
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
                               (ARRAY ['INVOICE'::accounter_schema.document_type, 'INVOICE_RECEIPT'::accounter_schema.document_type, 'CREDIT_INVOICE'::accounter_schema.document_type])))                                                                        AS currency_array
                   FROM accounter_schema.documents
                            LEFT JOIN accounter_schema.charges ON documents.charge_id = charges.id
                            LEFT JOIN accounter_schema.businesses
                                      ON documents.creditor_id = charges.owner_id AND
                                         documents.debtor_id = businesses.id OR
                                         documents.creditor_id = businesses.id AND
                                         documents.debtor_id = charges.owner_id
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
documents_by_charge.min_event_date                                                           AS documents_min_date,
documents_by_charge.max_event_date                                                           AS documents_max_date,
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

drop table accounter_schema.transactions_fees;

-- create and populate new transaction origin key column

alter table accounter_schema.transactions
    add origin_key text;

UPDATE accounter_schema.transactions t
SET origin_key = COALESCE(trl.creditcard_id::text, trl.poalim_ils_id::text,
                          trl.poalim_eur_id::text, trl.poalim_gbp_id::text,
                          trl.poalim_swift_id::text, trl.poalim_usd_id::text, trl.kraken_id,
                          trl.etana_id, trl.etherscan_id::text, trl.amex_id::text,
                          trl.cal_id::text, trl.bank_discount_id::text, trl.poalim_cad_id::text,
                          trl.max_creditcard_id::text)
FROM accounter_schema.transactions_raw_list trl
WHERE trl.id = t.source_id;

alter table accounter_schema.transactions
    alter column origin_key set not null;

-- update triggers to use new transaction origin key column

create or replace function accounter_schema.insert_creditcard_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- filter summarize records
    IF (
           NEW.full_supplier_name_outbound NOT IN ('TOTAL FOR DATE', 'CASH ADVANCE FEE')
               OR NEW.full_supplier_name_outbound IS NULL
           ) AND (
           (NEW.supplier_name NOT IN ('סך חיוב בש"ח:', 'סך חיוב  ב-$:')
               AND NOT (NEW.supplier_name IN ('דמי כרטיס הנחה', 'פועלים- דמי כרט') AND NEW.payment_sum = 0.00))
               OR NEW.supplier_name IS NULL
           )
    THEN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (creditcard_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var id,
                                                 owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.card::TEXT;

        -- check if matching charge exists:
        -- TBD

        -- create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id)
            VALUES (owner_id_var)
            RETURNING id INTO charge_id_var;
        END IF;

        -- check if new record is fee
        -- TBD

        -- check if new record contains fees
        -- TBD

        -- create new transaction
        INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, source_reference,
                                                   source_origin, counter_account, origin_key)
        VALUES (account_id_var,
                charge_id_var,
                merged_id,
                CASE
                    WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                    WHEN NEW.full_supplier_name_heb IS NULL THEN (
                        COALESCE(NEW.full_supplier_name_outbound, '') ||
                        COALESCE('/' || NEW.city, '')
                        )
                    END,
                CAST(
                        (
                            CASE
                                WHEN NEW.currency_id = 'ש"ח' THEN 'ILS'
                                WHEN NEW.currency_id = 'NIS' THEN 'ILS'
                                WHEN NEW.currency_id = 'דולר' THEN 'USD'
                                WHEN NEW.currency_id = 'USD' THEN 'USD'
                                WHEN NEW.currency_id = 'EUR' THEN 'EUR'
                                WHEN NEW.currency_id = 'GBP' THEN 'GBP'
                                -- use ILS as default:
                                ELSE 'ILS' END
                            ) as accounter_schema.currency
                ),
                CASE
                    WHEN NEW.full_purchase_date IS NULL THEN to_date(NEW.full_purchase_date_outbound, 'DD/MM/YYYY')
                    WHEN NEW.full_purchase_date_outbound IS NULL THEN to_date(NEW.full_purchase_date, 'DD/MM/YYYY')
                    END,
                to_date(COALESCE(NEW.full_payment_date, NEW.charging_date), 'DD/MM/YYYY'),
                CASE
                    WHEN NEW.payment_sum IS NULL THEN (NEW.payment_sum_outbound * -1)
                    WHEN NEW.payment_sum_outbound IS NULL THEN (NEW.payment_sum * -1)
                    END,
                0,
                COALESCE(NEW.voucher_number::text,
                         NEW.voucher_number_ratz::text),
                'ISRACARD',
                CASE
                    WHEN NEW.supplier_id IS NOT NULL AND
                         NEW.supplier_id <> 0
                        THEN NEW.supplier_id::text::character varying
                    ELSE NEW.full_supplier_name_outbound
                    END,
                NEW.id::text);
    END IF;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_amex_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- filter summarize records
    IF (
           NEW.full_supplier_name_outbound NOT IN ('TOTAL FOR DATE', 'CASH ADVANCE FEE')
               OR NEW.full_supplier_name_outbound IS NULL
           ) AND (
           (NEW.supplier_name NOT IN ('סך חיוב בש"ח:', 'סך חיוב  ב-$:')
               AND NOT (NEW.supplier_name IN ('דמי כרטיס הנחה', 'פועלים- דמי כרט') AND NEW.payment_sum = 0.00))
               OR NEW.supplier_name IS NULL
           )
    THEN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (amex_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var id,
                                                 owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.card::TEXT;

        -- check if matching charge exists:
        -- TBD

        -- create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id)
            VALUES (owner_id_var)
            RETURNING id INTO charge_id_var;
        END IF;

        -- check if new record is fee
        -- TBD

        -- check if new record contains fees
        -- TBD

        -- create new transaction
        INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, source_reference,
                                                   source_origin, counter_account, origin_key)
        VALUES (account_id_var,
                charge_id_var,
                merged_id,
                CASE
                    WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                    WHEN NEW.full_supplier_name_heb IS NULL THEN (
                        COALESCE(NEW.full_supplier_name_outbound, '') ||
                        COALESCE('/' || NEW.city, '')
                        )
                    END,
                CAST(
                        (
                            CASE
                                WHEN NEW.currency_id = 'ש"ח' THEN 'ILS'
                                WHEN NEW.currency_id = 'NIS' THEN 'ILS'
                                WHEN NEW.currency_id = 'דולר' THEN 'USD'
                                WHEN NEW.currency_id = 'USD' THEN 'USD'
                                WHEN NEW.currency_id = 'EUR' THEN 'EUR'
                                WHEN NEW.currency_id = 'GBP' THEN 'GBP'
                                -- use ILS as default:
                                ELSE 'ILS' END
                            ) as accounter_schema.currency
                ),
                CASE
                    WHEN NEW.full_purchase_date IS NULL THEN to_date(NEW.full_purchase_date_outbound, 'DD/MM/YYYY')
                    WHEN NEW.full_purchase_date_outbound IS NULL THEN to_date(NEW.full_purchase_date, 'DD/MM/YYYY')
                    END,
                to_date(COALESCE(NEW.full_payment_date, NEW.charging_date), 'DD/MM/YYYY'),
                CASE
                    WHEN NEW.payment_sum IS NULL THEN (NEW.payment_sum_outbound * -1)
                    WHEN NEW.payment_sum_outbound IS NULL THEN (NEW.payment_sum * -1)
                    END,
                0,
                COALESCE(NEW.voucher_number::text,
                         NEW.voucher_number_ratz::text),
                'AMEX',
                CASE
                    WHEN NEW.supplier_id IS NOT NULL AND
                         NEW.supplier_id <> 0
                        THEN NEW.supplier_id::text::character varying
                    ELSE NEW.full_supplier_name_outbound
                    END,
                NEW.id::text);
    END IF;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_max_creditcard_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- filter summarize records
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (max_creditcard_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT id, owner
    INTO account_id_var, owner_id_var
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.short_card_number;

    IF account_id_var IS NULL THEN
        RAISE EXCEPTION 'No matching account found for card number: %', NEW.short_card_number;
    END IF;

    -- check if matching charge exists:
    -- TBD

    -- create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    -- TBD

    -- check if new record contains fees
    -- TBD

    IF NOT (NEW.original_currency = 'ILS') THEN
        RAISE EXCEPTION 'Unknown currency: %', NEW.original_currency;
    END IF;

    IF (NEW.actual_payment_amount IS NULL) THEN
        RAISE EXCEPTION 'Transaction amount cannot be null';
    END IF;

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               currency_rate, debit_timestamp, source_origin, counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            CONCAT_WS(' | ', NEW.merchant_name, NEW.comments),
            CAST(
                    (
                        CASE
                            WHEN NEW.original_currency = 'ILS' THEN 'ILS'
                            -- use ILS as default:
                            ELSE 'ILS' END
                        ) as accounter_schema.currency
            ),
            NEW.purchase_date,
            NEW.payment_date,
            NEW.actual_payment_amount * -1,
            0,
            NEW.arn,
            NEW.deal_data_exchange_rate,
            NEW.payment_date +
            NEW.deal_data_purchase_time,
            'MAX',
            CASE
                WHEN NEW.merchant_tax_id::text <> ''::text
                    THEN NEW.merchant_tax_id::text
                ELSE NEW.merchant_name
                END, NEW.id);

    RETURN NEW;
END ;
$$;

create or replace function accounter_schema.insert_poalim_ils_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_ils_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (22, 23)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_usd_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (
        (new.activity_type_code = 452 AND new.text_code IN (105, 547))
            OR (new.activity_type_code = 473 AND new.text_code IN (378, 395, 437, 502, 602, 603, 716, 771, 774))
        ) THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               source_origin, counter_account, is_fee, origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.beneficiary_details_data_party_name, ''),
                    ' ',
                    coalesce(new.beneficiary_details_data_message_detail, ''),
                    ' ',
                    coalesce(new.english_action_desc, '')
            ),
            'ILS',
            new.event_date::text::date,
            new.event_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            new.reference_number::text,
            'POALIM',
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END,
            is_fee,
            NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_eur_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_eur_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code in (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_usd_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'EUR',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END, NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_gbp_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_gbp_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'usd' AS currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_usd_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id,
                                       tr.poalim_usd_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'GBP',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END, NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$

create or replace function accounter_schema.insert_poalim_cad_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_cad_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- handle bank deposits
    IF (new.activity_type_code IN (1376, 1384, 169, 171, 172)) THEN
        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (113, 117, 457)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'CAD',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END, NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_usd_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
    transaction_id_var UUID    = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_usd_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT;

    -- handle conversions
    IF (new.activity_type_code IN (884, 957, 1058)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id,
                                       tr.poalim_usd_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- handle bank deposits
    IF (new.activity_type_code IN (1376, 1384, 169, 171, 172)) THEN
        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT 'eur', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'gbp', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'cad', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              WHERE activity_type_code IN (1376, 1384)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (113, 117, 457)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id,
                                       tr.poalim_cad_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND s.reference_number = NEW.reference_number
          AND s.reference_catenated_number = NEW.reference_catenated_number
          AND s.value_date = NEW.value_date;
    END IF;

    -- if no match, create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id, type)
        VALUES (owner_id_var,
                CASE WHEN is_conversion IS TRUE THEN 'CONVERSION'::accounter_schema.charge_type END)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    IF (new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
    THEN
        is_fee = true;
    END IF;

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat(
                    new.activity_description,
                    ' ',
                    coalesce(new.event_details, ''),
                    ' ',
                    coalesce(new.account_name, '')
            ),
            'USD',
            new.executing_date::text::date,
            new.value_date::text::date,
            (CASE
                 WHEN new.event_activity_type_code = 2 THEN (new.event_amount * -1)
                 ELSE new.event_amount END
                ),
            new.current_balance,
            is_fee,
            new.reference_number::text,
            'POALIM',
            NEW.currency_rate,
            CASE
                WHEN new.contra_account_number <> 0 THEN concat(
                        new.contra_bank_number, '-',
                        new.contra_branch_number, '-',
                        new.contra_account_number)
                ELSE NULL::text
                END,
            NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_swift_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID = NULL;
    transaction_amount NUMERIC;
    fee_amount         NUMERIC;
    currency_code      accounter_schema.currency;
    transaction_id_var UUID = NULL;
BEGIN
    transaction_amount := REPLACE(
            RIGHT(NEW.swift_currency_instructed_amount_33b, LENGTH(NEW.swift_currency_instructed_amount_33b) - 3), ',',
            '.')::NUMERIC;
    fee_amount := transaction_amount - REPLACE(
            RIGHT(NEW.swift_value_date_currency_amount_32a, LENGTH(NEW.swift_value_date_currency_amount_32a) - 9), ',',
            '.')::NUMERIC;
    currency_code := LEFT(NEW.swift_currency_instructed_amount_33b, 3)::accounter_schema.currency;

    IF (fee_amount > 0) THEN
        -- Create merged raw transactions record:
        INSERT INTO accounter_schema.transactions_raw_list (poalim_swift_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- get account and owner IDs
        SELECT INTO account_id_var, owner_id_var id,
                                                 owner
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account_number::TEXT;

        -- check if matching charge exists for source:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT formatted_value_date, event_details, id, 'GBP' as currency, event_amount
              FROM accounter_schema.poalim_gbp_account_transactions
              UNION
              SELECT formatted_value_date, event_details, id, 'EUR', event_amount
              FROM accounter_schema.poalim_eur_account_transactions
              UNION
              SELECT formatted_value_date, event_details, id, 'CAD', event_amount
              FROM accounter_schema.poalim_cad_account_transactions
              UNION
              SELECT formatted_value_date, event_details, id, 'USD', event_amount
              FROM accounter_schema.poalim_usd_account_transactions) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id,
                                       tr.poalim_usd_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
            AND (s.formatted_value_date = NEW.formatted_start_date
                OR s.formatted_value_date = NEW.formatted_start_date)
            AND currency_code::text = s.currency
            AND (s.event_details LIKE '%' || TRIM(LEFT(NEW.charge_party_name, 13)) || '%'
                AND NEW.amount::NUMERIC = s.event_amount)
           OR (transaction_amount * -1 = s.event_amount);

        -- if no match, create new charge
        IF (charge_id_var IS NULL) THEN
            INSERT INTO accounter_schema.charges (owner_id)
            VALUES (owner_id_var)
            RETURNING id INTO charge_id_var;
        END IF;

        -- create new transaction for fee
        INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, business_id, is_fee,
                                                   source_reference, counter_account, source_origin, origin_key)
        VALUES (account_id_var,
                charge_id_var,
                merged_id,
                CONCAT_WS(' ',
                          'Swift Fee:',
                          NEW.charge_party_name,
                          NEW.reference_number
                ),
                currency_code,
                NEW.formatted_start_date::DATE,
                new.formatted_start_date::DATE,
                fee_amount * -1,
                0,
                NULL,
                TRUE,
                NEW.reference_number,
                'SWIFT',
                'POALIM',
                NEW.id)
        RETURNING id INTO transaction_id_var;
    END IF;
    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_poalim_deposit_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID = NULL;
    transaction_id_var UUID = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (poalim_deposit_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = CONCAT('poalim_deposit_', NEW.deposit_key::TEXT);

    -- create new charge
    INSERT INTO accounter_schema.charges (owner_id, type)
    VALUES (owner_id_var, 'BANK_DEPOSIT'::accounter_schema.charge_type)
    RETURNING id INTO charge_id_var;

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               source_origin, origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            new.currency,
            new.date::text::date,
            new.date::text::date,
            new.amount, 0,
            NEW.deposit_key,
            'POALIM', NEW.id)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_cal_creditcard_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (cal_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.card::TEXT;

    -- check if matching charge exists:
    -- TBD

    -- create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;
    END IF;

    -- check if new record is fee
    -- TBD

    -- check if new record contains fees
    -- TBD

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id,
                                               charge_id,
                                               source_id,
                                               source_description,
                                               currency,
                                               event_date,
                                               debit_date,
                                               amount,
                                               current_balance,
                                               source_reference,
                                               source_origin,
                                               counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            NEW.merchant_name,
            CAST(NEW.trn_currency_symbol as accounter_schema.currency),
            to_date(NEW.trn_purchase_date, 'DD/MM/YYYY'),
            to_date(NEW.deb_crd_date, 'DD/MM/YYYY'),
            NEW.trn_amt * -1,
            0,
            NEW.trn_int_id,
            'CAL',
            COALESCE(NEW.merchant_id,
                     NEW.merchant_name),
            NEW.id);

    RETURN NEW;
END;
$$;

create or replace function accounter_schema.insert_bank_discount_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
BEGIN
    -- Create merged raw transactions record:
    INSERT INTO accounter_schema.transactions_raw_list (bank_discount_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;
    -- get account and owner IDs
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number
      AND branch_number = NEW.operation_branch
      AND bank_number = NEW.operation_bank;
    -- check if matching charge exists:
    -- TBD
    -- create new charge
    IF (charge_id_var IS NULL) THEN
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;
    END IF;
    -- check if new record is fee
    -- TBD
    -- check if new record contains fees
    -- TBD
    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id,
                                               charge_id,
                                               source_id,
                                               source_description,
                                               currency,
                                               event_date,
                                               debit_date,
                                               amount,
                                               current_balance,
                                               source_reference,
                                               source_origin,
                                               counter_account,
                                               origin_key)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            NEW.operation_description,
            'ILS'::accounter_schema.currency,
            to_date(NEW.operation_date, 'DD/MM/YYYY'),
            to_date(NEW.value_date, 'DD/MM/YYYY'),
            NEW.operation_amount * -1,
            NEW.balance_after_operation,
            NEW.urn,
            'BANK_DISCOUNT',
            CASE
                WHEN NEW.operation_number IS NOT NULL AND
                     NEW.operation_number <> 0 THEN concat(
                        NEW.operation_bank, '-',
                        NEW.operation_branch, '-',
                        NEW.operation_number)
                ELSE NULL::text
                END,
            NEW.id);
    RETURN NEW;
END;
$$;
`,
} satisfies MigrationExecutor;
