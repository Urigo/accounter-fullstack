import type { Client, PoolClient } from 'pg';
import { makeUUID } from '../src/__tests__/factories/index.js';
import {
  ensureBusinessForEntity,
  ensureFinancialEntity,
  ensureTaxCategoryForEntity,
} from '../src/__tests__/helpers/seed-helpers.js';

/**
 * Seed minimal admin context required for Phase 1
 *
 * Creates:
 * - Admin business entity (self-owned)
 * - Authority businesses (VAT, Tax, Social Security)
 * - General tax categories (DEFAULT, Exchange Rates, etc.)
 * - Cross-year tax categories (Expenses to Pay, etc.)
 * - user_context row with ILS defaults
 *
 * @param client - PostgreSQL client (should be in a transaction for rollback safety)
 * @returns Promise resolving to admin entity ID
 */
export async function seedAdminCore(
  client: PoolClient | Client,
): Promise<{ adminEntityId: string }> {
  console.log('🌱 Starting admin context seed...');

  // 0. Ensure required reference data exists for FKs inside this transaction
  // Countries: 'ISR' is the default for businesses.country and user_context.locality
  try {
    await client.query(
      `INSERT INTO accounter_schema.countries (code, name)
       VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING`,
      ['ISR', 'Israel'],
    );
  } catch (e) {
    console.warn(
      '⚠️  Failed to ensure countries reference data (ISR). Subsequent inserts may fail:',
      e,
    );
  }

  // 1. Create admin business entity
  console.log('Creating admin business entity...');

  // First check if admin entity already exists (by name and type, ignoring owner_id for admin)
  const adminId = makeUUID('business', 'Admin Business');
  const { id } = await ensureFinancialEntity(client, {
    id: adminId,
    name: 'Admin Business',
    type: 'business',
  });
  const adminEntityId = id;
  console.log(`✅ Admin entity: ${adminEntityId}`);

  // Create corresponding business record
  await ensureBusinessForEntity(client, adminEntityId, { ownerId: adminEntityId });
  console.log('✅ Admin business record created');

  // Update owner_id to self
  await client.query(`UPDATE accounter_schema.financial_entities SET owner_id = $1 WHERE id = $1`, [
    adminEntityId,
  ]);
  console.log('✅ Admin entity owner_id set to self');

  // 2. Create authority businesses
  const authorities = {
    businesses: ['VAT', 'Tax', 'Social Security'],
    taxCategories: ['Input Vat', 'Output Vat', 'Property Output Vat', 'Tax Expenses'],
  };

  console.log('Creating authority businesses...');
  const authorityBusinessIds: Record<string, string> = {};
  for (const name of authorities.businesses) {
    const { id } = await ensureFinancialEntity(client, {
      name,
      type: 'business',
      ownerId: adminEntityId,
    });
    authorityBusinessIds[name] = id;
    await ensureBusinessForEntity(client, id, {
      isDocumentsOptional: true,
      ownerId: adminEntityId,
    });
  }
  console.log(`✅ Created ${authorities.businesses.length} authority businesses`);

  // 3. Create authority tax categories
  console.log('Creating authority tax categories...');
  const authorityTaxCategoryIds: Record<string, string> = {};
  for (const name of authorities.taxCategories) {
    const { id } = await ensureFinancialEntity(client, {
      name,
      type: 'tax_category',
      ownerId: adminEntityId,
    });
    authorityTaxCategoryIds[name] = id;
    await ensureTaxCategoryForEntity(client, id, { ownerId: adminEntityId });
  }
  console.log(`✅ Created ${authorities.taxCategories.length} authority tax categories`);

  // 4. Create general tax categories
  const generalTaxCategories = [
    'DEFAULT (missing)',
    'Exchange Rates',
    'Income Exchange Rates',
    'Exchange Revaluation',
    'Fee',
    'General Fee',
    'Fine',
    'Untaxable Gifts',
    'Balance Cancellation',
    'Development Foreign',
    'Development Local',
    'Salary Excess Expenses',
  ];

  console.log('Creating general tax categories...');
  const generalTaxCategoryIds: Record<string, string> = {};
  for (const name of generalTaxCategories) {
    const { id } = await ensureFinancialEntity(client, {
      name,
      type: 'tax_category',
      ownerId: adminEntityId,
    });
    generalTaxCategoryIds[name] = id;
    await ensureTaxCategoryForEntity(client, id, { ownerId: adminEntityId });
  }
  console.log(`✅ Created ${generalTaxCategories.length} general tax categories`);

  // 5. Create cross-year tax categories
  const crossYearTaxCategories = [
    'Expenses to Pay',
    'Expenses in Advance',
    'Income to Collect',
    'Income in Advance',
  ];

  console.log('Creating cross-year tax categories...');
  const crossYearTaxCategoryIds: Record<string, string> = {};
  for (const name of crossYearTaxCategories) {
    const { id } = await ensureFinancialEntity(client, {
      name,
      type: 'tax_category',
      ownerId: adminEntityId,
    });
    crossYearTaxCategoryIds[name] = id;
    await ensureTaxCategoryForEntity(client, id, { ownerId: adminEntityId });
  }
  console.log(`✅ Created ${crossYearTaxCategories.length} cross-year tax categories`);

  // 6. Build user_context insert
  const context = {
    owner_id: adminEntityId,
    default_local_currency: 'ILS',
    default_fiat_currency_for_crypto_conversions: 'USD',
    default_tax_category_id: generalTaxCategoryIds['DEFAULT (missing)'],
    vat_business_id: authorityBusinessIds['VAT'],
    input_vat_tax_category_id: authorityTaxCategoryIds['Input Vat'],
    output_vat_tax_category_id: authorityTaxCategoryIds['Output Vat'],
    property_output_vat_tax_category_id: authorityTaxCategoryIds['Property Output Vat'],
    tax_business_id: authorityBusinessIds['Tax'],
    tax_expenses_tax_category_id: authorityTaxCategoryIds['Tax Expenses'],
    social_security_business_id: authorityBusinessIds['Social Security'],
    exchange_rate_tax_category_id: generalTaxCategoryIds['Exchange Rates'],
    income_exchange_rate_tax_category_id: generalTaxCategoryIds['Income Exchange Rates'],
    exchange_rate_revaluation_tax_category_id: generalTaxCategoryIds['Exchange Revaluation'],
    fee_tax_category_id: generalTaxCategoryIds['Fee'],
    general_fee_tax_category_id: generalTaxCategoryIds['General Fee'],
    fine_tax_category_id: generalTaxCategoryIds['Fine'],
    untaxable_gifts_tax_category_id: generalTaxCategoryIds['Untaxable Gifts'],
    balance_cancellation_tax_category_id: generalTaxCategoryIds['Balance Cancellation'],
    development_foreign_tax_category_id: generalTaxCategoryIds['Development Foreign'],
    development_local_tax_category_id: generalTaxCategoryIds['Development Local'],
    expenses_to_pay_tax_category_id: crossYearTaxCategoryIds['Expenses to Pay'],
    expenses_in_advance_tax_category_id: crossYearTaxCategoryIds['Expenses in Advance'],
    income_to_collect_tax_category_id: crossYearTaxCategoryIds['Income to Collect'],
    income_in_advance_tax_category_id: crossYearTaxCategoryIds['Income in Advance'],
    salary_excess_expenses_tax_category_id: generalTaxCategoryIds['Salary Excess Expenses'],
    date_established: '2020-01-01',
    initial_accounter_year: 2020,
  };

  // Check if user_context already exists
  const existingContext = await client.query(
    `SELECT 1 FROM accounter_schema.user_context WHERE owner_id = $1 LIMIT 1`,
    [adminEntityId],
  );

  if (existingContext.rows.length === 0) {
    console.log('Creating user_context...');
    const columns = Object.keys(context).join(', ');
    const placeholders = Object.keys(context)
      .map((_, i) => `$${i + 1}`)
      .join(', ');
    const values = Object.values(context);

    await client.query(
      `INSERT INTO accounter_schema.user_context (${columns}) VALUES (${placeholders}) ON CONFLICT (owner_id) DO NOTHING`,
      values,
    );
    console.log('✅ user_context created');
  } else {
    console.log('ℹ️  user_context already exists, skipping insert');
  }

  console.log('🎉 Admin context seed complete!');
  return { adminEntityId };
}
