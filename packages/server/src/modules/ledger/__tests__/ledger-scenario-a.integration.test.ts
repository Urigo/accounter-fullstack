import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { PoolClient } from 'pg';
import { TestDatabase } from '../../../__tests__/helpers/db-setup.js';
import { insertFixture } from '../../../__tests__/helpers/fixture-loader.js';
import { expenseScenarioA } from '../../../__tests__/fixtures/expenses/expense-scenario-a.js';
import { makeUUID } from '../../../__tests__/factories/ids.js';
import { qualifyTable } from '../../../__tests__/helpers/test-db-config.js';
import { env } from '../../../environment.js';
import { ledgerGenerationByCharge } from '../helpers/ledger-by-charge-type.helper.js';
import type { AdminContext } from '../../../plugins/admin-context-plugin.js';
import type { UserType } from '../../../plugins/auth-plugin.js';
import { createLedgerTestContext } from '../../../test-utils/ledger-injector.js';

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
      expect(transactionsResult.rows[0].currency).toBe('ILS');

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

      const contextResult = await client.query(
        `SELECT uc.* FROM ${qualifyTable('user_context')} uc
         JOIN ${qualifyTable('financial_entities')} fe ON fe.id = uc.owner_id
         WHERE fe.name = $1 AND fe.type = $2
         LIMIT 1`,
        ['Admin Business', 'business']
      );
      expect(contextResult.rows.length).toBeGreaterThan(0);
      const dbContext = contextResult.rows[0];
      const adminBusinessId = dbContext.owner_id as string;

      const adminContext: AdminContext = {
        defaultLocalCurrency: dbContext.default_local_currency,
        defaultCryptoConversionFiatCurrency: dbContext.default_fiat_currency_for_crypto_conversions,
        defaultAdminBusinessId: adminBusinessId,
        defaultTaxCategoryId: dbContext.default_tax_category_id,
        locality: dbContext.locality || 'Israel',
        ledgerLock: dbContext.ledger_lock ? dbContext.ledger_lock.toISOString().split('T')[0] : undefined,
        authorities: {
          vatBusinessId: dbContext.vat_business_id,
          inputVatTaxCategoryId: dbContext.input_vat_tax_category_id,
          outputVatTaxCategoryId: dbContext.output_vat_tax_category_id,
          taxBusinessId: dbContext.tax_business_id,
          taxExpensesTaxCategoryId: dbContext.tax_expenses_tax_category_id,
          socialSecurityBusinessId: dbContext.social_security_business_id,
          vatReportExcludedBusinessNames: [],
        },
        general: {
          taxCategories: {
            exchangeRateTaxCategoryId: dbContext.exchange_rate_tax_category_id,
            incomeExchangeRateTaxCategoryId: dbContext.income_exchange_rate_tax_category_id,
            exchangeRevaluationTaxCategoryId: dbContext.exchange_rate_revaluation_tax_category_id,
            feeTaxCategoryId: dbContext.fee_tax_category_id,
            generalFeeTaxCategoryId: dbContext.general_fee_tax_category_id,
            fineTaxCategoryId: dbContext.fine_tax_category_id,
            untaxableGiftsTaxCategoryId: dbContext.untaxable_gifts_tax_category_id,
            balanceCancellationTaxCategoryId: dbContext.balance_cancellation_tax_category_id,
            developmentForeignTaxCategoryId: dbContext.development_foreign_tax_category_id,
            developmentLocalTaxCategoryId: dbContext.development_local_tax_category_id,
            salaryExcessExpensesTaxCategoryId: dbContext.salary_excess_expenses_tax_category_id,
          },
        },
        crossYear: {
          expensesToPayTaxCategoryId: dbContext.expenses_to_pay_tax_category_id,
            expensesInAdvanceTaxCategoryId: dbContext.expenses_in_advance_tax_category_id,
            incomeToCollectTaxCategoryId: dbContext.income_to_collect_tax_category_id,
            incomeInAdvanceTaxCategoryId: dbContext.income_in_advance_tax_category_id,
        },
        financialAccounts: {
          poalimBusinessId: null,
          discountBusinessId: null,
          swiftBusinessId: null,
          isracardBusinessId: null,
          amexBusinessId: null,
          calBusinessId: null,
          etanaBusinessId: null,
          krakenBusinessId: null,
          etherScanBusinessId: null,
          foreignSecuritiesBusinessId: null,
          bankAccountIds: [],
          creditCardIds: [],
          internalWalletsIds: [],
        },
        bankDeposits: { bankDepositBusinessId: null, bankDepositInterestIncomeTaxCategoryId: null },
        foreignSecurities: { foreignSecuritiesBusinessId: null, foreignSecuritiesFeesCategoryId: null },
        salaries: {
          zkufotExpensesTaxCategoryId: null,
          zkufotIncomeTaxCategoryId: null,
          socialSecurityExpensesTaxCategoryId: null,
          salaryExpensesTaxCategoryId: null,
          trainingFundExpensesTaxCategoryId: null,
          compensationFundExpensesTaxCategoryId: null,
          pensionExpensesTaxCategoryId: null,
          batchedEmployeesBusinessId: null,
          batchedFundsBusinessId: null,
          salaryBatchedBusinessIds: [],
          taxDeductionsBusinessId: null,
          recoveryReserveExpensesTaxCategoryId: null,
          recoveryReserveTaxCategoryId: null,
          vacationReserveExpensesTaxCategoryId: null,
          vacationReserveTaxCategoryId: null,
        },
        businessTrips: { businessTripTaxCategoryId: null, businessTripTagId: null },
        dividends: {
          dividendWithholdingTaxBusinessId: null,
          dividendTaxCategoryId: null,
          dividendPaymentBusinessIds: [],
          dividendBusinessIds: [],
        },
        depreciation: {
          accumulatedDepreciationTaxCategoryId: null,
          rndDepreciationExpensesTaxCategoryId: null,
          gnmDepreciationExpensesTaxCategoryId: null,
          marketingDepreciationExpensesTaxCategoryId: null,
        },
      };

      const mockUser: UserType = {
        username: 'test-admin',
        userId: adminBusinessId,
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

      // Assert ledger expectations
      const ledgerExpectation = expenseScenarioA.expectations?.ledger?.[0];
      expect(ledgerResult.rows.length).toBe(ledgerExpectation?.recordCount || 2);

      // Verify balanced
      const totalDebit = ledgerResult.rows.reduce(
        (sum, r) =>
          sum + Number(r.debit_local_amount1 || 0) + Number(r.debit_local_amount2 || 0),
        0,
      );
      const totalCredit = ledgerResult.rows.reduce(
        (sum, r) =>
          sum + Number(r.credit_local_amount1 || 0) + Number(r.credit_local_amount2 || 0),
        0,
      );
      expect(totalDebit).toBe(totalCredit); // Balanced
      expect(totalDebit).toBeGreaterThan(0);

      console.log('✅ Ledger generation successful');
      console.log(`   Records generated: ${ledgerResult.rows.length}`);
      console.log(`   Total debit: ${totalDebit} ILS`);
      console.log(`   Total credit: ${totalCredit} ILS`);
      console.log(`   Balanced: ${totalDebit === totalCredit ? '✅' : '❌'}`);
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
