import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2025-12-22T13-49-25.enrich-business-with-city-zip.sql',
  run: ({ sql }) => sql`
    ALTER TABLE
      "accounter_schema"."businesses"
    ADD COLUMN
      "city" VARCHAR(50) NULL,
    ADD COLUMN
      "zip_code" VARCHAR(15) NULL;
    DROP COLUMN
      "password",
    DROP COLUMN
      "tax_siduri_number_2021",
    DROP COLUMN
      "username_vat_website",
    DROP COLUMN
      "website_login_screenshot",
    DROP COLUMN
      "pinkas_social_security_2021",
    DROP COLUMN
      "tax_pinkas_number_2020",
    DROP COLUMN
      "wizcloud_token",
    DROP COLUMN
      "wizcloud_company_id",
    DROP COLUMN
      "advance_tax_rate",
    DROP COLUMN
      "bank_account_bank_number",
    DROP COLUMN
      "bank_account_branch_number",
    DROP COLUMN
      "bank_account_account_number",
    DROP COLUMN
      "bank_account_IBAN",
    DROP COLUMN
      "tax_nikuim_pinkas_number",
    DROP COLUMN
      "bank_account_swift",
    DROP COLUMN
      "vat_report_cadence",
    DROP COLUMN
      "contract",
    DROP COLUMN
      "tax_siduri_number_2022",
    DROP COLUMN
      "pinkas_social_security_2022",
    DROP COLUMN
      "registration_date",
    DROP COLUMN
      "is_authority",
    DROP COLUMN
      "nikuim";
  `,
} satisfies MigrationExecutor;
