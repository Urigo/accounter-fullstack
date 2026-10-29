import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LedgerRecordInput } from '../../../__generated__/types.js';
import { TestDatabase } from '../../../__tests__/helpers/db-setup.js';
import {
  ensureBusinessForEntity,
  ensureFinancialEntity,
  ensureTaxCategoryForEntity,
} from '../../../__tests__/helpers/seed-helpers.js';
import { qualifyTable } from '../../../__tests__/helpers/test-db-config.js';
import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import { env } from '../../../environment.js';
import { Currency } from '../../../shared/enums.js';
import { LedgerLockError } from '../../../shared/errors.js';
import type { AuthUser } from '../../../shared/types/auth.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { createLedgerTestContext } from '../../../test-utils/ledger-injector.js';
import { AccountantApprovalProvider } from '../../accountant-approval/providers/accountant-approval.provider.js';
import { MiscExpensesProvider } from '../../misc-expenses/providers/misc-expenses.provider.js';
import { ledgerGenerationByCharge } from '../helpers/ledger-by-charge-type.helper.js';
import { ledgerRecordsGenerationFullMatchComparison } from '../helpers/ledgrer-storage.helper.js';
import {
  insertManualLedgerRecord,
  updateManualLedgerRecord,
} from '../helpers/manual-ledger-record-mutations.helper.js';
import { LedgerProvider } from '../providers/ledger.provider.js';
import type { IGetLedgerRecordsByChargesIdsResult } from '../types.js';

/**
 * DB-backed tests for manually inserted and edited ledger records: the real SQL, the
 * transaction rollback and the lock behaviour.
 *
 * The suite runs as its own owner business, with a `user_context` row copied from the seeded
 * Admin Business. That keeps the charge owner and the admin-context owner identical, and lets the
 * lock-date case set a ledger lock without touching the shared admin context that other
 * concurrently-running integration suites read.
 */

const OWNER_ID = makeUUID('business', 'manual-ledger-records-owner');
const SUPPLIER_ID = makeUUID('business', 'manual-ledger-records-supplier');
const EXPENSE_TAX_CATEGORY_ID = makeUUID('tax-category', 'manual-ledger-records-expense');
const OTHER_TAX_CATEGORY_ID = makeUUID('tax-category', 'manual-ledger-records-other');
/** The suite owner's own input VAT category: record entities must belong to the write target */
const INPUT_VAT_TAX_CATEGORY_ID = makeUUID('tax-category', 'manual-ledger-records-input-vat');
/** Another business, outside this request's write target */
const OTHER_OWNER_ID = makeUUID('business', 'manual-ledger-records-other-owner');
/** A tax category of the other business */
const FOREIGN_TAX_CATEGORY_ID = makeUUID('tax-category', 'manual-ledger-records-foreign');
const ADMIN_BUSINESS_ID = makeUUID('business', 'Admin Business');

const LOCAL_CURRENCY = Currency.Ils;

const user: AuthUser = {
  userId: makeUUID('user', 'manual-ledger-records-user'),
  email: 'manual-ledger-records@example.com',
  roleId: 'business_owner',
  permissions: [],
  emailVerified: true,
  permissionsVersion: 0,
};

const date = (value: string) => value as TimelessDateString;

describe('Manual ledger records (DB)', () => {
  let db: TestDatabase;
  let chargeId: string;

  async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await db.getPool().connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  /** A fresh request-like context (empty DataLoader caches, fresh admin context) */
  function newContext() {
    return createLedgerTestContext({
      pool: db.getPool(),
      env,
      moduleId: 'ledger',
      businessId: OWNER_ID,
      user,
    });
  }

  async function queryRows<T = Record<string, unknown>>(
    sql: string,
    params: unknown[],
  ): Promise<T[]> {
    return withClient(async client => (await client.query(sql, params)).rows as T[]);
  }

  function ledgerRowsOfCharge() {
    return queryRows<Record<string, string | number | boolean | null>>(
      `SELECT id, owner_id, locked, currency,
         debit_entity1, debit_local_amount1::float8, debit_foreign_amount1::float8,
         credit_entity1, credit_local_amount1::float8, credit_foreign_amount1::float8,
         debit_entity2, debit_local_amount2::float8, debit_foreign_amount2::float8,
         credit_entity2, credit_local_amount2::float8, credit_foreign_amount2::float8,
         invoice_date::text, value_date::text, description, reference1
       FROM ${qualifyTable('ledger_records')} WHERE charge_id = $1`,
      [chargeId],
    );
  }

  function miscExpensesOfCharge() {
    return queryRows<Record<string, string | number | null>>(
      `SELECT creditor_id, debtor_id, amount::float8, currency, invoice_date::text, description
       FROM ${qualifyTable('misc_expenses')} WHERE charge_id = $1`,
      [chargeId],
    );
  }

  function documentsOfCharge() {
    return queryRows<Record<string, string | number | null>>(
      `SELECT type::text, creditor_id, debtor_id, total_amount::float8, vat_amount::float8,
         currency_code::text, serial_number, date::text, description
       FROM ${qualifyTable('documents')} WHERE charge_id = $1`,
      [chargeId],
    );
  }

  async function setAccountantStatus(status: 'APPROVED' | 'PENDING' | 'UNAPPROVED') {
    await withClient(client =>
      client.query(`UPDATE ${qualifyTable('charges')} SET accountant_status = $2 WHERE id = $1`, [
        chargeId,
        status,
      ]),
    );
  }

  async function accountantStatus(): Promise<string | undefined> {
    const [row] = await queryRows<{ accountant_status: string }>(
      `SELECT accountant_status::text FROM ${qualifyTable('charges')} WHERE id = $1`,
      [chargeId],
    );
    return row?.accountant_status;
  }

  /** A balanced local-currency two-line record: expense debit, supplier credit */
  function miscExpenseInput(overrides: Partial<LedgerRecordInput> = {}): LedgerRecordInput {
    return {
      debitEntity1: EXPENSE_TAX_CATEGORY_ID,
      debitLocalAmount1: 500,
      creditEntity1: SUPPLIER_ID,
      creditLocalAmount1: 500,
      currency: LOCAL_CURRENCY,
      invoiceDate: date('2025-03-10'),
      valueDate: date('2025-03-12'),
      description: 'Office supplies',
      ...overrides,
    };
  }

  /** A balanced four-line expense invoice: expense + input VAT debit, supplier credit */
  function vatInvoiceInput(overrides: Partial<LedgerRecordInput> = {}): LedgerRecordInput {
    return {
      debitEntity1: EXPENSE_TAX_CATEGORY_ID,
      debitLocalAmount1: 1000,
      debitEntity2: INPUT_VAT_TAX_CATEGORY_ID,
      debitLocalAmount2: 170,
      creditEntity1: SUPPLIER_ID,
      creditLocalAmount1: 1170,
      currency: LOCAL_CURRENCY,
      invoiceDate: date('2025-03-10'),
      valueDate: date('2025-03-12'),
      description: 'Consulting services',
      reference: 'INV-1001',
      ...overrides,
    };
  }

  async function insertOrFail(
    operation: 'MISC_EXPENSE' | 'DOCUMENT',
    input: LedgerRecordInput,
  ): Promise<string> {
    const result = await insertManualLedgerRecord(newContext().injector, {
      chargeId,
      operation,
      input,
    });
    if ('message' in result) {
      throw new Error(`Insert failed: ${result.message}`);
    }
    return (result.record as { id: string }).id;
  }

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
    await db.ensureLatestSchema();
    await db.seedAdmin();
  });

  // Do NOT close db in afterAll: the shared pool is managed by the vitest global setup teardown

  beforeEach(async () => {
    await withClient(async client => {
      await client.query('BEGIN');
      try {
        // Owner businesses (each owns itself, like the seeded Admin Business)
        for (const [id, name] of [
          [OWNER_ID, 'Manual Ledger Records Owner'],
          [OTHER_OWNER_ID, 'Manual Ledger Records Other Owner'],
        ] as const) {
          await ensureFinancialEntity(client, { id, name, type: 'business' });
          await ensureBusinessForEntity(client, id, { ownerId: id });
          await client.query(
            `UPDATE ${qualifyTable('financial_entities')} SET owner_id = $1 WHERE id = $1`,
            [id],
          );
        }

        // Every entity the records reference belongs to the suite owner
        await ensureFinancialEntity(client, {
          id: SUPPLIER_ID,
          name: 'Manual Ledger Records Supplier',
          type: 'business',
          ownerId: OWNER_ID,
        });
        await ensureBusinessForEntity(client, SUPPLIER_ID, { ownerId: OWNER_ID });
        for (const [id, name, ownerId] of [
          [EXPENSE_TAX_CATEGORY_ID, 'Manual Ledger Records Expense', OWNER_ID],
          [OTHER_TAX_CATEGORY_ID, 'Manual Ledger Records Other', OWNER_ID],
          [INPUT_VAT_TAX_CATEGORY_ID, 'Manual Ledger Records Input VAT', OWNER_ID],
          [FOREIGN_TAX_CATEGORY_ID, 'Manual Ledger Records Foreign', OTHER_OWNER_ID],
        ] as const) {
          await ensureFinancialEntity(client, { id, name, type: 'tax_category', ownerId });
          await ensureTaxCategoryForEntity(client, id, { ownerId });
        }

        // The owner's admin context: a copy of the seeded Admin Business's, with the owner's own
        // input VAT category and no ledger lock
        const copied = await client.query(
          `INSERT INTO ${qualifyTable('user_context')}
           SELECT (jsonb_populate_record(
             NULL::${qualifyTable('user_context')},
             to_jsonb(uc) || jsonb_build_object(
               'owner_id', $1::uuid,
               'input_vat_tax_category_id', $3::uuid,
               'ledger_lock', NULL
             )
           )).*
           FROM ${qualifyTable('user_context')} uc
           WHERE uc.owner_id = $2`,
          [OWNER_ID, ADMIN_BUSINESS_ID, INPUT_VAT_TAX_CATEGORY_ID],
        );
        if (copied.rowCount !== 1) {
          throw new Error('Seeded admin context not found');
        }

        chargeId = randomUUID();
        await client.query(
          `INSERT INTO ${qualifyTable('charges')} (id, owner_id, type, user_description)
           VALUES ($1, $2, 'COMMON', 'Manual ledger records test charge')`,
          [chargeId, OWNER_ID],
        );
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await withClient(async client => {
      // Each owner's rows are deleted with that owner as the current business, so the cleanup
      // holds under row-level security too, not only for the superuser test role
      const asOwner = (ownerId: string) =>
        client.query("SELECT set_config('app.current_business_id', $1, false)", [ownerId]);
      try {
        // The other business's rows reference this suite's entities: delete them first
        await asOwner(OTHER_OWNER_ID);
        for (const table of ['ledger_records', 'charges']) {
          await client.query(`DELETE FROM ${qualifyTable(table)} WHERE owner_id = $1`, [
            OTHER_OWNER_ID,
          ]);
        }
        for (const table of ['tax_categories', 'financial_entities']) {
          await client.query(`DELETE FROM ${qualifyTable(table)} WHERE id = $1`, [
            FOREIGN_TAX_CATEGORY_ID,
          ]);
        }

        await asOwner(OWNER_ID);
        for (const table of [
          'ledger_records',
          'documents',
          'misc_expenses',
          'charges',
          'user_context',
        ]) {
          await client.query(`DELETE FROM ${qualifyTable(table)} WHERE owner_id = $1`, [OWNER_ID]);
        }
        const ownedEntityIds = [
          SUPPLIER_ID,
          EXPENSE_TAX_CATEGORY_ID,
          OTHER_TAX_CATEGORY_ID,
          INPUT_VAT_TAX_CATEGORY_ID,
        ];
        await client.query(`DELETE FROM ${qualifyTable('tax_categories')} WHERE id = ANY($1)`, [
          ownedEntityIds,
        ]);
        await client.query(`DELETE FROM ${qualifyTable('businesses')} WHERE id = $1`, [
          SUPPLIER_ID,
        ]);
        await client.query(
          `DELETE FROM ${qualifyTable('financial_entities')} WHERE id = ANY($1)`,
          [ownedEntityIds],
        );

        // Each owner references itself both ways; unlink before deleting
        for (const ownerId of [OTHER_OWNER_ID, OWNER_ID]) {
          await asOwner(ownerId);
          await client.query(
            `UPDATE ${qualifyTable('financial_entities')} SET owner_id = NULL WHERE id = $1`,
            [ownerId],
          );
          await client.query(`DELETE FROM ${qualifyTable('businesses')} WHERE id = $1`, [ownerId]);
          await client.query(`DELETE FROM ${qualifyTable('financial_entities')} WHERE id = $1`, [
            ownerId,
          ]);
        }
      } finally {
        await client.query("SELECT set_config('app.current_business_id', '', false)");
      }
    });
  });

  it('inserts a MISC_EXPENSE record and its misc expense exactly as typed', async () => {
    const input = miscExpenseInput({ reference: 'REF-7' });
    const result = await insertManualLedgerRecord(newContext().injector, {
      chargeId,
      operation: 'MISC_EXPENSE',
      input,
    });
    expect(result).not.toHaveProperty('message');

    const ledgerRows = await ledgerRowsOfCharge();
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0]).toMatchObject({
      owner_id: OWNER_ID,
      locked: false,
      currency: LOCAL_CURRENCY,
      debit_entity1: EXPENSE_TAX_CATEGORY_ID,
      debit_local_amount1: 500,
      debit_foreign_amount1: null,
      credit_entity1: SUPPLIER_ID,
      credit_local_amount1: 500,
      credit_foreign_amount1: null,
      debit_entity2: null,
      debit_local_amount2: null,
      credit_entity2: null,
      credit_local_amount2: null,
      invoice_date: '2025-03-10',
      value_date: '2025-03-12',
      description: 'Office supplies',
      reference1: 'REF-7',
    });

    const expenses = await miscExpensesOfCharge();
    expect(expenses).toEqual([
      {
        creditor_id: SUPPLIER_ID,
        debtor_id: EXPENSE_TAX_CATEGORY_ID,
        amount: 500,
        currency: LOCAL_CURRENCY,
        invoice_date: '2025-03-10',
        description: 'Office supplies',
      },
    ]);
    // `misc_expenses.value_date` is a timestamp; it must land on the typed day
    const [{ value_day }] = await queryRows<{ value_day: string }>(
      `SELECT value_date::date::text AS value_day FROM ${qualifyTable('misc_expenses')}
       WHERE charge_id = $1`,
      [chargeId],
    );
    expect(value_day).toBe('2025-03-12');
  });

  it('inserts a DOCUMENT record and derives an INVOICE from it', async () => {
    const result = await insertManualLedgerRecord(newContext().injector, {
      chargeId,
      operation: 'DOCUMENT',
      input: vatInvoiceInput(),
    });
    expect(result).not.toHaveProperty('message');

    expect(await documentsOfCharge()).toEqual([
      {
        type: 'INVOICE',
        creditor_id: SUPPLIER_ID,
        debtor_id: OWNER_ID,
        total_amount: 1170,
        vat_amount: 170,
        currency_code: LOCAL_CURRENCY,
        serial_number: 'INV-1001',
        date: '2025-03-10',
        description: 'Consulting services',
      },
    ]);
    expect(await miscExpensesOfCharge()).toEqual([]);

    const ledgerRows = await ledgerRowsOfCharge();
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0]).toMatchObject({
      debit_entity1: EXPENSE_TAX_CATEGORY_ID,
      debit_local_amount1: 1000,
      debit_entity2: INPUT_VAT_TAX_CATEGORY_ID,
      debit_local_amount2: 170,
      credit_entity1: SUPPLIER_ID,
      credit_local_amount1: 1170,
      reference1: 'INV-1001',
      locked: false,
    });
  });

  it('rolls the misc expense back when the ledger insert fails', async () => {
    const context = newContext();
    // Not mocked: the misc expense really is written inside the transaction first
    const insertExpense = vi.spyOn(context.injector.get(MiscExpensesProvider), 'insertExpense');
    const insertLedgerRecords = vi
      .spyOn(context.injector.get(LedgerProvider), 'insertLedgerRecords')
      .mockRejectedValue(new Error('simulated ledger insert failure'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await insertManualLedgerRecord(context.injector, {
      chargeId,
      operation: 'MISC_EXPENSE',
      input: miscExpenseInput(),
    });

    expect(result).toMatchObject({ __typename: 'CommonError' });
    expect(insertExpense).toHaveBeenCalledOnce();
    await expect(insertExpense.mock.results[0]?.value).resolves.toHaveLength(1);
    expect(insertLedgerRecords).toHaveBeenCalledOnce();
    expect(await miscExpensesOfCharge()).toEqual([]);
    expect(await ledgerRowsOfCharge()).toEqual([]);
  });

  it('updates a record: clearing slot 2 and foreign amounts stores NULLs, a new date persists', async () => {
    // Every optional column set: both slot-2 lines, and foreign amounts on all four slots
    const ledgerRecordId = await insertOrFail('MISC_EXPENSE', {
      debitEntity1: EXPENSE_TAX_CATEGORY_ID,
      debitLocalAmount1: 1000,
      debitForeignAmount1: 270,
      debitEntity2: INPUT_VAT_TAX_CATEGORY_ID,
      debitLocalAmount2: 170,
      debitForeignAmount2: 46,
      creditEntity1: SUPPLIER_ID,
      creditLocalAmount1: 1070,
      creditForeignAmount1: 289,
      creditEntity2: OTHER_TAX_CATEGORY_ID,
      creditLocalAmount2: 100,
      creditForeignAmount2: 27,
      currency: Currency.Usd,
      invoiceDate: date('2025-03-10'),
      valueDate: date('2025-03-12'),
      description: 'Four-line foreign record',
      reference: 'REF-4',
    });
    const [seeded] = await ledgerRowsOfCharge();
    expect(seeded).toMatchObject({
      currency: Currency.Usd,
      debit_foreign_amount1: 270,
      credit_foreign_amount1: 289,
      debit_entity2: INPUT_VAT_TAX_CATEGORY_ID,
      debit_local_amount2: 170,
      debit_foreign_amount2: 46,
      credit_entity2: OTHER_TAX_CATEGORY_ID,
      credit_local_amount2: 100,
      credit_foreign_amount2: 27,
    });

    // The same record as a two-line local-currency record: optional values left out
    const result = await updateManualLedgerRecord(newContext().injector, {
      ledgerRecordId,
      input: miscExpenseInput({
        debitLocalAmount1: 1170,
        creditLocalAmount1: 1170,
        invoiceDate: date('2025-03-15'),
      }),
    });
    expect(result).not.toHaveProperty('message');

    const ledgerRows = await ledgerRowsOfCharge();
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0]).toMatchObject({
      id: ledgerRecordId,
      currency: LOCAL_CURRENCY,
      debit_local_amount1: 1170,
      debit_foreign_amount1: null,
      credit_local_amount1: 1170,
      credit_foreign_amount1: null,
      debit_entity2: null,
      debit_local_amount2: null,
      debit_foreign_amount2: null,
      credit_entity2: null,
      credit_local_amount2: null,
      credit_foreign_amount2: null,
      invoice_date: '2025-03-15',
      value_date: '2025-03-12',
      reference1: null,
    });
  });

  it('rejects updating a locked record and leaves it unchanged', async () => {
    const ledgerRecordId = await insertOrFail('MISC_EXPENSE', miscExpenseInput());
    await withClient(client =>
      client.query(`UPDATE ${qualifyTable('ledger_records')} SET locked = true WHERE id = $1`, [
        ledgerRecordId,
      ]),
    );
    const [before] = await ledgerRowsOfCharge();

    const result = await updateManualLedgerRecord(newContext().injector, {
      ledgerRecordId,
      input: miscExpenseInput({
        debitLocalAmount1: 800,
        creditLocalAmount1: 800,
        invoiceDate: date('2025-03-20'),
      }),
    });

    expect(result).toEqual({ __typename: 'CommonError', message: new LedgerLockError().message });
    expect(await ledgerRowsOfCharge()).toEqual([before]);
  });

  it('rejects an insert dated on the ledger lock date and persists nothing', async () => {
    await withClient(client =>
      client.query(
        `UPDATE ${qualifyTable('user_context')} SET ledger_lock = '2025-03-10' WHERE owner_id = $1`,
        [OWNER_ID],
      ),
    );

    const result = await insertManualLedgerRecord(newContext().injector, {
      chargeId,
      operation: 'MISC_EXPENSE',
      input: miscExpenseInput({ invoiceDate: date('2025-03-10') }),
    });

    expect(result).toMatchObject({ __typename: 'CommonError' });
    expect((result as { message: string }).message).toContain('ledger lock date');
    expect(await miscExpensesOfCharge()).toEqual([]);
    expect(await ledgerRowsOfCharge()).toEqual([]);
  });

  describe('accountant approval', () => {
    it('re-flags an approved charge as PENDING on insert', async () => {
      await setAccountantStatus('APPROVED');

      const result = await insertManualLedgerRecord(newContext().injector, {
        chargeId,
        operation: 'MISC_EXPENSE',
        input: miscExpenseInput(),
      });

      expect(result).toMatchObject({ charge: { id: chargeId, accountant_status: 'PENDING' } });
      expect(await accountantStatus()).toBe('PENDING');
    });

    it('re-flags an approved charge as PENDING on update', async () => {
      const ledgerRecordId = await insertOrFail('MISC_EXPENSE', miscExpenseInput());
      await setAccountantStatus('APPROVED');

      const result = await updateManualLedgerRecord(newContext().injector, {
        ledgerRecordId,
        input: miscExpenseInput({ invoiceDate: date('2025-03-11') }),
      });

      expect(result).toMatchObject({ charge: { id: chargeId, accountant_status: 'PENDING' } });
      expect(await accountantStatus()).toBe('PENDING');
    });

    it('rolls every insert write back when re-flagging fails', async () => {
      await setAccountantStatus('APPROVED');
      const context = newContext();
      const degrade = vi
        .spyOn(context.injector.get(AccountantApprovalProvider), 'degradeChargeAccountantApproval')
        .mockRejectedValue(new Error('simulated degrade failure'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await insertManualLedgerRecord(context.injector, {
        chargeId,
        operation: 'MISC_EXPENSE',
        input: miscExpenseInput(),
      });

      expect(result).toMatchObject({ __typename: 'CommonError' });
      expect(degrade).toHaveBeenCalledOnce();
      expect(await miscExpensesOfCharge()).toEqual([]);
      expect(await ledgerRowsOfCharge()).toEqual([]);
      expect(await accountantStatus()).toBe('APPROVED');
    });

    it('rolls the update back when re-flagging fails', async () => {
      const ledgerRecordId = await insertOrFail('MISC_EXPENSE', miscExpenseInput());
      await setAccountantStatus('APPROVED');
      const [before] = await ledgerRowsOfCharge();
      const context = newContext();
      const degrade = vi
        .spyOn(context.injector.get(AccountantApprovalProvider), 'degradeChargeAccountantApproval')
        .mockRejectedValue(new Error('simulated degrade failure'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await updateManualLedgerRecord(context.injector, {
        ledgerRecordId,
        input: miscExpenseInput({ invoiceDate: date('2025-03-11') }),
      });

      expect(result).toMatchObject({ __typename: 'CommonError' });
      expect(degrade).toHaveBeenCalledOnce();
      expect(await ledgerRowsOfCharge()).toEqual([before]);
      expect(await accountantStatus()).toBe('APPROVED');
    });
  });

  describe('another business', () => {
    let otherChargeId: string;

    beforeEach(async () => {
      otherChargeId = randomUUID();
      await withClient(client =>
        client.query(
          `INSERT INTO ${qualifyTable('charges')} (id, owner_id, type) VALUES ($1, $2, 'COMMON')`,
          [otherChargeId, OTHER_OWNER_ID],
        ),
      );
    });

    function rowsOfOtherOwner(table: 'ledger_records' | 'misc_expenses') {
      return queryRows(`SELECT id FROM ${qualifyTable(table)} WHERE owner_id = $1`, [
        OTHER_OWNER_ID,
      ]);
    }

    it("rejects inserting under a charge outside the request's write target", async () => {
      const result = await insertManualLedgerRecord(newContext().injector, {
        chargeId: otherChargeId,
        operation: 'MISC_EXPENSE',
        input: miscExpenseInput(),
      });

      expect(result).toMatchObject({ __typename: 'CommonError' });
      expect((result as { message: string }).message).toContain(OTHER_OWNER_ID);
      expect(await rowsOfOtherOwner('misc_expenses')).toEqual([]);
      expect(await rowsOfOtherOwner('ledger_records')).toEqual([]);
    });

    it("rejects updating a record outside the request's write target", async () => {
      const [inserted] = await queryRows<{ id: string }>(
        `INSERT INTO ${qualifyTable('ledger_records')} (charge_id, owner_id, currency,
           debit_entity1, debit_local_amount1, credit_entity1, credit_local_amount1,
           invoice_date, value_date)
         VALUES ($1, $2, 'ILS', $3, 500, $4, 500, '2025-03-10', '2025-03-12')
         RETURNING id`,
        [otherChargeId, OTHER_OWNER_ID, EXPENSE_TAX_CATEGORY_ID, SUPPLIER_ID],
      );
      const ledgerRecordId = inserted!.id;

      const result = await updateManualLedgerRecord(newContext().injector, {
        ledgerRecordId,
        input: miscExpenseInput({ invoiceDate: date('2025-03-11') }),
      });

      // The by-id record loader is scoped to the write-target owner, so the record reads as missing
      expect(result).toEqual({
        __typename: 'CommonError',
        message: `Ledger record with id ${ledgerRecordId} not found`,
      });
      const [row] = await queryRows<{ invoice_date: string }>(
        `SELECT invoice_date::text FROM ${qualifyTable('ledger_records')} WHERE id = $1`,
        [ledgerRecordId],
      );
      expect(row?.invoice_date).toBe('2025-03-10');
    });

    it.each([
      ['MISC_EXPENSE', 'debitEntity1'],
      ['DOCUMENT', 'debitEntity1'],
      ['MISC_EXPENSE', 'creditEntity2'],
    ] as const)(
      "rejects a %s insert whose %s belongs to another business, writing nothing",
      async (operation, slot) => {
        const input =
          slot === 'debitEntity1'
            ? vatInvoiceInput({ debitEntity1: FOREIGN_TAX_CATEGORY_ID })
            : miscExpenseInput({
                debitLocalAmount1: 600,
                creditEntity2: FOREIGN_TAX_CATEGORY_ID,
                creditLocalAmount2: 100,
              });

        const result = await insertManualLedgerRecord(newContext().injector, {
          chargeId,
          operation,
          input,
        });

        expect(result).toMatchObject({ __typename: 'CommonError' });
        expect((result as { message: string }).message).toContain(
          `Financial entity with id ${FOREIGN_TAX_CATEGORY_ID} not found in this business`,
        );
        expect(await ledgerRowsOfCharge()).toEqual([]);
        expect(await miscExpensesOfCharge()).toEqual([]);
        expect(await documentsOfCharge()).toEqual([]);
      },
    );

    it('rejects an update that references an entity of another business', async () => {
      const ledgerRecordId = await insertOrFail('MISC_EXPENSE', miscExpenseInput());
      const [before] = await ledgerRowsOfCharge();

      const result = await updateManualLedgerRecord(newContext().injector, {
        ledgerRecordId,
        input: miscExpenseInput({ debitEntity1: FOREIGN_TAX_CATEGORY_ID }),
      });

      expect(result).toMatchObject({ __typename: 'CommonError' });
      expect((result as { message: string }).message).toContain(
        `Financial entity with id ${FOREIGN_TAX_CATEGORY_ID} not found in this business`,
      );
      expect(await ledgerRowsOfCharge()).toEqual([before]);
    });
  });

  describe('without a charge', () => {
    /** The suite owner's charges other than the fixture charge: those the mutation created */
    function newChargesOfOwner() {
      return queryRows<{ id: string; user_description: string | null; accountant_status: string }>(
        `SELECT id, user_description, accountant_status::text
         FROM ${qualifyTable('charges')} WHERE owner_id = $1 AND id <> $2`,
        [OWNER_ID, chargeId],
      );
    }

    function rowsOfCharge(table: 'ledger_records' | 'misc_expenses' | 'documents', id: string) {
      return queryRows<Record<string, string | number | null>>(
        `SELECT * FROM ${qualifyTable(table)} WHERE charge_id = $1`,
        [id],
      );
    }

    /** The suite owner's misc expenses, documents and ledger records outside the fixture charge */
    async function entityRowsOutsideFixtureCharge() {
      const counts: Record<string, number> = {};
      for (const table of ['misc_expenses', 'documents', 'ledger_records']) {
        const [row] = await queryRows<{ count: number }>(
          `SELECT count(*)::int AS count FROM ${qualifyTable(table)}
           WHERE owner_id = $1 AND charge_id <> $2`,
          [OWNER_ID, chargeId],
        );
        counts[table] = row?.count ?? 0;
      }
      return counts;
    }

    const NOTHING_WRITTEN = { misc_expenses: 0, documents: 0, ledger_records: 0 };

    it('creates an unapproved charge described by the record, with its misc expense and record', async () => {
      const result = await insertManualLedgerRecord(newContext().injector, {
        operation: 'MISC_EXPENSE',
        input: miscExpenseInput(),
      });
      expect(result).not.toHaveProperty('message');

      const newCharges = await newChargesOfOwner();
      expect(newCharges).toEqual([
        {
          id: expect.any(String),
          user_description: 'Office supplies',
          accountant_status: 'UNAPPROVED',
        },
      ]);
      const newChargeId = newCharges[0]!.id;
      expect((result as { charge: { id: string } }).charge.id).toBe(newChargeId);

      const expenses = await rowsOfCharge('misc_expenses', newChargeId);
      expect(expenses).toHaveLength(1);
      expect(expenses[0]).toMatchObject({
        owner_id: OWNER_ID,
        creditor_id: SUPPLIER_ID,
        debtor_id: EXPENSE_TAX_CATEGORY_ID,
      });
      const ledgerRows = await rowsOfCharge('ledger_records', newChargeId);
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows[0]).toMatchObject({
        id: (result as { record: { id: string } }).record.id,
        owner_id: OWNER_ID,
        debit_entity1: EXPENSE_TAX_CATEGORY_ID,
        credit_entity1: SUPPLIER_ID,
        description: 'Office supplies',
      });

      // Nothing was attached to the fixture charge
      expect(await miscExpensesOfCharge()).toEqual([]);
      expect(await ledgerRowsOfCharge()).toEqual([]);
    });

    it('creates a charge with the derived INVOICE and the record, described by the reference when there is no description', async () => {
      const result = await insertManualLedgerRecord(newContext().injector, {
        operation: 'DOCUMENT',
        input: vatInvoiceInput({ description: null }),
      });
      expect(result).not.toHaveProperty('message');

      const newCharges = await newChargesOfOwner();
      expect(newCharges).toEqual([
        { id: expect.any(String), user_description: 'INV-1001', accountant_status: 'UNAPPROVED' },
      ]);
      const newChargeId = newCharges[0]!.id;

      const documents = await rowsOfCharge('documents', newChargeId);
      expect(documents).toHaveLength(1);
      expect(documents[0]).toMatchObject({
        type: 'INVOICE',
        owner_id: OWNER_ID,
        creditor_id: SUPPLIER_ID,
        debtor_id: OWNER_ID,
        serial_number: 'INV-1001',
      });
      expect(Number(documents[0]!.total_amount)).toBe(1170);
      expect(Number(documents[0]!.vat_amount)).toBe(170);
      expect(await rowsOfCharge('misc_expenses', newChargeId)).toEqual([]);
      const ledgerRows = await rowsOfCharge('ledger_records', newChargeId);
      expect(ledgerRows).toHaveLength(1);
      expect(ledgerRows[0]).toMatchObject({
        owner_id: OWNER_ID,
        debit_entity2: INPUT_VAT_TAX_CATEGORY_ID,
        reference1: 'INV-1001',
      });
    });

    it('rolls the new charge and its misc expense back when the ledger insert fails', async () => {
      const context = newContext();
      // Not mocked: the charge and the misc expense really are written inside the transaction first
      const insertExpense = vi.spyOn(context.injector.get(MiscExpensesProvider), 'insertExpense');
      const insertLedgerRecords = vi
        .spyOn(context.injector.get(LedgerProvider), 'insertLedgerRecords')
        .mockRejectedValue(new Error('simulated ledger insert failure'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await insertManualLedgerRecord(context.injector, {
        operation: 'MISC_EXPENSE',
        input: miscExpenseInput(),
      });

      expect(result).toEqual({
        __typename: 'CommonError',
        message: 'Failed to insert ledger record with a new charge',
      });
      await expect(insertExpense.mock.results[0]?.value).resolves.toHaveLength(1);
      expect(insertLedgerRecords).toHaveBeenCalledOnce();
      expect(await newChargesOfOwner()).toEqual([]);
      expect(await entityRowsOutsideFixtureCharge()).toEqual(NOTHING_WRITTEN);
    });

    it('rolls the new charge and its document back when the ledger insert fails', async () => {
      const context = newContext();
      vi.spyOn(context.injector.get(LedgerProvider), 'insertLedgerRecords').mockRejectedValue(
        new Error('simulated ledger insert failure'),
      );
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await insertManualLedgerRecord(context.injector, {
        operation: 'DOCUMENT',
        input: vatInvoiceInput(),
      });

      expect(result).toMatchObject({ __typename: 'CommonError' });
      expect(await newChargesOfOwner()).toEqual([]);
      expect(await entityRowsOutsideFixtureCharge()).toEqual(NOTHING_WRITTEN);
    });

    it('rejects a record dated on the ledger lock date and creates no charge', async () => {
      await withClient(client =>
        client.query(
          `UPDATE ${qualifyTable('user_context')} SET ledger_lock = '2025-03-10' WHERE owner_id = $1`,
          [OWNER_ID],
        ),
      );

      const result = await insertManualLedgerRecord(newContext().injector, {
        operation: 'MISC_EXPENSE',
        input: miscExpenseInput({ invoiceDate: date('2025-03-10') }),
      });

      expect(result).toMatchObject({ __typename: 'CommonError' });
      expect((result as { message: string }).message).toContain('ledger lock date');
      expect(await newChargesOfOwner()).toEqual([]);
      expect(await entityRowsOutsideFixtureCharge()).toEqual(NOTHING_WRITTEN);
    });

    it('rejects an entity of another business and creates no charge', async () => {
      const result = await insertManualLedgerRecord(newContext().injector, {
        operation: 'MISC_EXPENSE',
        input: miscExpenseInput({ debitEntity1: FOREIGN_TAX_CATEGORY_ID }),
      });

      expect(result).toMatchObject({ __typename: 'CommonError' });
      expect((result as { message: string }).message).toContain(
        `Financial entity with id ${FOREIGN_TAX_CATEGORY_ID} not found in this business`,
      );
      expect(await newChargesOfOwner()).toEqual([]);
      expect(await entityRowsOutsideFixtureCharge()).toEqual(NOTHING_WRITTEN);
      const [otherOwnerCharges] = await queryRows<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${qualifyTable('charges')} WHERE owner_id = $1`,
        [OTHER_OWNER_ID],
      );
      expect(otherOwnerCharges?.count).toBe(0);
    });
  });

  describe('matching the generated ledger', () => {
    async function compareWithGenerated() {
      const context = newContext();
      const charges = await withClient(
        async client =>
          (await client.query(`SELECT * FROM ${qualifyTable('charges')} WHERE id = $1`, [chargeId]))
            .rows,
      );
      const generated = await ledgerGenerationByCharge(
        charges[0],
        { insertLedgerRecordsIfNotExists: false },
        context as unknown as GraphQLModules.ModuleContext,
        {} as never,
      );
      if (!generated || 'message' in generated) {
        throw new Error(`Ledger generation failed: ${generated?.message ?? 'null result'}`);
      }
      const stored = await context.injector
        .get(LedgerProvider)
        .getLedgerRecordsByChargesIdLoader.load(chargeId);
      return ledgerRecordsGenerationFullMatchComparison(
        stored,
        generated.records as IGetLedgerRecordsByChargesIdsResult[],
      );
    }

    it('fully matches when typed like the generator, and stops matching once edited', async () => {
      // What the generator produces for a local misc expense: one line, debtor debit, creditor credit
      const input = miscExpenseInput();
      const ledgerRecordId = await insertOrFail('MISC_EXPENSE', input);

      expect((await compareWithGenerated()).isFullyMatched).toBe(true);

      const updated = await updateManualLedgerRecord(newContext().injector, {
        ledgerRecordId,
        input: { ...input, invoiceDate: date('2025-03-11') },
      });
      expect(updated).not.toHaveProperty('message');

      expect((await compareWithGenerated()).isFullyMatched).toBe(false);
    });
  });
});
