import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-08-13T12-57-25.attendees-info-for-trip-accommodation-flights-expenses.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.business_trips_transactions_flights
        add attendees uuid[] default array []::uuid[] not null;

    alter table accounter_schema.business_trips_transactions_accommodations
        add attendees_stay jsonb[] default array []::jsonb[] not null;
`,
} satisfies MigrationExecutor;
