import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-12-15T13-09-27.enhance-business-trips-transactions-view.sql',
  run: ({ sql }) => sql`
    create or replace view accounter_schema.extended_business_trip_transactions
                (id, business_trip_id, transaction_ids, charge_ids, category, date, value_date, amount, currency,
                employee_business_id, payed_by_employee)
    as
    WITH transactions_by_business_trip_transaction AS (SELECT tm.business_trip_transaction_id,
                                                              array_agg(DISTINCT t1.id)        AS transaction_ids,
                                                              array_agg(DISTINCT t1.charge_id) AS charge_ids,
                                                              array_agg(DISTINCT t1.currency)  AS currencies,
                                                              sum(tm.amount)                   AS amount,
                                                              min(t1.event_date)               AS event_date,
                                                              min(t1.debit_date)               AS debit_date
                                                      FROM accounter_schema.business_trips_transactions_match tm
                                                                LEFT JOIN accounter_schema.extended_transactions t1 ON t1.id = tm.transaction_id
                                                      GROUP BY tm.business_trip_transaction_id)
    SELECT DISTINCT ON (btt.id) btt.id,
                                btt.business_trip_id,
                                t.transaction_ids,
                                CASE
                                    WHEN t.charge_ids IS NOT NULL THEN t.charge_ids
                                    WHEN ep.charge_id IS NOT NULL THEN ARRAY [ep.charge_id]
                                    END                                as charge_ids,
                                btt.category,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.date
                                    ELSE t.event_date
                                    END                                AS date,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.value_date
                                    ELSE t.debit_date
                                    END                                AS value_date,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN
                                        CASE
                                            WHEN ep.amount IS NULL THEN NULL::numeric
                                            ELSE ep.amount * '-1'::integer::numeric
                                            END
                                    WHEN array_length(t.currencies, 1) = 1 THEN t.amount
                                    ELSE NULL::numeric
                                    END                                AS amount,
                                CASE
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.currency
                                    WHEN array_length(t.currencies, 1) = 1 THEN t.currencies[1]
                                    ELSE NULL::accounter_schema.currency
                                    END                                AS currency,
                                ep.employee_business_id,
                                t.business_trip_transaction_id IS NULL AS payed_by_employee
    FROM accounter_schema.business_trips_transactions btt
            LEFT JOIN transactions_by_business_trip_transaction t ON t.business_trip_transaction_id = btt.id
            LEFT JOIN accounter_schema.business_trips_employee_payments ep ON ep.id = btt.id;
`,
} satisfies MigrationExecutor;
