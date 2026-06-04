import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-06-02T10-00-00.otsar-hahayal-fee-flagging.sql',
  run: ({ sql }) => sql`
    -- Update ILS handler: flag fees based on description column
    CREATE OR REPLACE FUNCTION accounter_schema.insert_otsar_hahayal_ils_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
        is_fee_var     BOOLEAN;
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

        -- 5. transaction
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
            origin_key
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
            NEW.id
        );

        RETURN NEW;
    END;
    $$;


    -- Update foreign handler: flag fees based on description column
    CREATE OR REPLACE FUNCTION accounter_schema.insert_otsar_hahayal_foreign_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
        is_fee_var     BOOLEAN;
    BEGIN
        -- 1. raw list record
        INSERT INTO accounter_schema.transactions_raw_list (otsar_hahayal_foreign_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- 2. account + owner
        SELECT id, owner
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.account::TEXT AND type = 'BANK_ACCOUNT';

        IF account_id_var IS NULL OR owner_id_var IS NULL THEN
            RAISE EXCEPTION 'Financial account not found or has no owner for account number: %', NEW.account_number;
        END IF;

        -- 3. check if fee
        is_fee_var := (
            NEW.description LIKE '%עמלה בגין%'
            OR NEW.description LIKE '%עמלת העברות%'
            OR NEW.description LIKE '%עמלות מכותבים%'
            OR NEW.description LIKE '%החזר תשלום עמלות%'
        );

        -- 4. charge
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

        -- 5. transaction
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
            origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(NEW.description), ''),
            NEW.currency::accounter_schema.currency,
            NEW.value_date,
            NEW.date,
            CASE
                WHEN NEW.debit <> 0 THEN NEW.debit * -1
                ELSE NEW.credit
            END,
            COALESCE(NEW.balance, 0),
            NEW.reference,
            'OTSAR_HAHAYAL',
            NULL,
            is_fee_var,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;


    -- Update creditcard handler: flag fees based on name column
    CREATE OR REPLACE FUNCTION accounter_schema.insert_otsar_hahayal_creditcard_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        merged_id      UUID;
        account_id_var UUID;
        owner_id_var   UUID;
        charge_id_var  UUID;
        currency_var   accounter_schema.currency;
        is_fee_var     BOOLEAN;
    BEGIN
        -- 1. raw list record
        INSERT INTO accounter_schema.transactions_raw_list (otsar_hahayal_creditcard_id)
        VALUES (NEW.id)
        RETURNING id INTO merged_id;

        -- 2. account + owner (credit card account keyed by resource_id)
        SELECT id, owner
        INTO account_id_var, owner_id_var
        FROM accounter_schema.financial_accounts
        WHERE account_number = NEW.masked_pan::TEXT AND type = 'CREDIT_CARD';

        IF account_id_var IS NULL OR owner_id_var IS NULL THEN
            RAISE EXCEPTION 'Credit card account not found or has no owner for masked PAN: %', NEW.masked_pan;
        END IF;

        -- 3. resolve currency
        currency_var := CASE NEW.charge_currency
          WHEN 'שקל חדש'    THEN 'ILS'::accounter_schema.currency
          WHEN 'דולר ארה"ב' THEN 'USD'::accounter_schema.currency
          WHEN 'אירו'        THEN 'EUR'::accounter_schema.currency
          ELSE NULL
        END;
        IF currency_var IS NULL THEN
          RAISE EXCEPTION 'Unknown charge_currency: %', NEW.charge_currency;
        END IF;

        -- 4. check if fee
        is_fee_var := (NEW.name LIKE '%דמי כרטיס%');

        -- 5. charge
        INSERT INTO accounter_schema.charges (owner_id)
        VALUES (owner_id_var)
        RETURNING id INTO charge_id_var;

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
            origin_key
        ) VALUES (
            owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NULLIF(TRIM(CONCAT_WS(' ',
                NULLIF(TRIM(NEW.name), ''),
                NULLIF(TRIM(NEW.notes), '')
            )), ''),
            currency_var,
            NEW.date,
            NEW.charge_date,
            NEW.charge_amount * -1,
            0,
            NEW.resource_id::TEXT,
            'OTSAR_HAHAYAL_CREDIT_CARD',
            NULL,
            is_fee_var,
            NEW.id
        );

        RETURN NEW;
    END;
    $$;
  `,
} satisfies MigrationExecutor;
