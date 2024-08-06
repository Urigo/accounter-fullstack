import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-08-06T08-47-51.business-trip-accountant-approval.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.business_trips
        add accountant_reviewed boolean default false not null;

    create or replace view accounter_schema.extended_business_trips(id, name, destination, trip_purpose, from_date, to_date, accountant_reviewed) as
        WITH business_trips_dates AS (SELECT business_trips_attendees.business_trip_id AS id,
                                            min(business_trips_attendees.arrival)     AS from_date,
                                            max(business_trips_attendees.departure)   AS to_date
                                      FROM accounter_schema.business_trips_attendees
                                      GROUP BY business_trips_attendees.business_trip_id)
        SELECT DISTINCT ON (bt.id) bt.id,
                                  bt.name,
                                  bt.destination,
                                  bt.trip_purpose,
                                  business_trips_dates.from_date,
                                  business_trips_dates.to_date,
                                  accountant_reviewed
        FROM accounter_schema.business_trips bt
                LEFT JOIN business_trips_dates ON business_trips_dates.id = bt.id
        ORDER BY bt.id, business_trips_dates.from_date;
`,
} satisfies MigrationExecutor;
