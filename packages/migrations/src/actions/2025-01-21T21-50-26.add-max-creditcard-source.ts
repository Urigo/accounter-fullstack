import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-01-21T21-50-26.add-max-creditcard-source.sql',
  run: ({ sql }) => sql`
-------------------------
-- Create source table --
-------------------------

create table if not exists accounter_schema.max_creditcard_transactions
(
    id                                       uuid default gen_random_uuid() not null
        constraint max_creditcard_transactions_pk
            primary key,
    actual_payment_amount                    numeric(9, 2)                  not null,
    arn                                      text                           not null,
    card_index                               integer                        not null,
    category_id                              integer                        not null,
    comments                                 text                           not null,
    deal_data_acq                            varchar(10)                    not null,
    deal_data_adjustment_amount              varchar(10),
    deal_data_adjustment_type                numeric(9, 2)                  not null,
    deal_data_amount                         numeric(9, 2)                  not null,
    deal_data_amount_ils                     numeric(9, 2)                  not null,
    deal_data_amount_left                    numeric(9, 2)                  not null,
    deal_data_arn                            varchar(25)                    not null,
    deal_data_authorization_number           varchar(15)                    not null,
    deal_data_card_name                      varchar(10),
    deal_data_card_token                     varchar(10),
    deal_data_commission_vat                 numeric(9, 2)                  not null,
    deal_data_direct_exchange                varchar(10),
    deal_data_exchange_commission_amount     varchar(10),
    deal_data_exchange_commission_maam       varchar(10),
    deal_data_exchange_commission_type       varchar(10),
    deal_data_exchange_direct                varchar(10)                    not null,
    deal_data_exchange_rate                  numeric(9, 2)                  not null,
    deal_data_index_rate_base                varchar(10),
    deal_data_index_rate_pmt                 varchar(10),
    deal_data_interest_amount                numeric(9, 2)                  not null,
    deal_data_is_allowed_spread_with_benefit bit                            not null,
    deal_data_issuer_currency                varchar(10)                    not null,
    deal_data_issuer_exchange_rate           varchar(10),
    deal_data_original_term                  varchar(10),
    deal_data_percent_maam                   numeric(9, 2),
    deal_data_plan                           numeric(9, 2)                  not null,
    deal_data_pos_entry_emv                  numeric(9, 2)                  not null,
    deal_data_processing_date                date                           not null,
    deal_data_purchase_amount                varchar(10),
    deal_data_purchase_time                  time,
    deal_data_ref_nbr                        varchar(25)                    not null,
    deal_data_show_cancel_debit              bit                            not null,
    deal_data_show_spread                    bit                            not null,
    deal_data_show_spread_benefit_button     bit                            not null,
    deal_data_show_spread_button             bit                            not null,
    deal_data_show_spread_for_leumi          bit                            not null,
    deal_data_tdm_card_token                 varchar(10)                    not null,
    deal_data_tdm_transaction_type           integer                        not null,
    deal_data_transaction_type               integer                        not null,
    deal_data_txn_code                       integer                        not null,
    deal_data_user_name                      varchar(30)                    not null,
    deal_data_withdrawal_commission_amount   varchar(10),
    discount_key_amount                      varchar(10),
    discount_key_rec_type                    varchar(10),
    ethoca_ind                               bit                            not null,
    funds_transfer_comment                   text,
    funds_transfer_receiver_or_transfer      text,
    is_register_ch                           bit                            not null,
    is_spreading_autorization_allowed        bit                            not null,
    issuer_id                                integer                        not null,
    merchant_address                         text,
    merchant_coordinates                     varchar(10),
    merchant_max_phone                       bit                            not null,
    merchant                                 text                           not null,
    merchant_commercial_name                 text,
    merchant_number                          varchar(10)                    not null,
    merchant_phone                           varchar(15)                    not null,
    merchant_tax_id                          varchar(9)                     not null,
    merchant_name                            text                           not null,
    original_amount                          numeric(9, 2)                  not null,
    original_currency                        varchar(4)                     not null,
    payment_currency                         integer,
    payment_date                             date                           not null,
    plan_name                                text                           not null,
    plan_type_id                             integer                        not null,
    promotion_amount                         numeric(9, 2),
    promotion_club                           text                           not null,
    promotion_type                           varchar(10),
    purchase_date                            date                           not null,
    receipt_p_d_f                            varchar(10),
    ref_index                                integer                        not null,
    runtime_reference_internal_id            varchar(36)                    not null,
    runtime_reference_type                   integer                        not null,
    runtime_reference_id                     varchar(36),
    short_card_number                        varchar(4),
    spread_transaction_by_campain_ind        bit                            not null,
    spread_transaction_by_campain_number     integer,
    table_type                               integer                        not null,
    tag                                      varchar(10),
    uid                                      text                           not null,
    up_sale_for_transaction_result           varchar(10),
    user_index                               integer                        not null
);

create unique index if not exists max_creditcard_transactions_id_uindex
    on accounter_schema.max_creditcard_transactions (id);

-------------------------------------------------
-- update transaction_raw_list table and check --
-------------------------------------------------

alter table accounter_schema.transactions_raw_list
    add max_creditcard_id uuid;
create unique index transactions_raw_list_max_creditcard_id_uindex
    on accounter_schema.transactions_raw_list (max_creditcard_id);
alter table accounter_schema.transactions_raw_list
    add foreign key (max_creditcard_id) references accounter_schema.max_creditcard_transactions;
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
               (max_creditcard_id IS NOT NULL)::integer = 1);

----------------------------------------------
-- create new transaction insertion trigger --
----------------------------------------------

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
    SELECT INTO account_id_var, owner_id_var id,
                                             owner
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.short_card_number;

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
                                               event_date, debit_date, amount, current_balance)
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
            NEW.actual_payment_amount,
            0);

    RETURN NEW;
END ;
$$;

create trigger max_transaction_insert_trigger
    after insert
    on accounter_schema.max_creditcard_transactions
    for each row
execute procedure accounter_schema.insert_max_creditcard_transaction_handler();

------------------------------
-- update transactions view --
------------------------------

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
                              SELECT amex_creditcard_transactions.id::text                              AS raw_id,
                                     COALESCE(amex_creditcard_transactions.voucher_number::text,
                                              amex_creditcard_transactions.voucher_number_ratz::text)   AS reference_number,
                                     0                                                                  AS currency_rate,
                                     NULL::timestamp without time zone                                  AS debit_timestamp,
                                     'AMEX'::text                                                       AS origin,
                                     amex_creditcard_transactions.card                                  AS card_number,
                                     COALESCE(amex_creditcard_transactions.full_supplier_name_heb,
                                              amex_creditcard_transactions.full_supplier_name_outbound) AS source_details
                              FROM accounter_schema.amex_creditcard_transactions
                              UNION
                              SELECT max_creditcard_transactions.id::text                                               AS raw_id,
                                     max_creditcard_transactions.arn                                                    AS reference_number,
                                     max_creditcard_transactions.deal_data_exchange_rate                                AS currency_rate,
                                     (max_creditcard_transactions.payment_date +
                                      max_creditcard_transactions.deal_data_purchase_time)::timestamp without time zone AS debit_timestamp,
                                     'MAX'::text                                                                        AS origin,
                                     max_creditcard_transactions.short_card_number::INTEGER                             AS card_number,
                                     CONCAT_WS(' | ', max_creditcard_transactions.merchant_name,
                                               max_creditcard_transactions.merchant_commercial_name,
                                               max_creditcard_transactions.comments)                                    AS source_details
                              FROM accounter_schema.max_creditcard_transactions
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
                              SELECT poalim_cad_account_transactions.id::text               AS id,
                                     poalim_cad_account_transactions.reference_number::text AS reference_number,
                                     poalim_cad_account_transactions.currency_rate,
                                     NULL::timestamp without time zone                      AS debit_timestamp,
                                     'POALIM'::text                                         AS origin,
                                     NULL::integer                                          AS card_number,
                                     poalim_cad_account_transactions.event_details          AS source_details
                              FROM accounter_schema.poalim_cad_account_transactions
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
                              FROM accounter_schema.etherscan_transactions
                              UNION
                              SELECT cal_creditcard_transactions.id::text      AS id,
                                     cal_creditcard_transactions.trn_int_id    AS reference_number,
                                     0                                         AS currency_rate,
                                     NULL::timestamp without time zone         AS debit_timestamp,
                                     'CAL'::text                               AS origin,
                                     cal_creditcard_transactions.card          AS card_number,
                                     cal_creditcard_transactions.merchant_name AS source_details
                              FROM accounter_schema.cal_creditcard_transactions
                              UNION
                              SELECT bank_discount_transactions.id::text              AS id,
                                     bank_discount_transactions.urn                   AS reference_number,
                                     0                                                AS currency_rate,
                                     NULL::timestamp without time zone                AS debit_timestamp,
                                     'BANK_DISCOUNT'::text                            AS origin,
                                     NULL::integer                                    AS card_number,
                                     bank_discount_transactions.operation_description AS source_details
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
