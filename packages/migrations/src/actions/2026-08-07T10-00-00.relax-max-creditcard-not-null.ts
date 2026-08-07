import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-08-07T10-00-00.relax-max-creditcard-not-null.sql',
  run: ({ sql }) => sql`
    -- MAX does not populate these fields for every transaction type (e.g. refunds,
    -- fee rows and installment rows arrive without a dealData block at all), so the
    -- GraphQL input accepts them as nullable. Align the table with that reality.
    ALTER TABLE accounter_schema.max_creditcard_transactions
      ALTER COLUMN actual_payment_amount DROP NOT NULL,
      ALTER COLUMN arn DROP NOT NULL,
      ALTER COLUMN deal_data_acq DROP NOT NULL,
      ALTER COLUMN deal_data_adjustment_type DROP NOT NULL,
      ALTER COLUMN deal_data_amount DROP NOT NULL,
      ALTER COLUMN deal_data_amount_ils DROP NOT NULL,
      ALTER COLUMN deal_data_amount_left DROP NOT NULL,
      ALTER COLUMN deal_data_arn DROP NOT NULL,
      ALTER COLUMN deal_data_authorization_number DROP NOT NULL,
      ALTER COLUMN deal_data_commission_vat DROP NOT NULL,
      ALTER COLUMN deal_data_exchange_direct DROP NOT NULL,
      ALTER COLUMN deal_data_exchange_rate DROP NOT NULL,
      ALTER COLUMN deal_data_interest_amount DROP NOT NULL,
      ALTER COLUMN deal_data_issuer_currency DROP NOT NULL,
      ALTER COLUMN deal_data_plan DROP NOT NULL,
      ALTER COLUMN deal_data_pos_entry_emv DROP NOT NULL,
      ALTER COLUMN deal_data_processing_date DROP NOT NULL,
      ALTER COLUMN deal_data_ref_nbr DROP NOT NULL,
      ALTER COLUMN deal_data_tdm_card_token DROP NOT NULL,
      ALTER COLUMN deal_data_tdm_transaction_type DROP NOT NULL,
      ALTER COLUMN deal_data_transaction_type DROP NOT NULL,
      ALTER COLUMN deal_data_txn_code DROP NOT NULL,
      ALTER COLUMN deal_data_user_name DROP NOT NULL,
      ALTER COLUMN payment_date DROP NOT NULL,
      ALTER COLUMN promotion_club DROP NOT NULL;

    -- arn and payment_date are part of the deduplication key. Once they are
    -- nullable, the default NULLS DISTINCT behaviour would let identical rows
    -- through, so rebuild the index with NULLS NOT DISTINCT.
    DROP INDEX IF EXISTS accounter_schema.max_creditcard_transactions_uid_uindex;
    CREATE UNIQUE INDEX IF NOT EXISTS max_creditcard_transactions_uid_uindex
      ON accounter_schema.max_creditcard_transactions (
        uid,
        arn,
        purchase_date,
        payment_date,
        original_amount
      ) NULLS NOT DISTINCT;

    -- The insert trigger fed two NOT NULL transaction columns straight from
    -- columns that are now nullable:
    --   * source_reference <- arn: fall back to uid, MAX's own per-transaction
    --     identifier, so the reference stays stable and unique.
    --   * currency_rate <- deal_data_exchange_rate: passing NULL explicitly would
    --     bypass the column default, so coalesce to that same default (0).
    -- Without this, relaxing the columns above just moves the failure downstream.
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
        INSERT INTO accounter_schema.transactions (owner_id, account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, source_reference,
                                                   currency_rate, debit_timestamp, source_origin, counter_account,
                                                   origin_key)
        VALUES (owner_id_var,
                account_id_var,
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
                COALESCE(NEW.arn, NEW.uid),
                COALESCE(NEW.deal_data_exchange_rate, 0),
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
  `,
} satisfies MigrationExecutor;
