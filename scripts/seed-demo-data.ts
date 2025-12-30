import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from 'dotenv';
import pg from 'pg';
import { insertFixture } from '../packages/server/src/__tests__/helpers/fixture-loader.js';
import type {
  Fixture,
  FixtureAccountTaxCategories,
} from '../packages/server/src/__tests__/helpers/fixture-types.js';
import { createAdminBusinessContext } from '../packages/server/src/demo-fixtures/helpers/admin-context.js';
import { resolveAdminPlaceholders } from '../packages/server/src/demo-fixtures/helpers/placeholder.js';
import { seedExchangeRates } from '../packages/server/src/demo-fixtures/helpers/seed-exchange-rates.js';
import { seedVATDefault } from '../packages/server/src/demo-fixtures/helpers/seed-vat.js';
import { getAllUseCases } from '../packages/server/src/demo-fixtures/use-cases/index.js';
import type { FixtureSpec } from '../packages/server/src/fixtures/fixture-spec.js';
import { seedCountries } from '../packages/server/src/modules/countries/helpers/seed-countries.helper.js';

config();

/**
 * Custom error class for demo seeding failures
 * Preserves stack trace and provides context for debugging
 */
class DemoSeedError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DemoSeedError';
    // Preserve original stack if available
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/**
 * Convert use-case fixtures to the format expected by insertFixture
 *
 * This function bridges the semantic use-case fixture format (optimized for
 * demo data authoring) and the test fixture format (optimized for database
 * insertion). The conversion handles:
 *
 * - Field name mapping (e.g., ownerId → owner_id, canSettleWithReceipt → isReceiptEnough)
 * - Nested structure flattening (e.g., taxCategoryMappings array)
 * - Type conversions (string → number for amounts)
 * - Default value injection for NOT NULL database columns
 *
 * @param useCaseFixtures - Use-case format fixtures from registry
 * @returns Fixture object ready for insertFixture() helper
 *
 * @example
 * ```typescript
 * const useCase = getAllUseCases()[0];
 * const testFixture = convertUseCaseFixtureToFixture(useCase.fixtures);
 * await insertFixture(client, testFixture);
 * ```
 *
 * @remarks
 * - Admin business is NOT included by default; caller must inject it
 * - Account numbers are used for account_id references (resolved by fixture-loader)
 * - All optional fields receive safe defaults to satisfy database constraints
 */
function convertUseCaseFixtureToFixture(useCaseFixtures: FixtureSpec): Fixture {
  const fixture: Fixture = {};

  if (useCaseFixtures.businesses && useCaseFixtures.businesses.length > 0) {
    fixture.businesses = {
      businesses: useCaseFixtures.businesses.map(b => ({
        id: b.id,
        name: b.name || b.id,
        hebrewName: b.name,
        country: b.country,
        isReceiptEnough: b.canSettleWithReceipt,
        isDocumentsOptional: false,
        exemptDealer: false,
        optionalVat: false,
        address: null,
        email: null,
        website: null,
        phoneNumber: null,
        governmentId: null,
        suggestions: null,
        pcn874RecordTypeOverride: null,
      })),
    };
  }

  if (useCaseFixtures.taxCategories && useCaseFixtures.taxCategories.length > 0) {
    fixture.taxCategories = {
      taxCategories: useCaseFixtures.taxCategories.map(tc => ({
        id: tc.id,
        name: tc.name,
        hashavshevetName: null,
        taxExcluded: false,
      })),
    };
  }

  if (useCaseFixtures.financialAccounts && useCaseFixtures.financialAccounts.length > 0) {
    fixture.accounts = {
      accounts: useCaseFixtures.financialAccounts.map(fa => ({
        accountNumber: fa.accountNumber,
        type: fa.type,
        privateBusiness: 'Private',
        ownerId: null,
      })),
    };

    const mappings: FixtureAccountTaxCategories['mappings'] =
      useCaseFixtures.financialAccounts.flatMap(fa =>
        (fa.taxCategoryMappings || []).map(tcm => ({
          accountNumber: fa.accountNumber,
          currency: tcm.currency,
          taxCategoryId: tcm.taxCategoryId,
        })),
      );

    if (mappings.length > 0) {
      fixture.accountTaxCategories = { mappings };
    }
  }

  if (useCaseFixtures.charges && useCaseFixtures.charges.length > 0) {
    fixture.charges = {
      charges: useCaseFixtures.charges.map(c => ({
        id: c.id,
        owner_id: c.ownerId,
        user_description: c.userDescription,
        is_property: false,
        type: null,
        optional_vat: false,
        accountant_status: 'PENDING',
        documents_optional_flag: false,
        tax_category_id: null,
      })),
    };
  }

  if (useCaseFixtures.transactions && useCaseFixtures.transactions.length > 0) {
    fixture.transactions = {
      transactions: useCaseFixtures.transactions.map(t => ({
        id: t.id,
        charge_id: t.chargeId,
        business_id: t.businessId,
        account_id: t.accountNumber, // Will be resolved to UUID by fixture-loader
        amount: t.amount,
        currency: t.currency,
        event_date: t.eventDate,
        debit_date: t.debitDate,
        source_id: 'DEMO_SEED',
      })),
    };
  }

  if (useCaseFixtures.documents && useCaseFixtures.documents.length > 0) {
    fixture.documents = {
      documents: useCaseFixtures.documents.map(d => ({
        id: d.id,
        charge_id: d.chargeId,
        creditor_id: d.creditorId,
        debtor_id: d.debtorId,
        serial_number: d.serialNumber,
        type: d.type,
        date: d.date,
        total_amount: Number(d.totalAmount),
        currency_code: d.currencyCode,
      })),
    };
  }

  return fixture;
}

async function seedDemoData() {
  // 1. Guard checks
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Refusing to seed demo data in production environment');
    process.exit(1);
  }

  if (process.env.ALLOW_DEMO_SEED !== '1') {
    console.error('❌ ALLOW_DEMO_SEED=1 required to run demo seed');
    process.exit(1);
  }

  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 2. Destructive reset (domain tables only; preserve schema/migrations/countries)
    console.log('🧹 Clearing existing demo data...');
    await client.query(`
      TRUNCATE TABLE accounter_schema.ledger_records,
                     accounter_schema.documents,
                     accounter_schema.transactions,
                     accounter_schema.charges,
                     accounter_schema.financial_accounts_tax_categories,
                     accounter_schema.financial_accounts,
                     accounter_schema.tags,
                     accounter_schema.tax_categories,
                     accounter_schema.businesses,
                     accounter_schema.user_context,
                     accounter_schema.financial_entities
      RESTART IDENTITY CASCADE;
    `);
    console.log('✅ Domain tables cleared');

    // 3. Seed foundation data
    console.log('✅ Seeding countries...');
    await seedCountries(client);

    console.log('✅ Seeding FIAT exchange rates...');
    await seedExchangeRates(client);

    console.log('✅ Seeding VAT defaults...');
    await seedVATDefault(client);

    // 4. Create admin business context
    console.log('✅ Creating admin business context...');
    const adminBusinessId = await createAdminBusinessContext(client);
    console.log(`✅ Admin Business ID: ${adminBusinessId}`);

    // 5. Load all use-cases
    const useCases = getAllUseCases();
    console.log(`📦 Loading ${useCases.length} use-cases...`);

    // Begin transaction for fixture insertion
    await client.query('BEGIN');
    try {
      for (const useCase of useCases) {
        console.log(`📦 ${useCase.name} (${useCase.id})`);
        const resolvedUseCaseFixtures = resolveAdminPlaceholders(useCase.fixtures, adminBusinessId);
        const fixture = convertUseCaseFixtureToFixture(resolvedUseCaseFixtures);

        // Inject admin business into every fixture to satisfy foreign key constraints
        // (charges.owner_id, documents.creditor_id/debtor_id may reference admin business)
        fixture.businesses ||= {
          businesses: [],
        };

        // Check if admin business is already in the list (avoid duplicate insertions)
        // Some use-cases may define admin explicitly; most rely on injection here
        const adminExists = fixture.businesses.businesses.some(b => b.id === adminBusinessId);
        if (!adminExists) {
          fixture.businesses.businesses.push({
            id: adminBusinessId,
            name: 'Accounter Admin Business',
            country: 'ISR',
            isReceiptEnough: false,
            isDocumentsOptional: false,
            exemptDealer: false,
            optionalVat: false,
            address: null,
            email: null,
            website: null,
            phoneNumber: null,
            governmentId: null,
            suggestions: null,
            pcn874RecordTypeOverride: null,
          });
        }

        await insertFixture(client, fixture);
      }
      await client.query('COMMIT');
      console.log('✅ All use-cases seeded successfully');
    } catch (fixtureError) {
      await client.query('ROLLBACK');
      throw new DemoSeedError('Fixture insertion failed', fixtureError);
    }

    // 6. Write env vars (if not already set)
    await updateEnvFile('DEFAULT_FINANCIAL_ENTITY_ID', adminBusinessId);

    console.log('✅ Demo data seed complete');
  } catch (error) {
    console.error('❌ Seed failed:');
    if (error instanceof DemoSeedError) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    } else if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
    throw new DemoSeedError('Demo data seed failed', error);
  } finally {
    await client.end();
  }
}

async function updateEnvFile(key: string, value: string) {
  const envPath = path.resolve(process.cwd(), '.env');

  try {
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Check if the variable already exists
    if (envContent.match(new RegExp(`^${key}=`, 'm'))) {
      // Replace existing value
      envContent = envContent.replace(new RegExp(`^${key}=.*`, 'm'), `${key}=${value}`);
    } else {
      // Add new value
      envContent += `\n${key}=${value}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated .env file with ${key}`);
  } catch (error) {
    console.warn(`⚠️ Failed to update .env file for ${key}:`, error);
  }
}

seedDemoData().catch(error => {
  console.error('❌ Fatal seed error');
  console.error('Error object:', error);
  console.error('Error type:', typeof error);
  if (error instanceof DemoSeedError) {
    console.error('Stack:', error.stack);
  } else if (error instanceof Error) {
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  } else {
    console.error('Unknown error:', error);
  }
  process.exit(1);
});
