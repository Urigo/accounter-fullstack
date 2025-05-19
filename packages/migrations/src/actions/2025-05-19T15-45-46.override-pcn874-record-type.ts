import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-05-19T15-45-46.override-pcn874-record-type.sql',
  run: ({ sql }) => sql`
create type accounter_schema.pcn874_record_type as enum ('S1', 'S2', 'L1', 'L2', 'M', 'Y', 'I', 'T', 'K', 'R', 'P', 'H', 'C');

alter table accounter_schema.businesses
    add if not exists pcn874_record_type_override accounter_schema.pcn874_record_type;
`,
} satisfies MigrationExecutor;
