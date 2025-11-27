import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-11-27T10-39-53.user-roles.sql',
  run: ({ sql }) => sql`
    create table
    "accounter_schema"."users" (
      "name" TEXT not null,
      "id" uuid not null,
      "created" TIMESTAMPTZ not null default NOW(),
      "role" text null,
      constraint "users_pkey" primary key ("name")
    );

    ALTER TABLE
      accounter_schema.users
    ADD
      CONSTRAINT fk_users_id FOREIGN KEY (id) REFERENCES accounter_schema.financial_entities (id) ON UPDATE CASCADE ON DELETE CASCADE;
  `,
} satisfies MigrationExecutor;
