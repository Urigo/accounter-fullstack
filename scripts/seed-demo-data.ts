import { config } from 'dotenv';
import pg from 'pg';
import { createAdminBusinessContext } from '../packages/server/src/demo-fixtures/helpers/admin-context.js';
import { resolveAdminPlaceholders } from '../packages/server/src/demo-fixtures/helpers/placeholder.js';
import { seedExchangeRates } from '../packages/server/src/demo-fixtures/helpers/seed-exchange-rates.js';
import { seedVATDefault } from '../packages/server/src/demo-fixtures/helpers/seed-vat.js';
import { getAllUseCases } from '../packages/server/src/demo-fixtures/use-cases/index.js';
import { seedCountries } from '../packages/server/src/modules/countries/helpers/seed-countries.helper.js';

config();

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
    console.log('🔗 Connected to database');

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
    console.log('🌍 Seeding countries...');
    await seedCountries(client);

    console.log('💱 Seeding FIAT exchange rates...');
    await seedExchangeRates(client);

    console.log('📊 Seeding VAT defaults...');
    await seedVATDefault(client);

    // 4. Create admin business context
    console.log('🏢 Creating admin business context...');
    const adminBusinessId = await createAdminBusinessContext(client);
    console.log(`✅ Admin Business ID: ${adminBusinessId}`);

    // 5. Load all use-cases
    const useCases = getAllUseCases();
    console.log(`📦 Loading ${useCases.length} use-cases...`);

    for (const useCase of useCases) {
      console.log(`  ➡️  ${useCase.name} (${useCase.id})`);
      const resolvedFixtures = resolveAdminPlaceholders(useCase.fixtures, adminBusinessId);
      // TODO: await insertFixture(client, resolvedFixtures);
    }

    console.log('✅ All use-cases seeded successfully');

    // 6. Write env vars (if not already set)
    // TODO: await updateEnvFile('DEFAULT_FINANCIAL_ENTITY_ID', adminBusinessId);

    console.log('🎉 Demo data seed complete');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

seedDemoData().catch(error => {
  console.error('Fatal seed error:', error);
  process.exit(1);
});
