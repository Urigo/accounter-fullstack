import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-03-31T11-01-12.flight-class-type.sql',
  run: ({ sql }) => sql`
  -- create transaction fees table and migrate data from transactions
  
  create type accounter_schema.flight_class as enum ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST_CLASS');

  alter table accounter_schema.business_trips_transactions_flights
    alter column class type accounter_schema.flight_class using class::accounter_schema.flight_class;
`,
} satisfies MigrationExecutor;
