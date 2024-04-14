import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-04-10T15-04-24.business-trips-attendees-dates.sql',
  run: ({ sql }) => sql`
  alter table accounter_schema.business_trips_attendees
    add arrival date;

  alter table accounter_schema.business_trips_attendees
    add departure date;

  alter table accounter_schema.business_trips
    drop column from_date;

  alter table accounter_schema.business_trips
    drop column to_date;

  create or replace view accounter_schema.extended_business_trips
    (id, name, destination, trip_purpose, from_date, to_date)
  as
  SELECT DISTINCT ON (bt.id) bt.id,
    bt.name,
    bt.destination,
    bt.trip_purpose,
    a.from_date,
    a.to_date
  FROM accounter_schema.business_trips bt
    LEFT JOIN (SELECT business_trip_id                AS id,
      MIN(arrival)                                    AS from_date,
      MAX(departure)                                  AS to_date
    FROM accounter_schema.business_trips_attendees
    GROUP BY business_trips_attendees.business_trip_id) a ON a.id = bt.id
  ORDER BY bt.id, a.from_date;

  create or replace view accounter_schema.extended_business_trip_transactions(id, business_trip_id, transaction_id, category, date, value_date, amount, currency, employee_business_id, payed_by_employee) as
  SELECT DISTINCT ON (btt.id) btt.id,
    btt.business_trip_id,
    t.id,
    btt.category,
    COALESCE (btt.date, t.event_date) as date,
    COALESCE (btt.value_date, t.debit_date) as value_date,
    COALESCE (btt.amount, t.amount) as amount,
    COALESCE(btt.currency, t.currency),
    btt.employee_business_id,
    btt.payed_by_employee
  FROM accounter_schema.business_trips_transactions btt
    LEFT JOIN accounter_schema.transactions t ON t.id = btt.transaction_id
  ORDER BY btt.id;

  alter table accounter_schema.business_trips_transactions
    alter column category set not null;
`,
} satisfies MigrationExecutor;
