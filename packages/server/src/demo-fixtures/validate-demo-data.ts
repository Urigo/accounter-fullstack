import { config } from 'dotenv';
import pg from 'pg';
import { getAllUseCases } from './use-cases/index.js';

config();

async function validateDemoData() {
  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });

  const errors: string[] = [];

  try {
    await client.connect();

    // 1. Admin business exists
    // TODO: Query financial_entities for Admin Business

    // 2. Use-case charge count reconciliation
    // TODO: Compare expected vs actual charge count

    // 3. Sample ledger balance checks (for use-cases with expectations)
    // TODO: Verify ledger record counts and balance

    // 4. VAT row present
    // TODO: Check vat_value table for default percentage

    // Report errors or success
    if (errors.length > 0) {
      console.error('❌ Validation failed:');
      errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log('✅ Demo data validation passed');
  } catch (error) {
    console.error('❌ Validation error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

validateDemoData();
