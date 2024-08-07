import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-08-06T15-00-00.enhance-business-trip-transactions-matching.sql',
  run: ({ sql }) => sql`
    create table accounter_schema.business_trips_transactions_match
    (
        business_trip_transaction_id uuid not null
            constraint business_trips_transactions_match_business_trips_transactions_id_fk
                references accounter_schema.business_trips_transactions,
        transaction_id              uuid not null
            constraint business_trips_transactions_match_transactions_id_fk
                references accounter_schema.transactions,
        amount                      numeric(7, 2)
    );

    insert into accounter_schema.business_trips_transactions_match (business_trip_transaction_id, transaction_id)
    select t.id, t.transaction_id
    from accounter_schema.business_trips_transactions t
    where t.transaction_id is not null;

    drop view accounter_schema.extended_business_trip_transactions;

    create or replace view accounter_schema.extended_business_trip_transactions
                (id, business_trip_id, transaction_ids, charge_ids, category, date, value_date, amount, currency,
                employee_business_id,
                payed_by_employee)
    as
    WITH transactions_by_business_trip_transaction AS (SELECT tm.business_trip_transaction_id,
                                                            array_agg(t1.id)        AS transaction_ids,
                                                            array_agg(t1.charge_id) AS charge_ids,
                                                            array_agg(t1.currency)  AS currencies,
                                                            sum(t1.amount)          AS amount,
                                                            min(t1.event_date)      AS event_date,
                                                            min(t1.debit_date)      AS debit_date
                                                    FROM accounter_schema.business_trips_transactions_match tm
                                                                LEFT JOIN accounter_schema.extended_transactions t1 ON t1.id = tm.transaction_id
                                                    GROUP BY tm.business_trip_transaction_id)
    SELECT DISTINCT ON (btt.id) btt.id,
                                btt.business_trip_id,
                                t.transaction_ids,
                                t.charge_ids,
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
                                    WHEN t.business_trip_transaction_id IS NULL THEN ep.amount
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
            LEFT JOIN accounter_schema.business_trips_employee_payments ep ON ep.id = btt.id
    ORDER BY btt.id;

    alter table accounter_schema.business_trips_transactions
        drop column transaction_id;
`,
} satisfies MigrationExecutor;
