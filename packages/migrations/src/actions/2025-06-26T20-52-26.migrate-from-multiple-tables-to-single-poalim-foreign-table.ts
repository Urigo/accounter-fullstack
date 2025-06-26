import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-06-26T20-52-26.migrate-from-multiple-tables-to-single-poalim-foreign-table.sql',
  run: ({ sql }) => sql`
-- PART 1: create common table

create table if not exists accounter_schema.poalim_foreign_account_transactions
(
    metadata_attributes_original_event_key              json,
    metadata_attributes_contra_branch_number            json,
    metadata_attributes_contra_account_number           json,
    metadata_attributes_contra_bank_number              json,
    metadata_attributes_contra_account_field_name_lable json,
    metadata_attributes_data_group_code                 json,
    metadata_attributes_currency_rate                   json,
    metadata_attributes_contra_currency_code            json,
    metadata_attributes_rate_fixing_code                json,
    executing_date                                      date                           not null,
    formatted_executing_date                            varchar(24)                    not null,
    value_date                                          date                           not null,
    formatted_value_date                                varchar(24)                    not null,
    original_system_id                                  integer                        not null,
    activity_description                                varchar(30)                    not null,
    event_amount                                        numeric(10, 2)                 not null,
    currency                                            accounter_schema.currency      not null,
    current_balance                                     numeric(10, 2)                 not null,
    reference_catenated_number                          integer                        not null,
    reference_number                                    integer                        not null,
    currency_rate                                       numeric(10, 7)                 not null,
    event_details                                       varchar(20),
    rate_fixing_code                                    integer                        not null,
    contra_currency_code                                integer                        not null,
    event_activity_type_code                            integer                        not null,
    transaction_type                                    varchar(7)                     not null,
    rate_fixing_short_description                       varchar(9)                     not null,
    currency_long_description                           text                           not null,
    activity_type_code                                  integer                        not null,
    event_number                                        integer                        not null,
    validity_date                                       date                           not null,
    comments                                            varchar(30),
    comment_existence_switch                            bit                            not null,
    account_name                                        varchar(30),
    contra_bank_number                                  integer                        not null,
    contra_branch_number                                integer                        not null,
    contra_account_number                               integer                        not null,
    original_event_key                                  bit                            not null,
    contra_account_field_name_lable                     varchar(30),
    data_group_code                                     bit                            not null,
    rate_fixing_description                             varchar(34),
    url_address_niar                                    varchar(30),
    currency_swift_code                                 varchar(3)                     not null,
    url_address                                         varchar(80),
    bank_number                                         integer                        not null,
    branch_number                                       integer                        not null,
    account_number                                      integer                        not null,
    id                                                  uuid default gen_random_uuid() not null
        constraint poalim_foreign_account_transactions_pk
            primary key
);

create unique index if not exists poalim_foreign_account_transactions_id_uindex
    on accounter_schema.poalim_foreign_account_transactions (id);

-- PART 2: recreate source transactions in new table

insert into accounter_schema.poalim_foreign_account_transactions (metadata_attributes_original_event_key,
                                                                  metadata_attributes_contra_branch_number,
                                                                  metadata_attributes_contra_account_number,
                                                                  metadata_attributes_contra_bank_number,
                                                                  metadata_attributes_contra_account_field_name_lable,
                                                                  metadata_attributes_data_group_code,
                                                                  metadata_attributes_currency_rate,
                                                                  metadata_attributes_contra_currency_code,
                                                                  metadata_attributes_rate_fixing_code, executing_date,
                                                                  formatted_executing_date, value_date,
                                                                  formatted_value_date,
                                                                  original_system_id, activity_description,
                                                                  event_amount, currency,
                                                                  current_balance, reference_catenated_number,
                                                                  reference_number,
                                                                  currency_rate, event_details, rate_fixing_code,
                                                                  contra_currency_code,
                                                                  event_activity_type_code, transaction_type,
                                                                  rate_fixing_short_description,
                                                                  currency_long_description,
                                                                  activity_type_code, event_number, validity_date,
                                                                  comments,
                                                                  comment_existence_switch, account_name,
                                                                  contra_bank_number,
                                                                  contra_branch_number, contra_account_number,
                                                                  original_event_key,
                                                                  contra_account_field_name_lable, data_group_code,
                                                                  rate_fixing_description, url_address_niar,
                                                                  currency_swift_code,
                                                                  url_address, bank_number, branch_number,
                                                                  account_number, id)
select metadata_attributes_original_event_key,
       metadata_attributes_contra_branch_number,
       metadata_attributes_contra_account_number,
       metadata_attributes_contra_bank_number,
       metadata_attributes_contra_account_field_name_lable,
       metadata_attributes_data_group_code,
       metadata_attributes_currency_rate,
       metadata_attributes_contra_currency_code,
       metadata_attributes_rate_fixing_code,
       executing_date,
       formatted_executing_date,
       value_date,
       formatted_value_date,
       original_system_id,
       activity_description,
       event_amount,
       'CAD'::accounter_schema.currency,
       current_balance,
       reference_catenated_number,
       reference_number,
       currency_rate,
       event_details,
       rate_fixing_code,
       contra_currency_code,
       event_activity_type_code,
       transaction_type,
       rate_fixing_short_description,
       currency_long_description,
       activity_type_code,
       event_number,
       validity_date,
       comments,
       comment_existence_switch,
       account_name,
       contra_bank_number,
       contra_branch_number,
       contra_account_number,
       original_event_key,
       contra_account_field_name_lable,
       data_group_code,
       rate_fixing_description,
       url_address_niar,
       currency_swift_code,
       url_address,
       bank_number,
       branch_number,
       account_number,
       id
from accounter_schema.poalim_cad_account_transactions;

insert into accounter_schema.poalim_foreign_account_transactions (metadata_attributes_original_event_key,
                                                                  metadata_attributes_contra_branch_number,
                                                                  metadata_attributes_contra_account_number,
                                                                  metadata_attributes_contra_bank_number,
                                                                  metadata_attributes_contra_account_field_name_lable,
                                                                  metadata_attributes_data_group_code,
                                                                  metadata_attributes_currency_rate,
                                                                  metadata_attributes_contra_currency_code,
                                                                  metadata_attributes_rate_fixing_code, executing_date,
                                                                  formatted_executing_date, value_date,
                                                                  formatted_value_date,
                                                                  original_system_id, activity_description,
                                                                  event_amount, currency,
                                                                  current_balance, reference_catenated_number,
                                                                  reference_number,
                                                                  currency_rate, event_details, rate_fixing_code,
                                                                  contra_currency_code,
                                                                  event_activity_type_code, transaction_type,
                                                                  rate_fixing_short_description,
                                                                  currency_long_description,
                                                                  activity_type_code, event_number, validity_date,
                                                                  comments,
                                                                  comment_existence_switch, account_name,
                                                                  contra_bank_number,
                                                                  contra_branch_number, contra_account_number,
                                                                  original_event_key,
                                                                  contra_account_field_name_lable, data_group_code,
                                                                  rate_fixing_description, url_address_niar,
                                                                  currency_swift_code,
                                                                  url_address, bank_number, branch_number,
                                                                  account_number, id)
select metadata_attributes_original_event_key,
       metadata_attributes_contra_branch_number,
       metadata_attributes_contra_account_number,
       metadata_attributes_contra_bank_number,
       metadata_attributes_contra_account_field_name_lable,
       metadata_attributes_data_group_code,
       metadata_attributes_currency_rate,
       metadata_attributes_contra_currency_code,
       metadata_attributes_rate_fixing_code,
       executing_date,
       formatted_executing_date,
       value_date,
       formatted_value_date,
       original_system_id,
       activity_description,
       event_amount,
       'EUR'::accounter_schema.currency,
       current_balance,
       reference_catenated_number,
       reference_number,
       currency_rate,
       event_details,
       rate_fixing_code,
       contra_currency_code,
       event_activity_type_code,
       transaction_type,
       rate_fixing_short_description,
       currency_long_description,
       activity_type_code,
       event_number,
       validity_date,
       comments,
       comment_existence_switch,
       account_name,
       contra_bank_number,
       contra_branch_number,
       contra_account_number,
       original_event_key,
       contra_account_field_name_lable,
       data_group_code,
       rate_fixing_description,
       url_address_niar,
       currency_swift_code,
       url_address,
       bank_number,
       branch_number,
       account_number,
       id
from accounter_schema.poalim_eur_account_transactions;

insert into accounter_schema.poalim_foreign_account_transactions (metadata_attributes_original_event_key,
                                                                  metadata_attributes_contra_branch_number,
                                                                  metadata_attributes_contra_account_number,
                                                                  metadata_attributes_contra_bank_number,
                                                                  metadata_attributes_contra_account_field_name_lable,
                                                                  metadata_attributes_data_group_code,
                                                                  metadata_attributes_currency_rate,
                                                                  metadata_attributes_contra_currency_code,
                                                                  metadata_attributes_rate_fixing_code, executing_date,
                                                                  formatted_executing_date, value_date,
                                                                  formatted_value_date,
                                                                  original_system_id, activity_description,
                                                                  event_amount, currency,
                                                                  current_balance, reference_catenated_number,
                                                                  reference_number,
                                                                  currency_rate, event_details, rate_fixing_code,
                                                                  contra_currency_code,
                                                                  event_activity_type_code, transaction_type,
                                                                  rate_fixing_short_description,
                                                                  currency_long_description,
                                                                  activity_type_code, event_number, validity_date,
                                                                  comments,
                                                                  comment_existence_switch, account_name,
                                                                  contra_bank_number,
                                                                  contra_branch_number, contra_account_number,
                                                                  original_event_key,
                                                                  contra_account_field_name_lable, data_group_code,
                                                                  rate_fixing_description, url_address_niar,
                                                                  currency_swift_code,
                                                                  url_address, bank_number, branch_number,
                                                                  account_number, id)
select metadata_attributes_original_event_key,
       metadata_attributes_contra_branch_number,
       metadata_attributes_contra_account_number,
       metadata_attributes_contra_bank_number,
       metadata_attributes_contra_account_field_name_lable,
       metadata_attributes_data_group_code,
       metadata_attributes_currency_rate,
       metadata_attributes_contra_currency_code,
       metadata_attributes_rate_fixing_code,
       executing_date,
       formatted_executing_date,
       value_date,
       formatted_value_date,
       original_system_id,
       activity_description,
       event_amount,
       'GBP'::accounter_schema.currency,
       current_balance,
       reference_catenated_number,
       reference_number,
       currency_rate,
       event_details,
       rate_fixing_code,
       contra_currency_code,
       event_activity_type_code,
       transaction_type,
       rate_fixing_short_description,
       currency_long_description,
       activity_type_code,
       event_number,
       validity_date,
       comments,
       comment_existence_switch,
       account_name,
       contra_bank_number,
       contra_branch_number,
       contra_account_number,
       original_event_key,
       contra_account_field_name_lable,
       data_group_code,
       rate_fixing_description,
       url_address_niar,
       currency_swift_code,
       url_address,
       bank_number,
       branch_number,
       account_number,
       id
from accounter_schema.poalim_gbp_account_transactions;

insert into accounter_schema.poalim_foreign_account_transactions (metadata_attributes_original_event_key,
                                                                  metadata_attributes_contra_branch_number,
                                                                  metadata_attributes_contra_account_number,
                                                                  metadata_attributes_contra_bank_number,
                                                                  metadata_attributes_contra_account_field_name_lable,
                                                                  metadata_attributes_data_group_code,
                                                                  metadata_attributes_currency_rate,
                                                                  metadata_attributes_contra_currency_code,
                                                                  metadata_attributes_rate_fixing_code, executing_date,
                                                                  formatted_executing_date, value_date,
                                                                  formatted_value_date,
                                                                  original_system_id, activity_description,
                                                                  event_amount, currency,
                                                                  current_balance, reference_catenated_number,
                                                                  reference_number,
                                                                  currency_rate, event_details, rate_fixing_code,
                                                                  contra_currency_code,
                                                                  event_activity_type_code, transaction_type,
                                                                  rate_fixing_short_description,
                                                                  currency_long_description,
                                                                  activity_type_code, event_number, validity_date,
                                                                  comments,
                                                                  comment_existence_switch, account_name,
                                                                  contra_bank_number,
                                                                  contra_branch_number, contra_account_number,
                                                                  original_event_key,
                                                                  contra_account_field_name_lable, data_group_code,
                                                                  rate_fixing_description, url_address_niar,
                                                                  currency_swift_code,
                                                                  url_address, bank_number, branch_number,
                                                                  account_number, id)
select metadata_attributes_original_event_key,
       metadata_attributes_contra_branch_number,
       metadata_attributes_contra_account_number,
       metadata_attributes_contra_bank_number,
       metadata_attributes_contra_account_field_name_lable,
       metadata_attributes_data_group_code,
       metadata_attributes_currency_rate,
       metadata_attributes_contra_currency_code,
       metadata_attributes_rate_fixing_code,
       executing_date,
       formatted_executing_date,
       value_date,
       formatted_value_date,
       original_system_id,
       activity_description,
       event_amount,
       'USD'::accounter_schema.currency,
       current_balance,
       reference_catenated_number,
       reference_number,
       currency_rate,
       event_details,
       rate_fixing_code,
       contra_currency_code,
       event_activity_type_code,
       transaction_type,
       rate_fixing_short_description,
       currency_long_description,
       activity_type_code,
       event_number,
       validity_date,
       comments,
       comment_existence_switch,
       account_name,
       contra_bank_number,
       contra_branch_number,
       contra_account_number,
       original_event_key,
       contra_account_field_name_lable,
       data_group_code,
       rate_fixing_description,
       url_address_niar,
       currency_swift_code,
       url_address,
       bank_number,
       branch_number,
       account_number,
       id
from accounter_schema.poalim_usd_account_transactions;

-- PART 3: update transactions_raw_list table

alter table accounter_schema.transactions_raw_list
    add poalim_foreign_id uuid;

alter table accounter_schema.transactions_raw_list
    add constraint transactions_raw_list_poalim_foreign_account_transactions_id_fk
        foreign key (poalim_foreign_id) references accounter_schema.poalim_foreign_account_transactions;

update accounter_schema.transactions_raw_list
set poalim_foreign_id = coalesce(poalim_cad_id, poalim_eur_id, poalim_gbp_id, poalim_usd_id)
where coalesce(poalim_cad_id, poalim_eur_id, poalim_gbp_id, poalim_usd_id) is not null;


-- PART 4: insert trigger

create or replace function accounter_schema.insert_poalim_foreign_transaction_handler() returns trigger
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
    INSERT INTO accounter_schema.transactions_raw_list (poalim_foreign_id)
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
        FROM (SELECT currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)
              UNION
              SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
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
            new.currency,
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

-- PART 5: update unique ID constraint

alter table accounter_schema.transactions_raw_list
    drop constraint transactions_raw_list_check;

alter table accounter_schema.transactions_raw_list
    add constraint transactions_raw_list_check
        check (((((((((((((creditcard_id IS NOT NULL))::integer + ((poalim_ils_id IS NOT NULL))::integer) +
                            ((poalim_foreign_id IS NOT NULL))::integer) + ((poalim_swift_id IS NOT NULL))::integer) +
                        ((kraken_id IS NOT NULL))::integer) + ((etana_id IS NOT NULL))::integer) +
                      ((etherscan_id IS NOT NULL))::integer) + ((amex_id IS NOT NULL))::integer) +
                    ((cal_id IS NOT NULL))::integer) + ((bank_discount_id IS NOT NULL))::integer) +
                  ((max_creditcard_id IS NOT NULL))::integer) = 1);

-- PART 6: drop single currency triggers, activate the new one

create trigger foreign_transaction_insert_trigger
    after insert
    on accounter_schema.poalim_foreign_account_transactions
    for each row
execute procedure accounter_schema.insert_poalim_foreign_transaction_handler();

drop trigger cad_transaction_insert_trigger on accounter_schema.poalim_cad_account_transactions;
drop trigger eur_transaction_insert_trigger on accounter_schema.poalim_eur_account_transactions;
drop trigger gbp_transaction_insert_trigger on accounter_schema.poalim_gbp_account_transactions;
drop trigger usd_transaction_insert_trigger on accounter_schema.poalim_usd_account_transactions;

-- PART 7: update parallel Poalim triggers

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
        FROM (SELECT currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions
              WHERE activity_type_code IN (884, 957, 1058)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
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
        FROM (SELECT formatted_value_date, event_details, id, currency, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
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

-- PART 8: drop redundant columns from transactions_raw_list
ALTER TABLE accounter_schema.transactions_raw_list
    DROP COLUMN poalim_eur_id,
    DROP COLUMN poalim_gbp_id,
    DROP COLUMN poalim_cad_id,
    DROP COLUMN poalim_usd_id;
`,
} satisfies MigrationExecutor;
