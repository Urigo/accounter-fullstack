import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-08-28T12-03-04.business-trip-car-rental-category.sql',
  run: ({ sql }) => sql`
        ALTER TYPE accounter_schema.business_trip_transaction_type ADD VALUE 'CAR_RENTAL';

        create or replace view accounter_schema.extended_business_trip_transactions
                (id, business_trip_id, transaction_ids, charge_ids, category, date, value_date, amount, currency,
                employee_business_id, payed_by_employee)
        as
        WITH transactions_by_business_trip_transaction AS (SELECT tm.business_trip_transaction_id,
                                                                array_agg(DISTINCT t1.id)                   AS transaction_ids,
                                                                array_agg(DISTINCT t1.charge_id)            AS charge_ids,
                                                                array_agg(DISTINCT t1.currency)             AS currencies,
                                                                sum(tm.amount - (COALESCE(misc.amount, 0))) AS amount,
                                                                min(t1.event_date)                          AS event_date,
                                                                min(t1.debit_date)                          AS debit_date
                                                        FROM (
                                                                accounter_schema.business_trips_transactions_match tm
                                                                        LEFT JOIN accounter_schema.extended_transactions t1 ON t1.id = tm.transaction_id
                                                                        LEFT JOIN (SELECT transaction_id, sum(amount) AS amount
                                                                                FROM accounter_schema.authorities_misc_expenses
                                                                                GROUP BY transaction_id) misc
                                                                ON misc.transaction_id = tm.transaction_id
                                                                )
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
                LEFT JOIN accounter_schema.business_trips_employee_payments ep ON ep.id = btt.id;

        create table accounter_schema.business_trips_transactions_car_rental
        (
        id              uuid                  not null
                constraint business_trips_transactions_car_rental_pk
                primary key,
        days            integer default 0     not null,
        is_fuel_expense boolean default FALSE not null
        );

`,
} satisfies MigrationExecutor;
