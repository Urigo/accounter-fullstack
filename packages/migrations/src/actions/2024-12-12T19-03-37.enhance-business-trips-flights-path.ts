import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-12-12T19-03-37.enhance-business-trips-flights-path.sql',
  run: ({ sql }) => sql`
    alter table accounter_schema.business_trips_transactions_flights
      add path text[];

    UPDATE accounter_schema.business_trips_transactions_flights
    SET path = CASE WHEN origin IS NOT NULL THEN array_append(COALESCE(path, ARRAY []::TEXT[]), origin) END;

    UPDATE accounter_schema.business_trips_transactions_flights
    SET path = CASE WHEN destination IS NOT NULL THEN array_append(COALESCE(path, ARRAY []::TEXT[]), destination) END;

    alter table accounter_schema.business_trips_transactions_flights
      drop column origin;

    alter table accounter_schema.business_trips_transactions_flights
      drop column destination;
`,
} satisfies MigrationExecutor;
