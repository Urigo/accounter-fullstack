import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-08-25T12-46-25.add-owner-to-extended-transactions.sql',
  run: ({ sql }) => sql`
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
                            c.owner_id                            AS owner_id
    FROM accounter_schema.transactions t
            LEFT JOIN accounter_schema.transactions_raw_list rt ON t.source_id = rt.id
            LEFT JOIN accounter_schema.charges c ON c.id = t.charge_id
            LEFT JOIN accounter_schema.financial_accounts a ON a.id = t.account_id
            LEFT JOIN accounter_schema.transactions_fees f ON f.id = t.id
            LEFT JOIN original_transaction ON original_transaction.raw_id =
                                            COALESCE(rt.creditcard_id::text, rt.poalim_ils_id::text,
                                                    rt.poalim_eur_id::text, rt.poalim_gbp_id::text,
                                                    rt.poalim_swift_id::text, rt.poalim_usd_id::text, rt.kraken_id,
                                                    rt.etana_id, rt.etherscan_id::text)
            LEFT JOIN alt_debit_date ON alt_debit_date.reference_number = original_transaction.card_number AND
                                    alt_debit_date.event_date > t.event_date AND
                                    alt_debit_date.event_date < (t.event_date + '40 days'::interval) AND
                                    alt_debit_date.event_date = ((SELECT min(add.event_date) AS min
                                                                    FROM alt_debit_date add
                                                                    WHERE add.reference_number = original_transaction.card_number
                                                                    AND add.event_date > t.event_date
                                                                    AND add.event_date < (t.event_date + '40 days'::interval)));
`,
} satisfies MigrationExecutor;
