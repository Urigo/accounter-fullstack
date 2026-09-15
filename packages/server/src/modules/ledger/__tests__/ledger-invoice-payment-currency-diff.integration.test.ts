import type { PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CURRENCY_DIFF_EUR_RATE,
  CURRENCY_DIFF_FOREIGN_INVOICE_IDS,
  CURRENCY_DIFF_LOCAL_INVOICE_IDS,
  CURRENCY_DIFF_LOCAL_PAYMENT_IDS,
  CURRENCY_DIFF_USD_RATE,
  currencyDiffForeignInvoiceScenario,
  currencyDiffLocalInvoiceScenario,
  currencyDiffLocalPaymentScenario,
} from '../../../__tests__/fixtures/expenses/invoice-payment-currency-diff.js';
import { buildAdminContextFromDb } from '../../../__tests__/helpers/admin-context-builder.js';
import { TestDatabase } from '../../../__tests__/helpers/db-setup.js';
import { createMockExchangeRates } from '../../../__tests__/helpers/exchange-mock.js';
import { insertFixture } from '../../../__tests__/helpers/fixture-loader.js';
import type { Fixture } from '../../../__tests__/helpers/fixture-types.js';
import { qualifyTable } from '../../../__tests__/helpers/test-db-config.js';
import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import { env } from '../../../environment.js';
import { Currency } from '../../../shared/enums.js';
import { createLedgerTestContext } from '../../../test-utils/ledger-injector.js';
import { ledgerGenerationByCharge } from '../helpers/ledger-by-charge-type.helper.js';

/**
 * Ledger generation for charges flagged `invoice_payment_currency_diff`.
 *
 * Such a charge is one where the invoice was issued in one currency and settled in another, so
 * the two legs are not expected to cancel out. Ledger generation closes each foreign currency
 * position the counterparty business holds with a "Foreign currency balance" record, and the
 * local-currency difference that is left over is absorbed by an exchange-rate record. Either
 * way the counterparty must end up balanced in local currency once generation is done.
 *
 * The scenarios below are the same shape — vendor invoice, later payment from another account —
 * and differ only in which leg is foreign, which is what decides how many foreign positions the
 * vendor holds and therefore which branch of `multipleForeignCurrenciesBalanceEntries` runs.
 */
describe('Ledger Generation - invoice/payment currency difference', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
    await db.ensureLatestSchema();
    await db.seedAdmin();
  });

  afterAll(async () => {
    // Do NOT close db here — the shared pool is managed by vitest-global-setup teardown.
    // Closing it here destroys the pool for all other concurrently-running integration suites.
  });

  const exchangeRates = createMockExchangeRates([
    { fromCurrency: Currency.Usd, toCurrency: Currency.Ils, rate: CURRENCY_DIFF_USD_RATE },
    { fromCurrency: Currency.Eur, toCurrency: Currency.Ils, rate: CURRENCY_DIFF_EUR_RATE },
  ]);

  type ScenarioIds =
    | typeof CURRENCY_DIFF_FOREIGN_INVOICE_IDS
    | typeof CURRENCY_DIFF_LOCAL_INVOICE_IDS
    | typeof CURRENCY_DIFF_LOCAL_PAYMENT_IDS;
  type LedgerRow = Record<string, unknown>;

  async function insertScenario(fixture: Fixture, ids: ScenarioIds): Promise<void> {
    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      const adminContext = await buildAdminContextFromDb(client);
      // Pin the write target to the fixture owner rather than whatever the session carries.
      await client.query("SELECT set_config('app.current_business_id', $1, false)", [ids.adminId]);
      await insertFixture(client, fixture, adminContext.ownerId);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  /** Removes every row this scenario inserted, so suites do not leak into each other. */
  async function cleanupScenario(ids: ScenarioIds): Promise<void> {
    const client = await db.getPool().connect();
    const errors: string[] = [];
    const run = async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (e) {
        errors.push(`${label}: ${e}`);
      }
    };
    try {
      await client.query("SELECT set_config('app.current_business_id', $1, false)", [ids.adminId]);

      await run('ledger_records', () =>
        client.query(`DELETE FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1`, [
          ids.chargeId,
        ]),
      );
      await run('documents', () =>
        client.query(`DELETE FROM ${qualifyTable('documents')} WHERE charge_id = $1`, [
          ids.chargeId,
        ]),
      );
      // Transactions first, so the transactions_raw_list orphan can then be cleaned up.
      await run('transactions', () =>
        client.query(`DELETE FROM ${qualifyTable('transactions')} WHERE charge_id = $1`, [
          ids.chargeId,
        ]),
      );
      await run('transactions_raw_list', () =>
        client.query(`DELETE FROM ${qualifyTable('transactions_raw_list')} WHERE etherscan_id = $1`, [
          makeUUID('raw-transaction', `etherscan-${ids.transactionId}`),
        ]),
      );
      await run('charges', () =>
        client.query(`DELETE FROM ${qualifyTable('charges')} WHERE id = $1`, [ids.chargeId]),
      );
      await run('financial_accounts_tax_categories', () =>
        client.query(
          `DELETE FROM ${qualifyTable('financial_accounts_tax_categories')}
           WHERE tax_category_id = $1`,
          [ids.accountTaxCategoryId],
        ),
      );
      await run('financial_accounts', () =>
        client.query(`DELETE FROM ${qualifyTable('financial_accounts')} WHERE account_number = $1`, [
          ids.accountNumber,
        ]),
      );
      await run('tax_categories', () =>
        client.query(`DELETE FROM ${qualifyTable('tax_categories')} WHERE id IN ($1, $2)`, [
          ids.expenseTaxCategoryId,
          ids.accountTaxCategoryId,
        ]),
      );
      await run('businesses', () =>
        client.query(`DELETE FROM ${qualifyTable('businesses')} WHERE id IN ($1, $2)`, [
          ids.adminId,
          ids.vendorId,
        ]),
      );
      await run('financial_entities', () =>
        client.query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id IN ($1, $2, $3, $4)`, [
          ids.adminId,
          ids.vendorId,
          ids.expenseTaxCategoryId,
          ids.accountTaxCategoryId,
        ]),
      );
    } finally {
      client.release();
    }
    if (errors.length > 0) {
      throw new Error(`cleanup failures:\n${errors.join('\n')}`);
    }
  }

  async function generateLedger(ids: ScenarioIds, client: PoolClient) {
    const adminContext = await buildAdminContextFromDb(client);
    await client.query("SELECT set_config('app.current_business_id', $1, false)", [ids.adminId]);

    const chargeResult = await client.query(
      `SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`,
      [ids.chargeId],
    );
    const charge = chargeResult.rows[0];
    expect(charge).toBeDefined();
    // The flag under test: without it the balancing branch below never runs.
    expect(charge.invoice_payment_currency_diff).toBe(true);

    const context = createLedgerTestContext({
      pool: db.getPool(),
      env,
      moduleId: 'ledger',
      businessId: adminContext.ownerId,
      mockExchangeRates: exchangeRates,
    });

    const result = await ledgerGenerationByCharge(
      charge,
      { insertLedgerRecordsIfNotExists: false },
      context as never,
      {} as never,
    );

    if (!result || 'message' in result) {
      throw new Error(
        `Ledger generation failed: ${
          result ? (result as { message: string }).message : 'null result'
        }`,
      );
    }
    return { ...result, records: result.records as unknown as LedgerRow[] };
  }

  /** Sums the local-currency (ILS) legs of every generated record touching the given entity. */
  function localBalanceOf(records: LedgerRow[], entityId: string): { debit: number; credit: number } {
    let debit = 0;
    let credit = 0;
    for (const record of records) {
      if (record.debit_entity1 === entityId) debit += Number(record.debit_local_amount1 ?? 0);
      if (record.debit_entity2 === entityId) debit += Number(record.debit_local_amount2 ?? 0);
      if (record.credit_entity1 === entityId) credit += Number(record.credit_local_amount1 ?? 0);
      if (record.credit_entity2 === entityId) credit += Number(record.credit_local_amount2 ?? 0);
    }
    return { debit, credit };
  }

  const byDescription = (records: LedgerRow[], description: string) =>
    records.filter(record => record.description === description);

  describe('EUR invoice settled by a USD payment (two foreign positions)', () => {
    beforeAll(async () => {
      await insertScenario(currencyDiffForeignInvoiceScenario, CURRENCY_DIFF_FOREIGN_INVOICE_IDS);
    });

    afterAll(async () => {
      await cleanupScenario(CURRENCY_DIFF_FOREIGN_INVOICE_IDS);
    });

    it('leaves the vendor balanced in local currency', async () => {
      const client = await db.getPool().connect();
      try {
        const { records, errors, balance } = await generateLedger(
          CURRENCY_DIFF_FOREIGN_INVOICE_IDS,
          client,
        );

        // The two legs of the charge are worth different local amounts:
        //   invoice 49.00 EUR × 3.5 = 171.50 ILS credited to the vendor
        //   payment 58.85 USD × 3.0 = 176.55 ILS debited from the vendor
        // Closing the EUR and USD positions moves those same amounts back the other way, so
        // the 5.05 ILS difference is all that is left for the ledger to absorb — and the
        // vendor must come out balanced in ILS.
        const vendorBalance = localBalanceOf(records, CURRENCY_DIFF_FOREIGN_INVOICE_IDS.vendorId);
        expect(vendorBalance.debit).toBeCloseTo(vendorBalance.credit, 2);

        expect(errors).toEqual([]);
        expect(balance?.isBalanced).toBe(true);
        expect(balance?.balanceSum).toBeCloseTo(0, 2);
      } finally {
        client.release();
      }
    });

    it('closes each foreign position and books the local difference against the vendor', async () => {
      const client = await db.getPool().connect();
      try {
        const { records } = await generateLedger(CURRENCY_DIFF_FOREIGN_INVOICE_IDS, client);
        const { vendorId } = CURRENCY_DIFF_FOREIGN_INVOICE_IDS;
        const balancingRecords = byDescription(records, 'Foreign currency balance');

        // One record per currency: EUR and USD close the vendor's foreign positions, and the
        // third settles what is left of them in local currency.
        expect(balancingRecords).toHaveLength(3);

        const eurRecord = balancingRecords.find(record => record.currency === Currency.Eur);
        expect(eurRecord?.debit_entity1).toBe(vendorId);
        expect(Number(eurRecord?.debit_foreign_amount1)).toBeCloseTo(49.0, 2);
        expect(Number(eurRecord?.debit_local_amount1)).toBeCloseTo(171.5, 2);

        const usdRecord = balancingRecords.find(record => record.currency === Currency.Usd);
        expect(usdRecord?.credit_entity1).toBe(vendorId);
        expect(Number(usdRecord?.credit_foreign_amount1)).toBeCloseTo(58.85, 2);
        expect(Number(usdRecord?.credit_local_amount1)).toBeCloseTo(176.55, 2);

        // The EUR record debits 171.50 and the USD record credits 176.55, so the record that
        // settles the remainder has to DEBIT the vendor by the 5.05 ILS difference. Crediting
        // it instead doubles the gap (5.05 → 10.10) rather than closing it.
        const localRecord = balancingRecords.find(record => record.currency === Currency.Ils);
        expect(localRecord?.debit_entity1).toBe(vendorId);
        expect(localRecord?.credit_entity1).toBeNull();
        expect(Number(localRecord?.debit_local_amount1)).toBeCloseTo(5.05, 2);
      } finally {
        client.release();
      }
    });
  });

  describe('ILS invoice settled by a USD payment (single foreign position)', () => {
    beforeAll(async () => {
      await insertScenario(currencyDiffLocalInvoiceScenario, CURRENCY_DIFF_LOCAL_INVOICE_IDS);
    });

    afterAll(async () => {
      await cleanupScenario(CURRENCY_DIFF_LOCAL_INVOICE_IDS);
    });

    it('leaves the vendor balanced in local currency', async () => {
      const client = await db.getPool().connect();
      try {
        const { records, errors, balance } = await generateLedger(CURRENCY_DIFF_LOCAL_INVOICE_IDS, client);

        // invoice 25.54 ILS credited to the vendor, payment 8.92 USD × 3.0 = 26.76 ILS debited,
        // leaving a 1.22 ILS difference for the exchange-rate record to absorb.
        const vendorBalance = localBalanceOf(records, CURRENCY_DIFF_LOCAL_INVOICE_IDS.vendorId);
        expect(vendorBalance.debit).toBeCloseTo(vendorBalance.credit, 2);

        expect(errors).toEqual([]);
        expect(balance?.isBalanced).toBe(true);
        expect(balance?.balanceSum).toBeCloseTo(0, 2);
      } finally {
        client.release();
      }
    });

    it('closes the USD position and books the local difference as an exchange-rate record', async () => {
      const client = await db.getPool().connect();
      try {
        const { records } = await generateLedger(CURRENCY_DIFF_LOCAL_INVOICE_IDS, client);
        const { vendorId, expenseTaxCategoryId } = CURRENCY_DIFF_LOCAL_INVOICE_IDS;

        // A single balancing record: it credits the vendor's 8.92 USD position and debits the
        // same value back in local currency.
        const balancingRecords = byDescription(records, 'Foreign currency balance');
        expect(balancingRecords).toHaveLength(1);
        const [balancingRecord] = balancingRecords;
        expect(balancingRecord.currency).toBe(Currency.Usd);
        expect(balancingRecord.debit_entity1).toBe(vendorId);
        expect(balancingRecord.credit_entity1).toBe(vendorId);
        expect(balancingRecord.debit_foreign_amount1).toBeNull();
        expect(Number(balancingRecord.credit_foreign_amount1)).toBeCloseTo(8.92, 2);
        expect(Number(balancingRecord.debit_local_amount1)).toBeCloseTo(26.76, 2);

        // The 1.22 ILS left over is booked against the charge's tax category.
        const exchangeRecords = byDescription(records, 'Exchange ledger record');
        expect(exchangeRecords).toHaveLength(1);
        const [exchangeRecord] = exchangeRecords;
        expect(exchangeRecord.currency).toBe(Currency.Ils);
        expect(exchangeRecord.credit_entity1).toBe(vendorId);
        expect(exchangeRecord.debit_entity1).toBe(expenseTaxCategoryId);
        expect(Number(exchangeRecord.credit_local_amount1)).toBeCloseTo(1.22, 2);
      } finally {
        client.release();
      }
    });
  });
  describe('EUR invoice settled by an ILS payment (single foreign position)', () => {
    beforeAll(async () => {
      await insertScenario(currencyDiffLocalPaymentScenario, CURRENCY_DIFF_LOCAL_PAYMENT_IDS);
    });

    afterAll(async () => {
      await cleanupScenario(CURRENCY_DIFF_LOCAL_PAYMENT_IDS);
    });

    it('leaves the vendor balanced in local currency', async () => {
      const client = await db.getPool().connect();
      try {
        const { records, errors, balance } = await generateLedger(
          CURRENCY_DIFF_LOCAL_PAYMENT_IDS,
          client,
        );

        // invoice 49.00 EUR × 3.5 = 171.50 ILS credited to the vendor, payment 180.00 ILS
        // debited, leaving an 8.50 ILS difference for the exchange-rate record to absorb.
        const vendorBalance = localBalanceOf(records, CURRENCY_DIFF_LOCAL_PAYMENT_IDS.vendorId);
        expect(vendorBalance.debit).toBeCloseTo(vendorBalance.credit, 2);

        expect(errors).toEqual([]);
        expect(balance?.isBalanced).toBe(true);
        expect(balance?.balanceSum).toBeCloseTo(0, 2);
      } finally {
        client.release();
      }
    });

    it('closes the EUR position and books the local difference as an exchange-rate record', async () => {
      const client = await db.getPool().connect();
      try {
        const { records } = await generateLedger(CURRENCY_DIFF_LOCAL_PAYMENT_IDS, client);
        const { vendorId, expenseTaxCategoryId } = CURRENCY_DIFF_LOCAL_PAYMENT_IDS;

        // A single balancing record, mirroring the local-invoice scenario: it debits the
        // vendor's 49.00 EUR position and credits the same value back in local currency.
        const balancingRecords = byDescription(records, 'Foreign currency balance');
        expect(balancingRecords).toHaveLength(1);
        const [balancingRecord] = balancingRecords;
        expect(balancingRecord.currency).toBe(Currency.Eur);
        expect(balancingRecord.debit_entity1).toBe(vendorId);
        expect(balancingRecord.credit_entity1).toBe(vendorId);
        expect(balancingRecord.credit_foreign_amount1).toBeNull();
        expect(Number(balancingRecord.debit_foreign_amount1)).toBeCloseTo(49.0, 2);
        expect(Number(balancingRecord.credit_local_amount1)).toBeCloseTo(171.5, 2);

        // The 8.50 ILS left over is booked against the charge's tax category. The vendor is
        // debit-heavy here (it was paid 180.00 for a 171.50 invoice), so it is credited.
        const exchangeRecords = byDescription(records, 'Exchange ledger record');
        expect(exchangeRecords).toHaveLength(1);
        const [exchangeRecord] = exchangeRecords;
        expect(exchangeRecord.currency).toBe(Currency.Ils);
        expect(exchangeRecord.credit_entity1).toBe(vendorId);
        expect(exchangeRecord.debit_entity1).toBe(expenseTaxCategoryId);
        expect(Number(exchangeRecord.credit_local_amount1)).toBeCloseTo(8.5, 2);
      } finally {
        client.release();
      }
    });
  });
});
