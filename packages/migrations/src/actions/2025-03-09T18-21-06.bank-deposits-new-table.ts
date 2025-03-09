import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-03-09T18-21-06.bank-deposits-new-table.sql',
  run: ({ sql }) => sql`
-------------------------
-- Create source table --
-------------------------

create table if not exists accounter_schema.poalim_deposits_account_transactions_manual
(
    id          uuid default gen_random_uuid() not null
        constraint poalim_deposits_account_transactions_manual_pk
            primary key,
    deposit_key text                           not null,
    date        date,
    amount      numeric(9, 2)                  not null,
    currency    accounter_schema.currency      not null
);

create index if not exists poalim_deposits_account_transactions_manual_date_index
    on accounter_schema.poalim_deposits_account_transactions_manual (date);

create index if not exists poalim_deposits_account_transactions_manual_deposit_key_index
    on accounter_schema.poalim_deposits_account_transactions_manual (deposit_key);

ALTER TYPE accounter_schema.financial_account_type ADD VALUE 'BANK_DEPOSIT_ACCOUNT';

ALTER TYPE accounter_schema.charge_type ADD VALUE 'BANK_DEPOSIT';

-------------------------------------------------
-- update transaction_raw_list table and check --
-------------------------------------------------

alter table accounter_schema.transactions_raw_list
    add poalim_deposit_id uuid;
create unique index transactions_raw_list_poalim_deposit_id_uindex
    on accounter_schema.transactions_raw_list (poalim_deposit_id);
alter table accounter_schema.transactions_raw_list
    add foreign key (poalim_deposit_id) references accounter_schema.poalim_deposits_account_transactions_manual;
alter table accounter_schema.transactions_raw_list
    drop constraint transactions_raw_list_check;
alter table accounter_schema.transactions_raw_list
    add constraint transactions_raw_list_check
        check ((creditcard_id IS NOT NULL)::integer + (poalim_ils_id IS NOT NULL)::integer +
               (poalim_eur_id IS NOT NULL)::integer + (poalim_gbp_id IS NOT NULL)::integer +
               (poalim_usd_id IS NOT NULL)::integer + (poalim_swift_id IS NOT NULL)::integer +
               (kraken_id IS NOT NULL)::integer + (etana_id IS NOT NULL)::integer +
               (etherscan_id IS NOT NULL)::integer + (amex_id IS NOT NULL)::integer + (cal_id IS NOT NULL)::integer +
               (bank_discount_id IS NOT NULL)::integer + (transactions_raw_list.poalim_cad_id IS NOT NULL)::integer +
               (max_creditcard_id IS NOT NULL)::integer + (transactions_raw_list.poalim_deposit_id IS NOT NULL)::integer = 1);

----------------------------------------------
-- create new transaction insertion trigger --
----------------------------------------------

create or replace function accounter_schema.insert_poalim_deposit_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    transaction_id_var UUID    = NULL;
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
                                               event_date, debit_date, amount, current_balance)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            new.currency,
            new.data::text::date,
            new.date::text::date,
            new.amount, 0)
    RETURNING id INTO transaction_id_var;

    RETURN NEW;
END;
$$;

create trigger poalim_deposit_insert_trigger
    after insert
    on accounter_schema.poalim_deposits_account_transactions_manual
    for each row
execute procedure accounter_schema.insert_poalim_deposit_transaction_handler();

------------------------------
-- update transactions view --
------------------------------

create or replace view accounter_schema.extended_transactions
            (id, charge_id, business_id, currency, debit_date, debit_timestamp, source_debit_date, event_date,
             account_id, account_type, amount, current_balance, source_description, source_details, created_at,
             updated_at, source_id, source_reference, source_origin, currency_rate, is_fee, charge_type, owner_id,
             counter_account)
as
WITH original_transaction AS (SELECT isracard_creditcard_transactions.id::text                              AS raw_id,
                                     COALESCE(isracard_creditcard_transactions.voucher_number::text,
                                              isracard_creditcard_transactions.voucher_number_ratz::text)   AS reference_number,
                                     0                                                                      AS currency_rate,
                                     NULL::timestamp without time zone                                      AS debit_timestamp,
                                     'ISRACARD'::text                                                       AS origin,
                                     isracard_creditcard_transactions.card                                  AS card_number,
                                     COALESCE(isracard_creditcard_transactions.full_supplier_name_heb,
                                              isracard_creditcard_transactions.full_supplier_name_outbound) AS source_details,
                                     CASE
                                         WHEN isracard_creditcard_transactions.supplier_id IS NOT NULL AND
                                              isracard_creditcard_transactions.supplier_id <> 0
                                             THEN isracard_creditcard_transactions.supplier_id::text::character varying
                                         ELSE isracard_creditcard_transactions.full_supplier_name_outbound
                                         END                                                                AS counter_account
                              FROM accounter_schema.isracard_creditcard_transactions
                              UNION
                              SELECT amex_creditcard_transactions.id::text                              AS raw_id,
                                     COALESCE(amex_creditcard_transactions.voucher_number::text,
                                              amex_creditcard_transactions.voucher_number_ratz::text)   AS reference_number,
                                     0                                                                  AS currency_rate,
                                     NULL::timestamp without time zone                                  AS debit_timestamp,
                                     'AMEX'::text                                                       AS origin,
                                     amex_creditcard_transactions.card                                  AS card_number,
                                     COALESCE(amex_creditcard_transactions.full_supplier_name_heb,
                                              amex_creditcard_transactions.full_supplier_name_outbound) AS source_details,
                                     CASE
                                         WHEN amex_creditcard_transactions.supplier_id IS NOT NULL AND
                                              amex_creditcard_transactions.supplier_id <> 0
                                             THEN amex_creditcard_transactions.supplier_id::text::character varying
                                         ELSE amex_creditcard_transactions.full_supplier_name_outbound
                                         END                                                            AS counter_account
                              FROM accounter_schema.amex_creditcard_transactions
                              UNION
                              SELECT max_creditcard_transactions.id::text                   AS raw_id,
                                     max_creditcard_transactions.arn                        AS reference_number,
                                     max_creditcard_transactions.deal_data_exchange_rate    AS currency_rate,
                                     max_creditcard_transactions.payment_date +
                                     max_creditcard_transactions.deal_data_purchase_time    AS debit_timestamp,
                                     'MAX'::text                                            AS origin,
                                     max_creditcard_transactions.short_card_number::integer AS card_number,
                                     concat_ws(' | '::text, max_creditcard_transactions.merchant_name,
                                               max_creditcard_transactions.merchant_commercial_name,
                                               max_creditcard_transactions.comments)        AS source_details,
                                     CASE
                                         WHEN max_creditcard_transactions.merchant_tax_id IS NOT NULL AND
                                              max_creditcard_transactions.merchant_tax_id::text <> ''::text
                                             THEN max_creditcard_transactions.merchant_tax_id::text
                                         ELSE max_creditcard_transactions.merchant_name
                                         END                                                AS counter_account
                              FROM accounter_schema.max_creditcard_transactions
                              UNION
                              SELECT poalim_ils_account_transactions.id::text                                AS id,
                                     poalim_ils_account_transactions.reference_number::text                  AS reference_number,
                                     0                                                                       AS currency_rate,
                                     NULL::timestamp without time zone                                       AS debit_timestamp,
                                     'POALIM'::text                                                          AS origin,
                                     NULL::integer                                                           AS card_number,
                                     poalim_ils_account_transactions.beneficiary_details_data_message_detail AS source_details,
                                     CASE
                                         WHEN poalim_ils_account_transactions.contra_account_number IS NOT NULL AND
                                              poalim_ils_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_ils_account_transactions.contra_bank_number, '-',
                                                 poalim_ils_account_transactions.contra_branch_number, '-',
                                                 poalim_ils_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                                 AS counter_account
                              FROM accounter_schema.poalim_ils_account_transactions
                              UNION
                              SELECT poalim_eur_account_transactions.id::text               AS id,
                                     poalim_eur_account_transactions.reference_number::text AS reference_number,
                                     poalim_eur_account_transactions.currency_rate,
                                     NULL::timestamp without time zone                      AS debit_timestamp,
                                     'POALIM'::text                                         AS origin,
                                     NULL::integer                                          AS card_number,
                                     poalim_eur_account_transactions.event_details          AS source_details,
                                     CASE
                                         WHEN poalim_eur_account_transactions.contra_account_number IS NOT NULL AND
                                              poalim_eur_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_eur_account_transactions.contra_bank_number, '-',
                                                 poalim_eur_account_transactions.contra_branch_number, '-',
                                                 poalim_eur_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                AS counter_account
                              FROM accounter_schema.poalim_eur_account_transactions
                              UNION
                              SELECT poalim_gbp_account_transactions.id::text               AS id,
                                     poalim_gbp_account_transactions.reference_number::text AS reference_number,
                                     poalim_gbp_account_transactions.currency_rate,
                                     NULL::timestamp without time zone                      AS debit_timestamp,
                                     'POALIM'::text                                         AS origin,
                                     NULL::integer                                          AS card_number,
                                     poalim_gbp_account_transactions.event_details          AS source_details,
                                     CASE
                                         WHEN poalim_gbp_account_transactions.contra_account_number IS NOT NULL AND
                                              poalim_gbp_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_gbp_account_transactions.contra_bank_number, '-',
                                                 poalim_gbp_account_transactions.contra_branch_number, '-',
                                                 poalim_gbp_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                AS counter_account
                              FROM accounter_schema.poalim_gbp_account_transactions
                              UNION
                              SELECT poalim_cad_account_transactions.id::text               AS id,
                                     poalim_cad_account_transactions.reference_number::text AS reference_number,
                                     poalim_cad_account_transactions.currency_rate,
                                     NULL::timestamp without time zone                      AS debit_timestamp,
                                     'POALIM'::text                                         AS origin,
                                     NULL::integer                                          AS card_number,
                                     poalim_cad_account_transactions.event_details          AS source_details,
                                     CASE
                                         WHEN poalim_cad_account_transactions.contra_account_number IS NOT NULL AND
                                              poalim_cad_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_cad_account_transactions.contra_bank_number, '-',
                                                 poalim_cad_account_transactions.contra_branch_number, '-',
                                                 poalim_cad_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                AS counter_account
                              FROM accounter_schema.poalim_cad_account_transactions
                              UNION
                              SELECT poalim_usd_account_transactions.id::text               AS id,
                                     poalim_usd_account_transactions.reference_number::text AS reference_number,
                                     poalim_usd_account_transactions.currency_rate,
                                     NULL::timestamp without time zone                      AS debit_timestamp,
                                     'POALIM'::text                                         AS origin,
                                     NULL::integer                                          AS card_number,
                                     poalim_usd_account_transactions.event_details          AS source_details,
                                     CASE
                                         WHEN poalim_usd_account_transactions.contra_account_number IS NOT NULL AND
                                              poalim_usd_account_transactions.contra_account_number <> 0 THEN concat(
                                                 poalim_usd_account_transactions.contra_bank_number, '-',
                                                 poalim_usd_account_transactions.contra_branch_number, '-',
                                                 poalim_usd_account_transactions.contra_account_number)
                                         ELSE NULL::text
                                         END                                                AS counter_account
                              FROM accounter_schema.poalim_usd_account_transactions
                              UNION
                              SELECT poalim_swift_account_transactions.id::text          AS id,
                                     poalim_swift_account_transactions.reference_number,
                                     0,
                                     NULL::timestamp without time zone                   AS debit_timestamp,
                                     'POALIM'::text                                      AS origin,
                                     NULL::integer                                       AS card_number,
                                     poalim_swift_account_transactions.charge_party_name AS source_details,
                                     'SWIFT'::character varying                          AS counter_account
                              FROM accounter_schema.poalim_swift_account_transactions
                              UNION
                              SELECT poalim_deposits_account_transactions_manual.id::text          AS id,
                                     poalim_deposits_account_transactions_manual.deposit_key,
                                     0,
                                     NULL::timestamp without time zone                   AS debit_timestamp,
                                     'POALIM'::text                                      AS origin,
                                     NULL::integer                                       AS card_number,
                                     'bank deposit'                                      AS source_details,
                                     NULL::character varying                             AS counter_account
                              FROM accounter_schema.poalim_deposits_account_transactions_manual
                              UNION
                              SELECT kraken_ledger_records.ledger_id,
                                     kraken_ledger_records.ledger_id,
                                     CASE
                                         WHEN kraken_trades.price IS NOT NULL THEN 1::numeric / kraken_trades.price
                                         ELSE 0::numeric
                                         END                                   AS currency_rate,
                                     kraken_ledger_records.value_date          AS debit_timestamp,
                                     'KRAKEN'::text                            AS origin,
                                     NULL::integer                             AS card_number,
                                     concat(kraken_ledger_records.account_nickname, '_',
                                            kraken_ledger_records.action_type) AS source_details,
                                     CASE
                                         WHEN kraken_ledger_records.action_type = 'trade'::text THEN 'KRAKEN'::text
                                         ELSE NULL::text
                                         END                                   AS counter_account
                              FROM accounter_schema.kraken_ledger_records
                                       LEFT JOIN accounter_schema.kraken_trades
                                                 ON kraken_ledger_records.trade_ref_id = kraken_trades.trade_id
                              UNION
                              SELECT etana_account_transactions.transaction_id,
                                     etana_account_transactions.transaction_id,
                                     0,
                                     NULL::timestamp without time zone      AS debit_timestamp,
                                     'ETANA'::text                          AS origin,
                                     NULL::integer                          AS card_number,
                                     etana_account_transactions.description AS source_details,
                                     CASE
                                         WHEN etana_account_transactions.action_type = 'fee'::text THEN 'ETANA'::text
                                         ELSE NULL::text
                                         END                                AS counter_account
                              FROM accounter_schema.etana_account_transactions
                              UNION
                              SELECT etherscan_transactions.id::text           AS id,
                                     etherscan_transactions.transaction_hash,
                                     0,
                                     etherscan_transactions.event_date         AS debit_timestamp,
                                     'ETHERSCAN'::text                         AS origin,
                                     NULL::integer                             AS card_number,
                                     concat(etherscan_transactions.from_address, ' TO ',
                                            etherscan_transactions.to_address) AS source_details,
                                     CASE
                                         WHEN etherscan_transactions.wallet_address =
                                              etherscan_transactions.from_address THEN etherscan_transactions.to_address
                                         ELSE etherscan_transactions.from_address
                                         END                                   AS counter_account
                              FROM accounter_schema.etherscan_transactions
                              UNION
                              SELECT cal_creditcard_transactions.id::text                AS id,
                                     cal_creditcard_transactions.trn_int_id              AS reference_number,
                                     0                                                   AS currency_rate,
                                     NULL::timestamp without time zone                   AS debit_timestamp,
                                     'CAL'::text                                         AS origin,
                                     cal_creditcard_transactions.card                    AS card_number,
                                     cal_creditcard_transactions.merchant_name           AS source_details,
                                     COALESCE(cal_creditcard_transactions.merchant_id,
                                              cal_creditcard_transactions.merchant_name) AS counter_account
                              FROM accounter_schema.cal_creditcard_transactions
                              UNION
                              SELECT bank_discount_transactions.id::text              AS id,
                                     bank_discount_transactions.urn                   AS reference_number,
                                     0                                                AS currency_rate,
                                     NULL::timestamp without time zone                AS debit_timestamp,
                                     'BANK_DISCOUNT'::text                            AS origin,
                                     NULL::integer                                    AS card_number,
                                     bank_discount_transactions.operation_description AS source_details,
                                     CASE
                                         WHEN bank_discount_transactions.operation_number IS NOT NULL AND
                                              bank_discount_transactions.operation_number <> 0 THEN concat(
                                                 bank_discount_transactions.operation_bank, '-',
                                                 bank_discount_transactions.operation_branch, '-',
                                                 bank_discount_transactions.operation_number)
                                         ELSE NULL::text
                                         END                                          AS counter_account
                              FROM accounter_schema.bank_discount_transactions),
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
                              WHEN (original_transaction.origin = 'ISRACARD'::text OR
                                    original_transaction.origin = 'AMEX'::text) AND
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
                          c.owner_id,
                          concat(original_transaction.counter_account,
                                 CASE
                                     WHEN f.id IS NULL OR original_transaction.counter_account IS NULL OR
                                          original_transaction.counter_account::text = ''::text THEN ''::text
                                     ELSE '_fee'::text
                                     END)::character varying    AS counter_account
FROM accounter_schema.transactions t
         LEFT JOIN accounter_schema.transactions_raw_list rt ON t.source_id = rt.id
         LEFT JOIN accounter_schema.charges c ON c.id = t.charge_id
         LEFT JOIN accounter_schema.financial_accounts a ON a.id = t.account_id
         LEFT JOIN accounter_schema.transactions_fees f ON f.id = t.id
         LEFT JOIN original_transaction ON original_transaction.raw_id =
                                           COALESCE(rt.creditcard_id::text, rt.poalim_ils_id::text,
                                                    rt.poalim_eur_id::text, rt.poalim_gbp_id::text,
                                                    rt.poalim_swift_id::text, rt.poalim_usd_id::text, rt.kraken_id,
                                                    rt.etana_id, rt.etherscan_id::text, rt.amex_id::text,
                                                    rt.cal_id::text, rt.bank_discount_id::text, rt.poalim_cad_id::text,
                                                    rt.max_creditcard_id::text)
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
