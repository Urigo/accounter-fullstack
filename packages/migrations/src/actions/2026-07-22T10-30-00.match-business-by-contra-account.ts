import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-07-22T10-30-00.match-business-by-contra-account.sql',
  run: ({ sql }) => sql`
-- Shared helper: given an owner and a contra (counterparty) bank account, return the
-- id of the single local business that has that exact bank account configured, or NULL.
create or replace function accounter_schema.match_business_by_bank_account(
    p_owner_id       UUID,
    p_bank_number    INTEGER,
    p_branch_number  INTEGER,
    p_account_number INTEGER
) returns UUID
    language sql
    stable
as
$$
    SELECT b.id
    FROM accounter_schema.businesses b
    WHERE p_owner_id IS NOT NULL
      AND p_account_number IS NOT NULL
      AND p_account_number <> 0
      AND b.owner_id = p_owner_id
      AND b.bank_account_bank_number = p_bank_number
      AND b.bank_account_branch_number = p_branch_number
      AND b.bank_account_account_number = p_account_number
    LIMIT 1;
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
    business_id_var    UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
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
    IF (NEW.text_code IN (22, 23, 861, 863)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions
              WHERE activity_type_code IN (884, 957, 1058, 1966)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND t.owner_id = owner_id_var
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
            OR (new.activity_type_code = 471 AND new.text_code IN (615, 617))
        ) THEN
        is_fee = true;
    END IF;

    -- try to match the contra account to a local business
    business_id_var = accounter_schema.match_business_by_bank_account(
        owner_id_var,
        NEW.contra_bank_number,
        NEW.contra_branch_number,
        NEW.contra_account_number
    );

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, source_reference,
                                               source_origin, counter_account, is_fee, origin_key, owner_id,
                                               business_id)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat_ws(' ',
                    new.activity_description,
                    new.beneficiary_details_data_party_name,
                    new.beneficiary_details_data_message_detail,
                    new.english_action_desc
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
            NEW.id,
            owner_id_var,
            business_id_var);

    RETURN NEW;
END;
$$;


create or replace function accounter_schema.insert_poalim_foreign_transaction_handler() returns trigger
    language plpgsql
as
$$
DECLARE
    merged_id          UUID;
    account_id_var     UUID;
    owner_id_var       UUID;
    charge_id_var      UUID    = NULL;
    business_id_var    UUID    = NULL;
    is_conversion      BOOLEAN = false;
    is_fee             BOOLEAN = false;
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
    IF (new.activity_type_code in (884, 957, 1058, 1966)) THEN
        is_conversion = true;

        -- check if matching charge exists:
        SELECT t.charge_id
        INTO charge_id_var
        FROM (SELECT currency, id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_foreign_account_transactions
              WHERE activity_type_code IN (884, 957, 1058, 1966)
              UNION ALL
              SELECT 'ILS', id, reference_number, reference_catenated_number, value_date, event_amount
              FROM accounter_schema.poalim_ils_account_transactions
              WHERE text_code IN (22, 23, 861, 863)) AS s
                 LEFT JOIN accounter_schema.transactions_raw_list tr
                           ON COALESCE(tr.poalim_ils_id, tr.poalim_foreign_id) = s.id
                 LEFT JOIN accounter_schema.transactions t
                           ON tr.id = t.source_id
        WHERE t.charge_id IS NOT NULL
          AND t.owner_id = owner_id_var
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
    IF ((new.activity_type_code = 1279 AND new.event_amount BETWEEN 0 AND 30)
        OR (new.activity_type_code = 884 AND new.original_system_id = 390))
    THEN
        is_fee = true;
    END IF;

    -- try to match the contra account to a local business
    business_id_var = accounter_schema.match_business_by_bank_account(
        owner_id_var,
        NEW.contra_bank_number,
        NEW.contra_branch_number,
        NEW.contra_account_number
    );

    -- create new transaction
    INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency,
                                               event_date, debit_date, amount, current_balance, is_fee,
                                               source_reference, source_origin, currency_rate, counter_account,
                                               origin_key, owner_id, business_id)
    VALUES (account_id_var,
            charge_id_var,
            merged_id,
            concat_ws(' ',
                    new.activity_description,
                    new.event_details,
                    new.account_name
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
                END,
            NEW.id,
            owner_id_var,
            business_id_var);

    RETURN NEW;
END;
$$;


create or replace function accounter_schema.insert_otsar_hahayal_ils_transaction_handler()
  returns trigger language plpgsql as
$$
DECLARE
    merged_id       UUID;
    account_id_var  UUID;
    owner_id_var    UUID;
    charge_id_var   UUID;
    business_id_var UUID = NULL;
    is_fee_var      BOOLEAN;
BEGIN
    -- 1. raw list record
    INSERT INTO accounter_schema.transactions_raw_list (otsar_hahayal_ils_id)
    VALUES (NEW.id)
    RETURNING id INTO merged_id;

    -- 2. account + owner
    SELECT id, owner
    INTO account_id_var, owner_id_var
    FROM accounter_schema.financial_accounts
    WHERE account_number = NEW.account_number::TEXT AND type = 'BANK_ACCOUNT';

    IF account_id_var IS NULL OR owner_id_var IS NULL THEN
        RAISE EXCEPTION 'Financial account not found or has no owner for account number: %', NEW.account_number;
    END IF;

    -- 3. check if fee
    is_fee_var := (
        NEW.description LIKE '%עמלת מסלול%'
        OR NEW.description LIKE '%עמלת מטח%'
        OR NEW.description LIKE '%עמלת בנקאות ישירה%'
    );

    -- 4. charge
    INSERT INTO accounter_schema.charges (owner_id)
    VALUES (owner_id_var)
    RETURNING id INTO charge_id_var;

    -- 5. try to match the correspondent account to a local business
    business_id_var = accounter_schema.match_business_by_bank_account(
        owner_id_var,
        NEW.correspondent_bank,
        NEW.correspondent_branch,
        NEW.correspondent_account
    );

    -- 6. transaction
    INSERT INTO accounter_schema.transactions (
        owner_id,
        account_id,
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
        is_fee,
        origin_key,
        business_id
    ) VALUES (
        owner_id_var,
        account_id_var,
        charge_id_var,
        merged_id,
        NULLIF(TRIM(CONCAT_WS(' ',
            NULLIF(TRIM(NEW.name), ''),
            NULLIF(TRIM(NEW.customer_name), ''),
            NULLIF(TRIM(NEW.description), ''),
            NULLIF(TRIM(NEW.transaction_reason), '')
        )), ''),
        'ILS'::accounter_schema.currency,
        NEW.date_of_registration::DATE,
        NEW.date_of_business_day::DATE,
        CASE
            WHEN NEW.debit_amount <> 0 THEN NEW.debit_amount * -1
            ELSE NEW.credit_amount
        END,
        NEW.closing_balance,
        NEW.reference::TEXT,
        'OTSAR_HAHAYAL',
        CASE
            WHEN NEW.correspondent_account <> 0 THEN CONCAT(
                NEW.correspondent_bank, '-',
                NEW.correspondent_branch, '-',
                NEW.correspondent_account,
                ' (', NEW.correspondent_account_type, ')'
            )
            ELSE NULL
        END,
        is_fee_var,
        NEW.id,
        business_id_var
    );

    RETURN NEW;
END;
$$;
`,
} satisfies MigrationExecutor;
