import { type MigrationExecutor } from '../pg-migrator.js';

/**
 * Keep `transactions` in sync when an Otsar Hahayal credit-card source row is updated in place.
 *
 * About a day after the monthly charge, the bank restates Visa deals: `date` moves back a day, the
 * merchant `name` (truncated to 14 characters and upper-cased until then) is replaced by the full
 * name, and `notes` is filled in. Both `date` and `notes` are part of the dedup key, so the upload
 * used to miss the existing row and insert a second copy. The ingestion provider now updates the
 * stored row instead; this trigger carries the source-derived fields over to the transaction that
 * the insert trigger created for it.
 *
 * Only fields the insert trigger derives from the source row are touched — the transaction keeps
 * its charge, business, overrides and `is_fee` flag (which a user may have changed).
 *
 * Idempotent. Rollback (the migrator has no down step):
 *   DROP TRIGGER IF EXISTS update_otsar_hahayal_creditcard_transaction
 *     ON accounter_schema.otsar_hahayal_creditcard_transactions;
 *   DROP FUNCTION IF EXISTS accounter_schema.update_otsar_hahayal_creditcard_transaction_handler();
 */
export default {
  name: '2026-11-03T12-00-00.otsar-hahayal-creditcard-restatement-sync.sql',
  run: ({ sql }) => sql`
    CREATE OR REPLACE FUNCTION accounter_schema.update_otsar_hahayal_creditcard_transaction_handler()
      RETURNS trigger LANGUAGE plpgsql AS
    $$
    DECLARE
        currency_var accounter_schema.currency;
    BEGIN
        currency_var := CASE NEW.charge_currency
          WHEN 'שקל חדש'    THEN 'ILS'::accounter_schema.currency
          WHEN 'דולר ארה"ב' THEN 'USD'::accounter_schema.currency
          WHEN 'אירו'        THEN 'EUR'::accounter_schema.currency
          ELSE NULL
        END;
        IF currency_var IS NULL THEN
          RAISE EXCEPTION 'Unknown charge_currency: %', NEW.charge_currency;
        END IF;

        UPDATE accounter_schema.transactions
        SET
            source_description = NULLIF(TRIM(CONCAT_WS(' ',
                NULLIF(TRIM(NEW.name), ''),
                NULLIF(TRIM(NEW.notes), '')
            )), ''),
            currency   = currency_var,
            event_date = NEW.date,
            debit_date = NEW.charge_date,
            amount     = NEW.charge_amount * -1
        WHERE origin_key = NEW.id
          AND source_origin = 'OTSAR_HAHAYAL_CREDIT_CARD';

        RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS update_otsar_hahayal_creditcard_transaction
      ON accounter_schema.otsar_hahayal_creditcard_transactions;

    CREATE TRIGGER update_otsar_hahayal_creditcard_transaction
      AFTER UPDATE OF date, charge_date, name, notes, charge_amount, charge_currency
      ON accounter_schema.otsar_hahayal_creditcard_transactions
      FOR EACH ROW
      WHEN (
        (OLD.date, OLD.charge_date, OLD.name, OLD.notes, OLD.charge_amount, OLD.charge_currency)
        IS DISTINCT FROM
        (NEW.date, NEW.charge_date, NEW.name, NEW.notes, NEW.charge_amount, NEW.charge_currency)
      )
      EXECUTE FUNCTION accounter_schema.update_otsar_hahayal_creditcard_transaction_handler();
  `,
} satisfies MigrationExecutor;
