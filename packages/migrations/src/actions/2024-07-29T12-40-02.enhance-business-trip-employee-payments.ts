import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-07-29T12-40-02.enhance-business-trip-employee-payments.sql',
  run: ({ sql }) => sql`
    create table if not exists accounter_schema.business_trips_employee_payments
    (
        charge_id            uuid                      not null
            constraint business_trips_employee_payments_charges_id_fk
                references accounter_schema.charges,
        date                 date                      not null,
        amount               numeric(9, 2)             not null,
        currency             accounter_schema.currency not null,
        employee_business_id uuid                      not null
            constraint business_trips_employee_payments_businesses_id_fk
                references accounter_schema.businesses,
        value_date           date,
        id                   uuid                      not null
            constraint business_trips_employee_payments_pk
                primary key
            constraint business_trips_employee_payments_business_trips_transactions_id
                references accounter_schema.business_trips_transactions
    );

    create or replace view accounter_schema.extended_business_trips
        (id, name, destination, trip_purpose, from_date, to_date)
    as
    WITH business_trips_dates AS (SELECT business_trip_id AS id,
                                        MIN(arrival)     AS from_date,
                                        MAX(departure)   AS to_date
                                  FROM accounter_schema.business_trips_attendees
                                  GROUP BY business_trips_attendees.business_trip_id)
    SELECT DISTINCT ON (bt.id) bt.id,
                              bt.name,
                              bt.destination,
                              bt.trip_purpose,
                              business_trips_dates.from_date,
                              business_trips_dates.to_date
    FROM accounter_schema.business_trips bt
            LEFT JOIN business_trips_dates ON business_trips_dates.id = bt.id
    ORDER BY bt.id, business_trips_dates.from_date;

    create or replace view accounter_schema.extended_business_trip_transactions
                (id, business_trip_id, transaction_id, category, date, value_date, amount, currency, employee_business_id,
                payed_by_employee)
    as
    SELECT DISTINCT ON (btt.id) btt.id,
                                btt.business_trip_id,
                                t.id                                                                                     AS transaction_id,
                                btt.category,
                                CASE
                                    WHEN (btt.transaction_id IS NULL) THEN ep.date
                                    ELSE t.event_date END                                                                AS date,
                                CASE
                                    WHEN (btt.transaction_id IS NULL) THEN ep.value_date
                                    ELSE t.debit_date END                                                                AS value_date,
                                CASE
                                    WHEN (btt.transaction_id IS NULL) THEN ep.amount
                                    ELSE t.amount END                                                                    AS amount,
                                CASE
                                    WHEN (btt.transaction_id IS NULL) THEN ep.currency
                                    ELSE t.currency END                                                                  AS currency,
                                ep.employee_business_id,
                                btt.transaction_id IS NULL                                                               AS payed_by_employee
    FROM accounter_schema.business_trips_transactions btt
            LEFT JOIN accounter_schema.transactions t ON t.id = btt.transaction_id
            LEFT JOIN accounter_schema.business_trips_employee_payments ep ON ep.id = btt.id
    ORDER BY btt.id;

    alter table accounter_schema.business_trips_transactions
        drop constraint require_info_if_no_linked_transaction;
    
    alter table accounter_schema.business_trips_transactions
        drop column date;

    alter table accounter_schema.business_trips_transactions
        drop column amount;

    alter table accounter_schema.business_trips_transactions
        drop column currency;

    alter table accounter_schema.business_trips_transactions
        drop column employee_business_id;

    alter table accounter_schema.business_trips_transactions
        drop column payed_by_employee;

    alter table accounter_schema.business_trips_transactions
        drop column value_date;
`,
} satisfies MigrationExecutor;
