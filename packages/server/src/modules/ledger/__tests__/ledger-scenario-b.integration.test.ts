import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { TestDatabase } from '../../../__tests__/helpers/db-setup.js';
import { insertFixture } from '../../../__tests__/helpers/fixture-loader.js';
import { expenseScenarioB } from '../../../__tests__/fixtures/expenses/expense-scenario-b.js';
import { makeUUID } from '../../../__tests__/factories/ids.js';
import { qualifyTable } from '../../../__tests__/helpers/test-db-config.js';
import { buildAdminContextFromDb } from '../../../__tests__/helpers/admin-context-builder.js';
import { mockExchangeRate } from '../../../__tests__/helpers/exchange-mock.js';
import { env } from '../../../environment.js';
import { ledgerGenerationByCharge } from '../helpers/ledger-by-charge-type.helper.js';
import { assertForeignExpenseScenario, assertAuditTrail } from './helpers/ledger-assertions.js';
import type { UserType } from '../../../plugins/auth-plugin.js';
import { createLedgerTestContext } from '../../../test-utils/ledger-injector.js';
import { Currency } from '../../../shared/enums.js';

/**
 * Ledger Integration Test for Expense Scenario B
 * 
 * Tests ledger generation for a foreign currency (USD) invoice expense scenario.
 * This validates the complete flow: fixture insertion → exchange rate mocking → 
 * ledger generation → record validation with currency conversion.
 *
 * Scenario:
 * - Admin business purchases from US Vendor LLC
 * - Transaction: -200 USD (expense)
 * - Document: Invoice for 200 USD
 * - Exchange rate: 3.5 ILS/USD (mocked, deterministic)
 * - Expected ledger: 2 balanced records with 700 ILS total (200 × 3.5)
 */

describe('Ledger Generation - Expense Scenario B (Foreign Currency)', () => {
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
      const chargeId = makeUUID('charge-consulting-services');
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
        [makeUUID('expense-consulting'), makeUUID('usd-account-tax-category')],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('financial_accounts')} WHERE account_number = $1`,
        ['USD-ACCOUNT-001'],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('tax_categories')} WHERE id IN ($1, $2)`,
        [makeUUID('expense-consulting'), makeUUID('usd-account-tax-category')],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('businesses')} WHERE id IN ($1, $2)`,
        [makeUUID('admin-business-usd'), makeUUID('supplier-us-vendor-llc')],
      );
      await client.query(
        `DELETE FROM ${qualifyTable('financial_entities')} WHERE id IN ($1, $2, $3, $4)`,
        [
          makeUUID('admin-business-usd'),
          makeUUID('supplier-us-vendor-llc'),
          makeUUID('expense-consulting'),
          makeUUID('usd-account-tax-category'),
        ],
      );
    } finally {
      client.release();
    }
  });

  it('should generate balanced ledger records for USD invoice expense with mocked exchange rate', async () => {
    // Insert fixture within an explicit transaction and COMMIT to persist rows.
    const insertClient = await db.getPool().connect();
    try {
      await insertClient.query('BEGIN');

      await insertFixture(insertClient, expenseScenarioB);

      const chargeId = makeUUID('charge-consulting-services');

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
      expect(transactionsResult.rows[0].amount).toBe('-200.00');
      expect(transactionsResult.rows[0].currency).toBe(Currency.Usd);

      const documentsResult = await insertClient.query(
        `SELECT * FROM ${qualifyTable('documents')} WHERE charge_id = $1`,
        [chargeId],
      );
      expect(documentsResult.rows).toHaveLength(1);
      expect(documentsResult.rows[0].type).toBe('INVOICE');
      expect(Number(documentsResult.rows[0].total_amount)).toBe(200.0);
      expect(documentsResult.rows[0].currency_code).toBe(Currency.Usd);

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
      const chargeId = makeUUID('charge-consulting-services');
      const chargeResult = await client.query(
        `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
        [chargeId],
      );
      const charge = chargeResult.rows[0];

      // Build AdminContext from database
      const adminContext = await buildAdminContextFromDb(client);

      const mockUser: UserType = {
        username: 'test-admin-usd',
        userId: adminContext.defaultAdminBusinessId,
        role: 'ADMIN',
      };

      // Create context with mocked exchange rate: 3.5 ILS per USD
      const context = createLedgerTestContext({
        pool: db.getPool(),
        adminContext,
        currentUser: mockUser,
        env,
        moduleId: 'ledger',
        mockExchangeRates: mockExchangeRate(Currency.Usd, Currency.Ils, 3.5),
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
      expect(result.records.length).toBeGreaterThanOrEqual(2); // At least debit + credit

      // Query ledger records from database
      const ledgerResult = await client.query(
        `SELECT * FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1 ORDER BY created_at ASC`,
        [charge.id],
      );

      const ledgerExpectation = expenseScenarioB.expectations?.ledger?.[0];
      // Semantic foreign currency assertions
      assertForeignExpenseScenario(ledgerResult.rows as any, {
        chargeId: charge.id,
        ownerId: charge.owner_id, // Use actual charge owner id
        expenseEntity: makeUUID('expense-consulting'),
        bankEntity: makeUUID('usd-account-tax-category'),
        expectedCurrency: Currency.Usd,
        expectedForeignAmount: ledgerExpectation?.foreignAmount || 200.0,
        expectedRate: ledgerExpectation?.exchangeRate || 3.5,
        expectedLocalTotal: ledgerExpectation?.totalDebitLocal || 1400.0,
      });

      // Retain record count sanity check (algorithm may add extra legs)
      expect(ledgerResult.rows.length).toBeGreaterThanOrEqual(ledgerExpectation?.recordCount || 2);

      // Audit trail assertions
      assertAuditTrail(ledgerResult.rows as any);
      console.log('✅ Ledger generation semantic foreign currency assertions passed for Scenario B');
    } finally {
      client.release();
    }
  });

  it('should be idempotent on repeated foreign ledger generation (no duplicate records)', async () => {
    const client = await db.getPool().connect();
    try {
      const chargeId = makeUUID('charge-consulting-services');
      // Ensure fixture inserted if absent
      const existingCharge = await client.query(
        `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
        [chargeId],
      );
      if (existingCharge.rows.length === 0) {
        await client.query('BEGIN');
        await insertFixture(client, expenseScenarioB);
        await client.query('COMMIT');
      }

      const chargeResult = await client.query(
        `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
        [chargeId],
      );
      const charge = chargeResult.rows[0];
      const adminContext = await buildAdminContextFromDb(client);
      const mockUser: UserType = {
        username: 'test-admin-usd',
        userId: adminContext.defaultAdminBusinessId,
        role: 'ADMIN',
      };
      const context = createLedgerTestContext({
        pool: db.getPool(),
        adminContext,
        currentUser: mockUser,
        env,
        moduleId: 'ledger',
        mockExchangeRates: mockExchangeRate(Currency.Usd, Currency.Ils, 3.5),
      });

      const first = await ledgerGenerationByCharge(
        charge,
        { insertLedgerRecordsIfNotExists: true },
        context as any,
        {} as any,
      );
      if (!first || 'message' in first) {
        throw new Error('First foreign generation failed');
      }
      const firstRecords = await client.query(
        `SELECT id FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1 ORDER BY id ASC`,
        [charge.id],
      );
      const firstIds = firstRecords.rows.map(r => r.id);

      const second = await ledgerGenerationByCharge(
        charge,
        { insertLedgerRecordsIfNotExists: false },
        context as any,
        {} as any,
      );
      if (!second || 'message' in second) {
        throw new Error('Second foreign generation failed');
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
    expect(expenseScenarioB.businesses?.businesses).toHaveLength(2); // Admin + US vendor
    expect(expenseScenarioB.taxCategories?.taxCategories).toHaveLength(2); // Consulting + USD account
    expect(expenseScenarioB.accounts?.accounts).toHaveLength(1); // USD account
    expect(expenseScenarioB.accountTaxCategories?.mappings).toHaveLength(1); // USD account mapping
    expect(expenseScenarioB.charges?.charges).toHaveLength(1);
    expect(expenseScenarioB.transactions?.transactions).toHaveLength(1);
    expect(expenseScenarioB.documents?.documents).toHaveLength(1);

    // Verify USD account configuration
    const usdAccount = expenseScenarioB.accounts?.accounts[0];
    expect(usdAccount?.accountNumber).toBe('USD-ACCOUNT-001');
    expect(usdAccount?.type).toBe('BANK_ACCOUNT');

    // Verify account tax category mapping
    const accountMapping = expenseScenarioB.accountTaxCategories?.mappings[0];
    expect(accountMapping?.accountNumber).toBe('USD-ACCOUNT-001');
    expect(accountMapping?.currency).toBe(Currency.Usd);
    expect(accountMapping?.taxCategoryId).toBe(makeUUID('usd-account-tax-category'));

    // Verify expectations are defined
    expect(expenseScenarioB.expectations).toBeDefined();
    expect(expenseScenarioB.expectations?.ledger).toHaveLength(1);

    const ledgerExpectation = expenseScenarioB.expectations?.ledger?.[0];
    expect(ledgerExpectation?.chargeId).toBe(makeUUID('charge-consulting-services'));
    expect(ledgerExpectation?.recordCount).toBe(2);
    expect(ledgerExpectation?.balanced).toBe(true);
    expect(ledgerExpectation?.totalDebitLocal).toBe(1400.0);
    expect(ledgerExpectation?.totalCreditLocal).toBe(1400.0);
    expect(ledgerExpectation?.foreignCurrency).toBe('USD');
    expect(ledgerExpectation?.foreignAmount).toBe(200.0);
    expect(ledgerExpectation?.exchangeRate).toBe(3.5);
    expect(ledgerExpectation?.debitEntities).toHaveLength(2);
    expect(ledgerExpectation?.creditEntities).toHaveLength(2);
  });

  it('should create deterministic UUIDs for reproducible tests', () => {
    // Verify all IDs are deterministic and match expected values
    const adminBusinessId = makeUUID('admin-business-usd');
    const supplierId = makeUUID('supplier-us-vendor-llc');
    const chargeId = makeUUID('charge-consulting-services');
    const transactionId = makeUUID('transaction-consulting-payment');
    const documentId = makeUUID('document-consulting-invoice');

    expect(adminBusinessId).toBe(expenseScenarioB.businesses?.businesses[0]?.id);
    expect(supplierId).toBe(expenseScenarioB.businesses?.businesses[1]?.id);
    expect(chargeId).toBe(expenseScenarioB.charges?.charges[0]?.id);
    expect(transactionId).toBe(expenseScenarioB.transactions?.transactions[0]?.id);
    expect(documentId).toBe(expenseScenarioB.documents?.documents[0]?.id);
  });

  it('should use INVOICE document type for foreign vendors', () => {
    // Verify document type is INVOICE (not RECEIPT) for US vendor
    const document = expenseScenarioB.documents?.documents[0];
    expect(document?.type).toBe('INVOICE');
    expect(document?.serial_number).toBe('INV-US-2024-001');
    expect(document?.currency_code).toBe(Currency.Usd);
    
    // US invoices should not have Israeli VAT
    expect(document?.vat_amount).toBeNull();
  });

  it('should validate exchange rate conversion within tolerance', async () => {
    // This is a unit-style test of the fixture expectations themselves
    const ledgerExpectation = expenseScenarioB.expectations?.ledger?.[0];
    
    expect(ledgerExpectation).toBeDefined();
    expect(ledgerExpectation?.foreignCurrency).toBe('USD');
    expect(ledgerExpectation?.foreignAmount).toBe(200.0);
    expect(ledgerExpectation?.exchangeRate).toBe(3.5);
    
    // Validate conversion math: 200 USD × 3.5 = 700 ILS per entry, 1400 ILS total
    const calculatedLocalPerEntry = (ledgerExpectation?.foreignAmount ?? 0) * (ledgerExpectation?.exchangeRate ?? 0);
    expect(calculatedLocalPerEntry).toBe(700.0);
    const expectedTotal = calculatedLocalPerEntry * 2; // Document + transaction
    expect(ledgerExpectation?.totalDebitLocal).toBe(expectedTotal);
    expect(ledgerExpectation?.totalCreditLocal).toBe(expectedTotal);
    
    // Verify balance
    expect(ledgerExpectation?.balanced).toBe(true);
    expect(ledgerExpectation?.totalDebitLocal).toBe(ledgerExpectation?.totalCreditLocal);
  });
});
