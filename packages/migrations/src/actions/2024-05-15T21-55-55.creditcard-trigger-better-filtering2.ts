import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-05-15T21-55-55.creditcard-trigger-better-filtering2.sql',
  run: ({ sql }) => sql`
  create or replace function accounter_schema.insert_creditcard_transaction_handler() returns trigger
      language plpgsql
  as
  $$
      DECLARE
          merged_id UUID;
          account_id_var UUID;
          owner_id_var UUID;
          charge_id_var UUID = NULL;
      BEGIN
          -- filter summarize records
          IF (
                  NEW.full_supplier_name_outbound NOT IN ('TOTAL FOR DATE', 'CASH ADVANCE FEE')
                  OR NEW.full_supplier_name_outbound IS NULL
              ) AND (
                  NEW.supplier_name NOT IN ('סך חיוב בש"ח:', 'סך חיוב  ב-$:')
                  OR (NEW.supplier_name NOT IN ('דמי כרטיס הנחה', 'פועלים- דמי כרט') AND NEW.payment_sum = 0.00)
                  OR NEW.supplier_name IS NULL
              )
          THEN
              -- Create merged raw transactions record:
              INSERT INTO accounter_schema.transactions_raw_list (creditcard_id)
              VALUES (NEW.id)
              RETURNING id INTO merged_id;

              -- get account and owner IDs
              SELECT INTO account_id_var, owner_id_var
                  id, owner
              FROM accounter_schema.financial_accounts
              WHERE account_number = NEW.card::TEXT;

              -- check if matching charge exists:
              -- TBD

              -- create new charge
              IF (charge_id_var IS NULL) THEN
                  INSERT INTO accounter_schema.charges (owner_id, is_conversion)
                  VALUES (
                      owner_id_var,
                      FALSE
                  )
                  RETURNING id INTO charge_id_var;
              END IF;

              -- check if new record is fee
              -- TBD

              -- check if new record contains fees
              -- TBD

              -- create new transaction
              INSERT INTO accounter_schema.transactions (account_id, charge_id, source_id, source_description, currency, event_date, debit_date, amount, current_balance)
              VALUES (
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
                  CAST (
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
                  CASE
                      WHEN NEW.full_purchase_date IS NULL THEN to_date(NEW.full_purchase_date_outbound, 'DD/MM/YYYY')
                      WHEN NEW.full_purchase_date_outbound IS NULL THEN to_date(NEW.full_purchase_date, 'DD/MM/YYYY')
                  END,
                  to_date(COALESCE(NEW.full_payment_date, NEW.charging_date), 'DD/MM/YYYY'),
                  CASE
                      WHEN NEW.payment_sum IS NULL THEN (NEW.payment_sum_outbound * -1)
                      WHEN NEW.payment_sum_outbound IS NULL THEN (NEW.payment_sum * -1)
                  END,
                  0
              );
          END IF;

          RETURN NEW;
      END;
      $$;
`,
} satisfies MigrationExecutor;
