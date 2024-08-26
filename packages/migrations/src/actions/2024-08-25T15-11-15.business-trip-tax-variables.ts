import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2024-08-25T15-11-15.business-trip-tax-variables.sql',
  run: ({ sql }) => sql`
    create table if not exists accounter_schema.business_trips_tax_variables
    (
    date                                       date    not null
            constraint business_trips_tax_variables_pk
            primary key,
    max_accommodation_per_night_first_7_nights numeric not null,
    max_accommodation_per_night_nights_8_to_90 numeric not null,
    max_car_rental_per_day                     numeric not null,
    max_tns_with_accommodation                 numeric not null,
    max_tns_without_accommodation              numeric not null
    );
`,
} satisfies MigrationExecutor;
