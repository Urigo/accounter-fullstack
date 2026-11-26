import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Two card insert handlers failed a whole upload batch on rows they did not expect:
 *
 * - Amex: a fee or adjustment on the foreign-currency statement has no purchase date, only
 *   the date it is charged. The handler produced a NULL event date for it.
 * - CAL: a deal in a currency outside the currency enum (the card works anywhere) could not
 *   be cast. Such a deal is now recorded as the card was debited.
 *
 * Both functions are otherwise unchanged from their previous definitions.
 */
export default {
  name: '2026-11-26T14-00-00.card-handlers-missing-date-and-foreign-currency.sql',
  run: ({ sql }) => sql`
    CREATE OR REPLACE FUNCTION accounter_schema.insert_amex_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
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
        INSERT INTO accounter_schema.transactions (owner_id, account_id, charge_id, source_id, source_description, currency,
                                                   event_date, debit_date, amount, current_balance, source_reference,
                                                   source_origin, counter_account, origin_key)
        VALUES (owner_id_var,
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
                -- Fees and adjustments on the foreign-currency statement carry no purchase date,
                -- only the date they are charged; that date stands in for the event.
                to_date(
                    COALESCE(
                        NEW.full_purchase_date,
                        NEW.full_purchase_date_outbound,
                        NEW.full_payment_date,
                        NEW.charging_date
                    ),
                    'DD/MM/YYYY'
                ),
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

    CREATE OR REPLACE FUNCTION accounter_schema.insert_cal_creditcard_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
DECLARE
    merged_id      UUID;
    account_id_var UUID;
    owner_id_var   UUID;
    charge_id_var  UUID = NULL;
    currency_var   accounter_schema.currency;
    amount_var     NUMERIC;
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

    -- The transaction is recorded in the currency of the deal. When that is a currency
    -- this system does not keep (the card is used anywhere in the world), it is recorded
    -- as the card was actually debited instead, rather than failing the whole upload.
    IF NEW.trn_currency_symbol = ANY (enum_range(NULL::accounter_schema.currency)::TEXT[]) THEN
        currency_var := NEW.trn_currency_symbol::accounter_schema.currency;
        amount_var := NEW.trn_amt;
    ELSE
        currency_var := NEW.deb_crd_currency_symbol::accounter_schema.currency;
        amount_var := NEW.amt_before_conv_and_index;
    END IF;

    -- create new transaction
    INSERT INTO accounter_schema.transactions (owner_id,
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
                                               origin_key)
    VALUES (owner_id_var,
            account_id_var,
            charge_id_var,
            merged_id,
            NEW.merchant_name,
            currency_var,
            to_date(NEW.trn_purchase_date, 'DD/MM/YYYY'),
            to_date(NEW.deb_crd_date, 'DD/MM/YYYY'),
            amount_var * -1,
            0,
            NEW.trn_int_id,
            'CAL',
            COALESCE(NEW.merchant_id,
                     NEW.merchant_name),
            NEW.id);

    RETURN NEW;
END;
$$;
  `,
} satisfies MigrationExecutor;
