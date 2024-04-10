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
`,
} satisfies MigrationExecutor;
