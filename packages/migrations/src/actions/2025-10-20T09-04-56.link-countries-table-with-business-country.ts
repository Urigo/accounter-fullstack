import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-10-20T09-04-56.link-countries-table-with-business-country.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  "accounter_schema"."user_context"
ADD COLUMN
  "locality" VARCHAR(3) DEFAULT 'ISR' NOT NULL;

ALTER TABLE
  "accounter_schema"."user_context"
ADD
  CONSTRAINT "user_context_countries_code_fk" FOREIGN KEY ("locality") REFERENCES "accounter_schema"."countries" ("code") ON UPDATE NO ACTION ON DELETE NO ACTION;

ALTER TABLE
  "accounter_schema"."businesses"
ALTER COLUMN
  "country"
SET DEFAULT
  'ILS'::varchar(3),
ALTER COLUMN
  "country"
TYPE
  varchar(3);

ALTER TABLE
  "accounter_schema"."businesses"
ADD
  CONSTRAINT "businesses_countries_code_fk" FOREIGN KEY ("country") REFERENCES "accounter_schema"."countries" ("code") ON UPDATE NO ACTION ON DELETE NO ACTION
`,
} satisfies MigrationExecutor;
