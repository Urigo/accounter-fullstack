/**
 * Demo Data Validation Script
 *
 * Validates the integrity of seeded demo data with comprehensive ledger validation.
 *
 * Validation Checks:
 * - Admin business entity exists
 * - Charge count matches expected
 * - Ledger records for each use-case:
 *   - Per-record internal balance (FR1)
 *   - Aggregate balance (FR2)
 *   - Entity-level balance (FR3)
 *   - No orphaned amounts (FR4)
 *   - Positive amounts only (FR5)
 *   - Foreign currency consistency (FR6)
 *   - Valid dates (FR7)
 *   - Record count matches (FR8)
 *
 * Exit codes:
 * - 0: All validations passed
 * - 1: Validation errors found or database connection failed
 */
import { config } from 'dotenv';
import pg from 'pg';
import { getAllUseCases } from './use-cases/index.js';
import { validateLedgerRecords } from './validators/ledger-validators.js';
import type { LedgerRecord, ValidationContext } from './validators/types.js';

config({
  path: '../../.env',
});

const DEFAULT_CURRENCY = 'ILS';
const BALANCE_TOLERANCE = 0.005;

/**
 * Main validation function - connects to DB and runs all checks
 */
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
      `SELECT id FROM accounter_schema.financial_entities WHERE type = 'business' AND name = 'Accounter Admin Business'`,
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

    // 3. Comprehensive ledger validation for all use-cases with expectations (FR9)
    const useCasesWithExpectations = useCases.filter(uc => uc.expectations);

    console.log(
      `\nValidating ledger records for ${useCasesWithExpectations.length} use-case(s)...`,
    );

    for (const useCase of useCasesWithExpectations) {
      // Get all charges for this use-case
      const chargeIds = useCase.fixtures.charges.map(c => c.id);

      // Fetch all ledger records for these charges
      const ledgerRecords = await client.query<LedgerRecord>(
        `SELECT * FROM accounter_schema.ledger_records WHERE charge_id = ANY($1) ORDER BY created_at`,
        [chargeIds],
      );

      if (ledgerRecords.rows.length === 0) {
        errors.push(`${useCase.id}: no ledger records found`);
        continue;
      }

      // Create validation context
      const context: ValidationContext = {
        useCaseId: useCase.id,
        defaultCurrency: DEFAULT_CURRENCY,
        tolerance: BALANCE_TOLERANCE,
      };

      // Run comprehensive validation
      const validationErrors = validateLedgerRecords(
        ledgerRecords.rows,
        useCase.expectations!.ledgerRecordCount,
        context,
      );

      errors.push(...validationErrors);

      // Log progress
      if (validationErrors.length === 0) {
        console.log(`  ✓ ${useCase.id} (${ledgerRecords.rows.length} records)`);
      } else {
        console.log(`  ✗ ${useCase.id} (${validationErrors.length} error(s))`);
      }
    }

    // 4. VAT row present (percentage stored as decimal 0.17 for 17%)
    const vatCheck = await client.query(
      `SELECT 1 FROM accounter_schema.vat_value WHERE percentage = 0.17`,
    );
    if (vatCheck.rows.length === 0) {
      errors.push('VAT default (17%) missing');
    }

    // Report errors or success
    if (errors.length > 0) {
      console.error('❌ Validation failed:');
      for (const err of errors) console.error(`  - ${err}`);
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
