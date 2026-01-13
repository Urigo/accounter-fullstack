import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-01-13T12-00-49.add-property-vat-to-user-context.sql',
  run: ({ sql }) => sql`
    ALTER TABLE "accounter_schema"."user_context"
    ADD COLUMN "property_output_vat_tax_category_id" UUID NULL;

    ALTER TABLE "accounter_schema"."user_context"
    ADD CONSTRAINT "user_context_tax_categories_id_fk_39" FOREIGN KEY ("property_output_vat_tax_category_id") REFERENCES "accounter_schema"."tax_categories" ("id") ON UPDATE NO ACTION ON DELETE NO ACTION
`,
} satisfies MigrationExecutor;
