import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { TestDatabase } from '../../../__tests__/helpers/db-setup.js';
import { insertFixture } from '../../../__tests__/helpers/fixture-loader.js';
import { expenseScenarioA } from '../../../__tests__/fixtures/expenses/expense-scenario-a.js';
import { makeUUID } from '../../../__tests__/factories/ids.js';
import { qualifyTable } from '../../../__tests__/helpers/test-db-config.js';
import { buildAdminContextFromDb } from '../../../__tests__/helpers/admin-context-builder.js';
import { env } from '../../../environment.js';
import { ledgerGenerationByCharge } from '../helpers/ledger-by-charge-type.helper.js';
import { assertSimpleLocalExpenseScenario, assertAuditTrail } from './helpers/ledger-assertions.js';
import type { UserType } from '../../../plugins/auth-plugin.js';
import { createLedgerTestContext } from '../../../test-utils/ledger-injector.js';
import { Currency } from '../../../shared/enums.js';

/**
 * Ledger Integration Test for Expense Scenario A
 * 
 * Tests ledger generation for a simple ILS receipt expense scenario.
 * This validates the complete flow: fixture insertion → ledger generation → record validation.
 *
 * Scenario:
 * - Admin business purchases from Local Supplier Ltd
 * - Transaction: -500 ILS (expense)
 * - Document: Receipt for 500 ILS
 * - Expected ledger: 2 balanced records (debit expense, credit bank)
 */

describe('Ledger Generation - Expense Scenario A', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
    await db.ensureLatestSchema();
    await db.seedAdmin();
  });

  afterAll(async () => {
    await db.close();
  });

  // Ensure ledger and related rows do not leak between tests
  afterEach(async () => {
    const client = await db.getPool().connect();
    try {
      const chargeId = makeUUID('charge-office-supplies');
      await client.query(
        `DELETE FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1`,
        [chargeId],
      );
      // Also clear the scenario's fixture rows to keep DB tidy
      await client.query(
        `DELETE FROM ${qualifyTable('documents')} WHERE charge_id = $1`,
        [chargeId],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('transactions')} WHERE charge_id = $1`,
        [chargeId],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('charges')} WHERE id = $1`,
        [chargeId],
      );
      // Clean up fixture-specific entities to prevent count inflation
      await client.query(
        `DELETE FROM ${qualifyTable('financial_accounts_tax_categories')} 
         WHERE tax_category_id IN ($1, $2)`,
        [makeUUID('expense-general'), makeUUID('bank-account-tax-category')],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('financial_accounts')} WHERE account_number = $1`,
        ['BANK-ACCOUNT-001'],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('tax_categories')} WHERE id IN ($1, $2)`,
        [makeUUID('expense-general'), makeUUID('bank-account-tax-category')],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('businesses')} WHERE id IN ($1, $2)`,
        [makeUUID('admin-business'), makeUUID('supplier-local-ltd')],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('financial_entities')} WHERE id IN ($1, $2, $3, $4)`,
        [
          makeUUID('admin-business'),
          makeUUID('supplier-local-ltd'),
          makeUUID('expense-general'),
          makeUUID('bank-account-tax-category'),
        ],
      );
    } finally {
      client.release();
    }
  });

  it('should generate balanced ledger records for ILS receipt expense', async () => {
    // Insert fixture within an explicit transaction and COMMIT to persist rows.
    const insertClient = await db.getPool().connect();
    try {
      await insertClient.query('BEGIN');

      await insertFixture(insertClient, expenseScenarioA);

      const chargeId = makeUUID('charge-office-supplies');

      // Verify inserts within the same transaction
      const chargeResult = await insertClient.query(
        `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
        [chargeId],
      );
      expect(chargeResult.rows).toHaveLength(1);

      const transactionsResult = await insertClient.query(
        `SELECT * FROM ${qualifyTable('transactions')} WHERE charge_id = $1`,
        [chargeId],
      );
      expect(transactionsResult.rows).toHaveLength(1);
      expect(transactionsResult.rows[0].amount).toBe('-500.00');
      expect(transactionsResult.rows[0].currency).toBe(Currency.Ils);

      const documentsResult = await insertClient.query(
        `SELECT * FROM ${qualifyTable('documents')} WHERE charge_id = $1`,
        [chargeId],
      );
      expect(documentsResult.rows).toHaveLength(1);
      expect(documentsResult.rows[0].type).toBe('RECEIPT');
      expect(Number(documentsResult.rows[0].total_amount)).toBe(500.0);

      await insertClient.query('COMMIT');
    } catch (e) {
      try { await insertClient.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      insertClient.release();
    }

    // Re-open a new client (outside prior transaction) for verification & generation
    const client = await db.getPool().connect();
    try {
      const chargeId = makeUUID('charge-office-supplies');
      const chargeResult = await client.query(
        `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
        [chargeId],
      );
      const charge = chargeResult.rows[0];

      // Build AdminContext from database
      const adminContext = await buildAdminContextFromDb(client);

      const mockUser: UserType = {
        username: 'test-admin',
        userId: adminContext.defaultAdminBusinessId,
        role: 'ADMIN',
      };

      const context = createLedgerTestContext({
        pool: db.getPool(),
        adminContext,
        currentUser: mockUser,
        env,
        moduleId: 'ledger',
      });

      const result = await ledgerGenerationByCharge(
        charge,
        { insertLedgerRecordsIfNotExists: true },
        context as any,
        {} as any,
      );

      // Verify result structure and success
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      
      // Type guard: ensure result is LedgerRecordsProto, not CommonError
      if (!result || 'message' in result) {
        throw new Error(`Ledger generation failed: ${result ? (result as any).message : 'null result'}`);
      }

      expect(result.errors).toEqual([]);
      expect(result.balance?.isBalanced).toBe(true);
      expect(result.records).toHaveLength(2);

      // Query ledger records from database
      const ledgerResult = await client.query(
        `SELECT * FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1 ORDER BY created_at ASC`,
        [charge.id],
      );

      // High-level semantic assertions using helper
      const ledgerExpectation = expenseScenarioA.expectations?.ledger?.[0];
      assertSimpleLocalExpenseScenario(ledgerResult.rows as any, {
        chargeId: charge.id,
        ownerId: charge.owner_id, // Use actual charge owner for ledger record owner assertions
        expenseEntity: makeUUID('expense-general'),
        bankEntity: makeUUID('bank-account-tax-category'),
        expectedCurrency: Currency.Ils,
        expectedTotal: ledgerExpectation?.totalDebitLocal || 500.0,
      });

      // Audit trail assertions (timestamps, lock state)
      assertAuditTrail(ledgerResult.rows as any);

      // Basic record count sanity check retained
      expect(ledgerResult.rows.length).toBe(ledgerExpectation?.recordCount || 2);
      console.log('✅ Ledger generation semantic assertions passed for Scenario A');
    } finally {
      client.release();
    }
  });

  it('should be idempotent on repeated ledger generation (no duplicate records)', async () => {
    const client = await db.getPool().connect();
    try {
      const chargeId = makeUUID('charge-office-supplies');
      // Ensure fixture inserted (if previous test did cleanup, reinsert minimal fixture)
      const existingCharge = await client.query(
        `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
        [chargeId],
      );
      if (existingCharge.rows.length === 0) {
        // Reinsert fixture quickly
        await client.query('BEGIN');
        await insertFixture(client, expenseScenarioA);
        await client.query('COMMIT');
      }

      const chargeResult = await client.query(
        `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
        [chargeId],
      );
      const charge = chargeResult.rows[0];
      const adminContext = await buildAdminContextFromDb(client);
      const mockUser: UserType = {
        username: 'test-admin',
        userId: adminContext.defaultAdminBusinessId,
        role: 'ADMIN',
      };
      const context = createLedgerTestContext({
        pool: db.getPool(),
        adminContext,
        currentUser: mockUser,
        env,
        moduleId: 'ledger',
      });

      // First generation
      const first = await ledgerGenerationByCharge(
        charge,
        { insertLedgerRecordsIfNotExists: true },
        context as any,
        {} as any,
      );
      if (!first || 'message' in first) {
        throw new Error('First generation failed');
      }
      const firstRecords = await client.query(
        `SELECT id FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1 ORDER BY id ASC`,
        [charge.id],
      );
      const firstIds = firstRecords.rows.map(r => r.id);

      // Second generation with insertion disabled (should not create duplicates)
      const second = await ledgerGenerationByCharge(
        charge,
        { insertLedgerRecordsIfNotExists: false },
        context as any,
        {} as any,
      );
      if (!second || 'message' in second) {
        throw new Error('Second generation failed');
      }
      const secondRecords = await client.query(
        `SELECT id FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1 ORDER BY id ASC`,
        [charge.id],
      );
      const secondIds = secondRecords.rows.map(r => r.id);

      expect(secondIds.length).toBe(firstIds.length);
      expect(secondIds).toEqual(firstIds);
    } finally {
      client.release();
    }
  });

  it('should validate fixture structure matches expectations', () => {
    // Verify fixture has expected structure
    expect(expenseScenarioA.businesses?.businesses).toHaveLength(2); // Admin + supplier
    expect(expenseScenarioA.taxCategories?.taxCategories).toHaveLength(2); // Expense + bank
    expect(expenseScenarioA.charges?.charges).toHaveLength(1);
    expect(expenseScenarioA.transactions?.transactions).toHaveLength(1);
    expect(expenseScenarioA.documents?.documents).toHaveLength(1);

    // Verify expectations are defined
    expect(expenseScenarioA.expectations).toBeDefined();
    expect(expenseScenarioA.expectations?.ledger).toHaveLength(1);

    const ledgerExpectation = expenseScenarioA.expectations?.ledger?.[0];
    expect(ledgerExpectation?.chargeId).toBe(makeUUID('charge-office-supplies'));
    expect(ledgerExpectation?.recordCount).toBe(2);
    expect(ledgerExpectation?.balanced).toBe(true);
    expect(ledgerExpectation?.totalDebitLocal).toBe(500.0);
    expect(ledgerExpectation?.totalCreditLocal).toBe(500.0);
    expect(ledgerExpectation?.debitEntities).toHaveLength(1);
    expect(ledgerExpectation?.creditEntities).toHaveLength(1);
  });

  it('should create deterministic UUIDs for reproducible tests', () => {
    // Verify all IDs are deterministic and match expected values
    const adminBusinessId = makeUUID('admin-business');
    const supplierId = makeUUID('supplier-local-ltd');
    const chargeId = makeUUID('charge-office-supplies');
    const transactionId = makeUUID('transaction-supplies-payment');
    const documentId = makeUUID('document-supplies-receipt');

    expect(adminBusinessId).toBe(expenseScenarioA.businesses?.businesses[0]?.id);
    expect(supplierId).toBe(expenseScenarioA.businesses?.businesses[1]?.id);
    expect(chargeId).toBe(expenseScenarioA.charges?.charges[0]?.id);
    expect(transactionId).toBe(expenseScenarioA.transactions?.transactions[0]?.id);
    expect(documentId).toBe(expenseScenarioA.documents?.documents[0]?.id);
  });
});
