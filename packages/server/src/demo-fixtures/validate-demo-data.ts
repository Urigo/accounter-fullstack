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
    const adminCheck = await client.query(
      `SELECT id FROM accounter_schema.financial_entities WHERE type = 'business' AND name = 'Admin Business'`,
    );
    if (adminCheck.rows.length === 0) {
      errors.push('Admin business entity missing');
    }

    // 2. Use-case charge count reconciliation
    const useCases = getAllUseCases();
    const expectedChargeCount = useCases.reduce((sum, uc) => sum + uc.fixtures.charges.length, 0);
    const actualChargeCount = await client.query(`SELECT COUNT(*) FROM accounter_schema.charges`);
    if (parseInt(actualChargeCount.rows[0].count) !== expectedChargeCount) {
      errors.push(
        `Charge count mismatch: expected ${expectedChargeCount}, got ${actualChargeCount.rows[0].count}`,
      );
    }

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
