import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-01-21T13-37-41.add-poalim-cad.sql',
  run: ({ sql }) => sql`
----------------------
-- create CAD table --
----------------------

create table if not exists accounter_schema.poalim_cad_account_transactions
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
    activity_description                                varchar(13)                    not null,
    event_amount                                        numeric(10, 2)                 not null,
    current_balance                                     numeric(10, 2)                 not null,
    reference_catenated_number                          integer                        not null,
    reference_number                                    integer                        not null,
    currency_rate                                       numeric(9, 7)                  not null,
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
        constraint poalim_cad_account_transactions_pk
            primary key
);

create unique index if not exists poalim_cad_account_transactions_id_uindex
    on accounter_schema.poalim_usd_account_transactions (id);

-------------------------------------------------
-- update transaction_raw_list table and check --
-------------------------------------------------

alter table accounter_schema.transactions_raw_list
    add poalim_cad_id uuid;

create unique index transactions_raw_list_poalim_cad_id_uindex
    on accounter_schema.transactions_raw_list (poalim_cad_id);

alter table accounter_schema.transactions_raw_list
    add foreign key (poalim_cad_id) references accounter_schema.poalim_cad_account_transactions;

alter table accounter_schema.transactions_raw_list
    drop constraint transactions_raw_list_check;

alter table accounter_schema.transactions_raw_list
    add constraint transactions_raw_list_check
        check ((creditcard_id IS NOT NULL)::integer + (poalim_ils_id IS NOT NULL)::integer +
               (poalim_eur_id IS NOT NULL)::integer + (poalim_gbp_id IS NOT NULL)::integer +
               (poalim_usd_id IS NOT NULL)::integer + (poalim_swift_id IS NOT NULL)::integer +
               (kraken_id IS NOT NULL)::integer + (etana_id IS NOT NULL)::integer +
               (etherscan_id IS NOT NULL)::integer + (amex_id IS NOT NULL)::integer + (cal_id IS NOT NULL)::integer +
               (bank_discount_id IS NOT NULL)::integer + (transactions_raw_list.poalim_cad_id IS NOT NULL)::integer = 1);

----------------------------------------------
-- create new transaction insertion trigger --
----------------------------------------------

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
                  SELECT 'usd', id, reference_number, reference_catenated_number, value_date, event_amount
                  FROM accounter_schema.poalim_usd_account_transactions
                  WHERE activity_type_code IN (884, 957, 1058)
                  UNION
                  SELECT 'ils', id, reference_number, reference_catenated_number, value_date, event_amount
                  FROM accounter_schema.poalim_ils_account_transactions
                  WHERE text_code IN (22, 23)) AS s
                    LEFT JOIN accounter_schema.transactions_raw_list tr
                              ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id, tr.poalim_cad_id) = s.id
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
                                                  event_date, debit_date, amount, current_balance)
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
                new.current_balance)
        RETURNING id INTO transaction_id_var;

        -- extend transaction with fee
        IF (is_fee = TRUE) THEN
            INSERT INTO accounter_schema.transactions_fees (id)
            VALUES (transaction_id_var);
        END IF;

        RETURN NEW;
    END;
    $$;

create trigger cad_transaction_insert_trigger
    after insert
    on accounter_schema.poalim_cad_account_transactions
    for each row
execute procedure accounter_schema.insert_poalim_cad_transaction_handler();

------------------------------
-- update existing triggers --
------------------------------

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
                            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id, tr.poalim_cad_id) = s.id
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
                                                event_date, debit_date, amount, current_balance)
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
            new.current_balance)
    RETURNING id INTO transaction_id_var;

    -- extend transaction with fee
    IF (is_fee = TRUE) THEN
        INSERT INTO accounter_schema.transactions_fees (id)
        VALUES (transaction_id_var);
    END IF;

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
                            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id, tr.poalim_usd_id) = s.id
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
                            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id, tr.poalim_cad_id) = s.id
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
                                                event_date, debit_date, amount, current_balance)
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
            new.current_balance)
    RETURNING id INTO transaction_id_var;

    -- extend transaction with fee
    IF (is_fee = TRUE) THEN
        INSERT INTO accounter_schema.transactions_fees (id)
        VALUES (transaction_id_var);
    END IF;

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
                            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_usd_id, tr.poalim_cad_id) = s.id
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
                                                event_date, debit_date, amount, current_balance)
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
            new.current_balance)
    RETURNING id INTO transaction_id_var;

    -- extend transaction with fee
    IF (is_fee = TRUE) THEN
        INSERT INTO accounter_schema.transactions_fees (id)
        VALUES (transaction_id_var);
    END IF;

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
                            ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id, tr.poalim_usd_id) = s.id
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
                                                event_date, debit_date, amount, current_balance)
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
            new.current_balance)
    RETURNING id INTO transaction_id_var;

    -- extend transaction with fee
    IF (is_fee = TRUE) THEN
        INSERT INTO accounter_schema.transactions_fees (id)
        VALUES (transaction_id_var);
    END IF;

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
                          ON COALESCE(tr.poalim_ils_id, tr.poalim_eur_id, tr.poalim_gbp_id, tr.poalim_cad_id, tr.poalim_usd_id) = s.id
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
                                                  event_date, debit_date, amount, current_balance, business_id)
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
                NULL)
        RETURNING id INTO transaction_id_var;

        -- extend transaction with fee
        INSERT INTO accounter_schema.transactions_fees (id)
        VALUES (transaction_id_var);
    END IF;
    RETURN NEW;
END;
$$;

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
                                                    rt.cal_id::text, rt.bank_discount_id::text, rt.poalim_cad_id::text)
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
