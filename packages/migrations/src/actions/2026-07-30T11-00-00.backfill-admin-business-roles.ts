import { type MigrationExecutor } from '../pg-migrator.js';

export default {
  name: '2026-07-30T11-00-00.backfill-admin-business-roles.sql',
  run: ({ sql }) => sql`
    -- Backfill admin_business_roles from the existing per-institution columns on
    -- user_context, preserving current admin-context behavior once the provider
    -- stops enumerating those columns/UUIDs in code (#3612).
    --
    -- Runs under the migration's privileged (RLS-bypassing) connection, so it sees
    -- and writes every tenant's rows regardless of FORCE ROW LEVEL SECURITY.
    INSERT INTO accounter_schema.admin_business_roles (owner_id, business_id, role)
    SELECT owner_id, business_id, role
    FROM (
      SELECT owner_id, poalim_business_id AS business_id, 'BANK_ACCOUNT'::accounter_schema.admin_business_role AS role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, discount_business_id, 'BANK_ACCOUNT'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, otsar_hahayal_business_id, 'BANK_ACCOUNT'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, isracard_business_id, 'CREDIT_CARD'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, amex_business_id, 'CREDIT_CARD'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, cal_business_id, 'CREDIT_CARD'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, otsar_hahayal_credit_card_business_id, 'CREDIT_CARD'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, etana_business_id, 'CRYPTO_WALLET'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, kraken_business_id, 'CRYPTO_WALLET'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, etherscan_business_id, 'CRYPTO_WALLET'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, vat_business_id, 'VAT_EXCLUDED'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, tax_business_id, 'VAT_EXCLUDED'::accounter_schema.admin_business_role FROM accounter_schema.user_context
      UNION ALL
      SELECT owner_id, social_security_business_id, 'VAT_EXCLUDED'::accounter_schema.admin_business_role FROM accounter_schema.user_context
    ) roles
    WHERE business_id IS NOT NULL
    ON CONFLICT DO NOTHING;

    -- Dividend-payment businesses were previously a hardcoded, GLOBAL array of two
    -- UUIDs applied to every tenant (a cross-tenant leak). Re-home each UUID to the
    -- single tenant that actually owns it, so it only surfaces for that tenant.
    INSERT INTO accounter_schema.admin_business_roles (owner_id, business_id, role)
    SELECT fe.owner_id, fe.id, 'DIVIDEND_PAYMENT'::accounter_schema.admin_business_role
    FROM accounter_schema.financial_entities fe
    WHERE fe.id IN (
      '4bcca705-5b47-41c5-ba26-1e42c69cbf0d', -- Uri Dividend
      '909fbe3c-0419-44ed-817d-ab774e93748a'  -- Dotan Dividend
    )
      AND fe.owner_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  `,
} satisfies MigrationExecutor;
