import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-11-145T12-15-43.origin-scraper-tables-adjustments.sql',
  run: ({ sql }) => sql`
  -- adjust existing tables to match new scraper data
    alter table accounter_schema.poalim_ils_account_transactions
      alter column english_action_desc type varchar(20) using english_action_desc::varchar(20);

  -- enable amex transactions
    alter table accounter_schema.transactions_raw_list
        add amex_id uuid;

    alter table accounter_schema.transactions_raw_list
        drop constraint transactions_raw_list_check;

    alter table accounter_schema.transactions_raw_list
        add constraint transactions_raw_list_check
            check ((((((((((((creditcard_id IS NOT NULL))::integer + ((poalim_ils_id IS NOT NULL))::integer) +
                          ((poalim_eur_id IS NOT NULL))::integer) + ((poalim_gbp_id IS NOT NULL))::integer) +
                        ((poalim_usd_id IS NOT NULL))::integer) + ((poalim_swift_id IS NOT NULL))::integer) +
                      ((kraken_id IS NOT NULL))::integer) + ((etana_id IS NOT NULL))::integer) +
                    ((etherscan_id IS NOT NULL))::integer) + (amex_id IS NOT NULL)::integer) = 1);

    create or replace function accounter_schema.insert_amex_transaction_handler() returns trigger
        language plpgsql
    as
    $$
          DECLARE
              merged_id UUID;
              account_id_var UUID;
              owner_id_var UUID;
              charge_id_var UUID = NULL;
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
                  SELECT INTO account_id_var, owner_id_var
                      id, owner
                  FROM accounter_schema.financial_accounts
                  WHERE account_number = NEW.card::TEXT;

                  -- check if matching charge exists:
                  -- TBD

                  -- create new charge
                  IF (charge_id_var IS NULL) THEN
                      INSERT INTO accounter_schema.charges (owner_id)
                      VALUES (
                          owner_id_var
                      )
                      RETURNING id INTO charge_id_var;
                  END IF;

                  -- check if new record is fee
                  -- TBD

                  -- check if new record contains fees
                  -- TBD

                  -- create new transaction
                  INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance)
                  VALUES (
                      account_id_var,
                      charge_id_var,
                      merged_id,
                      CASE
                          WHEN NEW.full_supplier_name_outbound IS NULL THEN NEW.full_supplier_name_heb
                          WHEN NEW.full_supplier_name_heb IS NULL THEN (
                              COALESCE(NEW.full_supplier_name_outbound, '') ||
                              COALESCE('/' || NEW.city, '')
                          )
                      END,
                      CAST (
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
                      0
                  );
              END IF;

              RETURN NEW;
          END;
          $$;

    create table if not exists accounter_schema.amex_creditcard_transactions
    (
        specific_date                     varchar(30),
        card_index                        integer                        not null,
        deals_inbound                     varchar(3),
        supplier_id                       integer,
        supplier_name                     varchar(15),
        deal_sum_type                     varchar(1),
        payment_sum_sign                  varchar(1),
        purchase_date                     varchar(5),
        full_purchase_date                text,
        more_info                         varchar(30),
        horaat_keva                       varchar(1),
        voucher_number                    integer,
        voucher_number_ratz               integer,
        solek                             varchar(1),
        purchase_date_outbound            varchar(5),
        full_purchase_date_outbound       text,
        currency_id                       varchar(4),
        current_payment_currency          varchar(3),
        city                              varchar(10),
        supplier_name_outbound            varchar(15),
        full_supplier_name_outbound       varchar(20),
        payment_date                      varchar(5),
        full_payment_date                 text,
        is_show_deals_outbound            varchar(1),
        adendum                           varchar(30),
        voucher_number_ratz_outbound      integer,
        is_show_link_for_supplier_details varchar(3),
        deal_sum                          varchar(12),
        payment_sum                       numeric(8, 2),
        full_supplier_name_heb            varchar(20),
        deal_sum_outbound                 numeric(9, 2),
        payment_sum_outbound              numeric(8, 2),
        is_horaat_keva                    varchar(5)                     not null,
        stage                             varchar(30),
        return_code                       varchar(30),
        message                           varchar(30),
        return_message                    varchar(30),
        display_properties                varchar(30),
        table_page_num                    bit                            not null,
        is_error                          varchar(5)                     not null,
        is_captcha                        varchar(5)                     not null,
        is_button                         varchar(5)                     not null,
        site_name                         varchar(30),
        client_ip_address                 varchar(30),
        card                              integer                        not null,
        id                                uuid default gen_random_uuid() not null
            constraint amex_creditcard_transactions_pk
                primary key,
        charging_date                     text,
        kod_matbea_mekori                 text
    );

    DROP VIEW accounter_schema.extended_business_trip_transactions;
    DROP VIEW accounter_schema.extended_charges;
    DROP VIEW accounter_schema.extended_transactions;

    create or replace view accounter_schema.extended_transactions
                (id, charge_id, business_id, currency, debit_date, debit_timestamp, source_debit_date, event_date,
                account_id, account_type, amount, current_balance, source_description, source_details, created_at,
                updated_at, source_id, source_reference, source_origin, currency_rate, is_fee, charge_type, owner_id)
    as
    WITH original_transaction AS (SELECT isracard_creditcard_transactions.id::text                              AS raw_id,
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
                                  FROM accounter_schema.etherscan_transactions),
        alt_debit_date AS (SELECT p.event_date,
                                  p.reference_number
                            FROM accounter_schema.poalim_ils_account_transactions p
                            WHERE p.activity_type_code = 491
                            ORDER BY p.event_date DESC)
    SELECT DISTINCT ON (t.id) t.id,
                              t.charge_id,
                              t.business_id,
                              t.currency,
                              CASE
                                  WHEN original_transaction.origin = 'ISRACARD'::text AND
                                      t.currency = 'ILS'::accounter_schema.currency AND t.debit_date IS NULL AND
                                      t.debit_date_override IS NULL THEN alt_debit_date.event_date
                                  ELSE COALESCE(t.debit_date_override, t.debit_date)
                                  END                               AS debit_date,
                              original_transaction.debit_timestamp,
                              t.debit_date                          AS source_debit_date,
                              t.event_date,
                              t.account_id,
                              a.type                                AS account_type,
                              t.amount,
                              t.current_balance,
                              t.source_description,
                              original_transaction.source_details,
                              t.created_at,
                              t.updated_at,
                              original_transaction.raw_id           AS source_id,
                              original_transaction.reference_number AS source_reference,
                              original_transaction.origin           AS source_origin,
                              original_transaction.currency_rate,
                              CASE
                                  WHEN f.id IS NULL THEN false
                                  ELSE true
                                  END                               AS is_fee,
                              c.type                                AS charge_type,
                              c.owner_id
    FROM accounter_schema.transactions t
            LEFT JOIN accounter_schema.transactions_raw_list rt ON t.source_id = rt.id
            LEFT JOIN accounter_schema.charges c ON c.id = t.charge_id
            LEFT JOIN accounter_schema.financial_accounts a ON a.id = t.account_id
            LEFT JOIN accounter_schema.transactions_fees f ON f.id = t.id
            LEFT JOIN original_transaction ON original_transaction.raw_id =
                                              COALESCE(rt.creditcard_id::text, rt.poalim_ils_id::text,
                                                        rt.poalim_eur_id::text, rt.poalim_gbp_id::text,
                                                        rt.poalim_swift_id::text, rt.poalim_usd_id::text, rt.kraken_id,
                                                        rt.etana_id, rt.etherscan_id::text, rt.amex_id::text)
            LEFT JOIN alt_debit_date ON alt_debit_date.reference_number = original_transaction.card_number AND
                                        alt_debit_date.event_date > t.event_date AND
                                        alt_debit_date.event_date < (t.event_date + '40 days'::interval) AND
                                        alt_debit_date.event_date = ((SELECT min(add.event_date) AS min
                                                                      FROM alt_debit_date add
                                                                      WHERE add.reference_number = original_transaction.card_number
                                                                        AND add.event_date > t.event_date
                                                                        AND add.event_date < (t.event_date + '40 days'::interval)));

    create or replace view accounter_schema.extended_charges
                (id, owner_id, is_property, accountant_status, user_description, created_at, updated_at, tax_category_id,
                event_amount, transactions_min_event_date, transactions_max_event_date, transactions_min_debit_date,
                transactions_max_debit_date, transactions_event_amount, transactions_currency, transactions_count,
                invalid_transactions, documents_min_date, documents_max_date, documents_event_amount, documents_vat_amount,
                documents_currency, invoices_count, receipts_count, documents_count, invalid_documents, business_array,
                business_id, can_settle_with_receipt, tags, business_trip_id, ledger_count, ledger_financial_entities,
                ledger_min_value_date, ledger_max_value_date, ledger_min_invoice_date, ledger_max_invoice_date,
                years_of_relevance, invoice_payment_currency_diff, type, optional_vat)
    as
    WITH years_of_relevance AS (SELECT charge_spread.charge_id,
                                      array_agg(charge_spread.year_of_relevance) AS years_of_relevance
                                FROM accounter_schema.charge_spread
                                GROUP BY charge_spread.charge_id),
        transactions_by_charge AS (SELECT extended_transactions.charge_id,
                                          min(extended_transactions.event_date)                                AS min_event_date,
                                          max(extended_transactions.event_date)                                AS max_event_date,
                                          min(extended_transactions.debit_date)                                AS min_debit_date,
                                          max(extended_transactions.debit_date)                                AS max_debit_date,
                                          sum(extended_transactions.amount)                                    AS event_amount,
                                          count(*)                                                             AS transactions_count,
                                          count(*) FILTER (WHERE extended_transactions.business_id IS NULL OR
                                                                  extended_transactions.debit_date IS NULL) >
                                          0                                                                    AS invalid_transactions,
                                          array_agg(DISTINCT extended_transactions.currency)                   AS currency_array,
                                          array_agg(extended_transactions.account_id)                          AS account
                                    FROM accounter_schema.extended_transactions
                                    GROUP BY extended_transactions.charge_id),
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
        businesses_by_charege AS (SELECT base.charge_id,
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
          businesses_by_charege.business_array,
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
          c.optional_vat
    FROM accounter_schema.charges c
            LEFT JOIN transactions_by_charge ON transactions_by_charge.charge_id = c.id
            LEFT JOIN documents_by_charge ON documents_by_charge.charge_id = c.id
            LEFT JOIN businesses_by_charege ON businesses_by_charege.charge_id = c.id
            LEFT JOIN accounter_schema.businesses b ON b.id = businesses_by_charege.filtered_business_array[1] AND
                                                        array_length(businesses_by_charege.filtered_business_array, 1) = 1
            LEFT JOIN accounter_schema.business_tax_category_match tcm
                      ON tcm.business_id = b.id AND tcm.owner_id = c.owner_id
            LEFT JOIN tags_by_charge ON c.id = tags_by_charge.charge_id
            LEFT JOIN accounter_schema.business_trip_charges btc ON btc.charge_id = c.id
            LEFT JOIN ledger_by_charge ON ledger_by_charge.charge_id = c.id
            LEFT JOIN years_of_relevance y ON y.charge_id = c.id
            LEFT JOIN accounter_schema.depreciation d ON d.charge_id = c.id;

    create or replace view accounter_schema.extended_business_trip_transactions
                (id, business_trip_id, transaction_ids, charge_ids, category, date, value_date, amount, currency,
                employee_business_id, payed_by_employee)
    as
    WITH transactions_by_business_trip_transaction AS (SELECT tm.business_trip_transaction_id,
                                                              array_agg(DISTINCT t1.id)        AS transaction_ids,
                                                              array_agg(DISTINCT t1.charge_id) AS charge_ids,
                                                              array_agg(DISTINCT t1.currency)  AS currencies,
                                                              sum(tm.amount)                   AS amount,
                                                              min(t1.event_date)               AS event_date,
                                                              min(t1.debit_date)               AS debit_date
                                                      FROM accounter_schema.business_trips_transactions_match tm
                                                                LEFT JOIN accounter_schema.extended_transactions t1 ON t1.id = tm.transaction_id
                                                      GROUP BY tm.business_trip_transaction_id)
    SELECT DISTINCT ON (btt.id) btt.id,
                                btt.business_trip_id,
                                t.transaction_ids,
                                t.charge_ids,
                                btt.category,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.date
                                    ELSE t.event_date
                                    END                                AS date,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.value_date
                                    ELSE t.debit_date
                                    END                                AS value_date,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN
                                        CASE
                                            WHEN ep.amount IS NULL THEN NULL::numeric
                                            ELSE ep.amount * '-1'::integer::numeric
                                            END
                                    WHEN array_length(t.currencies, 1) = 1 THEN t.amount
                                    ELSE NULL::numeric
                                    END                                AS amount,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.currency
                                    WHEN array_length(t.currencies, 1) = 1 THEN t.currencies[1]
                                    ELSE NULL::accounter_schema.currency
                                    END                                AS currency,
                                ep.employee_business_id,
                                t.business_trip_transaction_id IS NULL AS payed_by_employee
    FROM accounter_schema.business_trips_transactions btt
            LEFT JOIN transactions_by_business_trip_transaction t ON t.business_trip_transaction_id = btt.id
            LEFT JOIN accounter_schema.business_trips_employee_payments ep ON ep.id = btt.id;
`,
} satisfies MigrationExecutor;
