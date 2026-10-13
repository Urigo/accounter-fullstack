import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  LedgerRecordInput,
  LedgerRecordOperation,
} from '../../../../__generated__/types.js';
import { Currency, DocumentType } from '../../../../shared/enums.js';
import { LedgerLockError } from '../../../../shared/errors.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../../charges/types.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { FinancialEntitiesProvider } from '../../../financial-entities/providers/financial-entities.provider.js';
import { MiscExpensesProvider } from '../../../misc-expenses/providers/misc-expenses.provider.js';
import { LedgerProvider } from '../../providers/ledger.provider.js';
import { makeInjector } from '../../resolvers/ledger-generation/__tests__/helpers/ledger-generation-mocks.js';
import type { IGetLedgerRecordsByIdsResult } from '../../types.js';
import { isChargeLocked } from '../ledger-lock.js';
import { validateLedgerRecordParams } from '../ledger-validation.helper.js';
import {
  insertManualLedgerRecord,
  updateManualLedgerRecord,
} from '../manual-ledger-record-mutations.helper.js';

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

// Real implementation by default; one test makes it throw to cover the provider-invariant guard
vi.mock('../ledger-validation.helper.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../ledger-validation.helper.js')>();
  return { ...actual, validateLedgerRecordParams: vi.fn(actual.validateLedgerRecordParams) };
});

vi.mock('../ledger-lock.js', () => ({
  isChargeLocked: vi.fn(),
}));

/* All IDs, amounts and dates below are made up. */

const RECORD_ID = 'ledger-record';
const CHARGE_ID = 'charge';
const RECORD_OWNER_ID = 'record-owner';
const OTHER_BUSINESS_ID = 'other-business';

/**
 * A `TenantAwareDBClient` stub whose `transaction(fn)` runs `fn` and logs start / commit / rollback
 * to `events`; `isInTransaction()` lets provider stubs log whether they ran inside the callback.
 */
function makeTransactionClient(events: string[]) {
  let inTransaction = false;
  const dbClient = {
    transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => {
      events.push('transaction:start');
      inTransaction = true;
      try {
        const result = await fn({});
        events.push('transaction:commit');
        return result;
      } catch (e) {
        events.push('transaction:rollback');
        throw e;
      } finally {
        inTransaction = false;
      }
    }),
  };
  return { dbClient, isInTransaction: () => inTransaction };
}

/** Logs the degrade call (and whether it ran inside the transaction) to `events` */
function trackDegrade(events: string[], isInTransaction: () => boolean) {
  vi.mocked(degradeChargesAccountantApproval).mockImplementation(async () => {
    events.push(`degrade:${isInTransaction() ? 'in' : 'out'}`);
    return new Map();
  });
}

const INPUT: LedgerRecordInput = {
  debitEntity1: 'debit-entity-1',
  debitLocalAmount1: 100,
  creditEntity1: 'credit-entity-1',
  creditLocalAmount1: 100,
  currency: Currency.Ils,
  invoiceDate: '2025-03-12',
  valueDate: '2025-03-14',
  description: 'Edited record',
};

function buildRecord(
  overrides: Partial<IGetLedgerRecordsByIdsResult> = {},
): IGetLedgerRecordsByIdsResult {
  return {
    id: RECORD_ID,
    charge_id: CHARGE_ID,
    owner_id: RECORD_OWNER_ID,
    locked: false,
    currency: Currency.Ils,
    debit_entity1: 'old-debit-entity-1',
    debit_local_amount1: '50',
    debit_foreign_amount1: null,
    credit_entity1: 'old-credit-entity-1',
    credit_local_amount1: '40',
    credit_foreign_amount1: null,
    debit_entity2: null,
    debit_local_amount2: null,
    debit_foreign_amount2: null,
    credit_entity2: 'old-vat-entity',
    credit_local_amount2: '10',
    credit_foreign_amount2: null,
    invoice_date: '2025-03-01',
    value_date: '2025-03-01',
    description: 'Original record',
    reference1: null,
    ...overrides,
  } as IGetLedgerRecordsByIdsResult;
}

function setup(
  record: IGetLedgerRecordsByIdsResult | undefined,
  {
    ledgerLock,
    writeTargetOwnerId = RECORD_OWNER_ID,
  }: { ledgerLock?: string; writeTargetOwnerId?: string } = {},
) {
  const events: string[] = [];
  const { dbClient, isInTransaction } = makeTransactionClient(events);
  const charge = { id: CHARGE_ID, accountant_status: 'PENDING' } as IGetChargesByIdsResult;
  const updatedRow = buildRecord({
    debit_entity1: INPUT.debitEntity1,
    debit_local_amount1: '100',
    credit_entity1: INPUT.creditEntity1,
    credit_local_amount1: '100',
    credit_entity2: null,
    credit_local_amount2: null,
    invoice_date: INPUT.invoiceDate,
    value_date: INPUT.valueDate,
    description: INPUT.description ?? null,
  });
  const ledgerProvider = {
    getLedgerRecordsByIdLoader: { load: vi.fn(async () => record) },
    updateLedgerRecord: vi.fn(async (_params: unknown): Promise<unknown[]> => {
      events.push(`updateLedgerRecord:${isInTransaction() ? 'in' : 'out'}`);
      return [updatedRow];
    }),
  };
  const chargesProvider = {
    getChargeByIdLoader: { load: vi.fn(async () => charge) },
  };
  const injector = makeInjector(
    new Map<unknown, unknown>([
      [TenantAwareDBClient, dbClient],
      [LedgerProvider, ledgerProvider],
      [ChargesProvider, chargesProvider],
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            ownerId: writeTargetOwnerId,
            defaultLocalCurrency: Currency.Ils,
            ledgerLock,
          }),
        },
      ],
    ]),
  );
  return {
    injector,
    events,
    isInTransaction,
    dbClient,
    ledgerProvider,
    chargesProvider,
    charge,
    updatedRow,
  };
}

describe('updateManualLedgerRecord', () => {
  beforeEach(() => {
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('returns a CommonError when the record does not exist', async () => {
    const { injector, ledgerProvider } = setup(undefined);

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(result).toMatchObject({ __typename: 'CommonError' });
    expect(ledgerProvider.updateLedgerRecord).not.toHaveBeenCalled();
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it('returns a CommonError and never updates when the record is locked', async () => {
    const { injector, ledgerProvider } = setup(buildRecord({ locked: true }));

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(result).toEqual({
      __typename: 'CommonError',
      message: new LedgerLockError().message,
    });
    expect(ledgerProvider.updateLedgerRecord).not.toHaveBeenCalled();
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it("returns a CommonError and never updates a record outside the request's write target", async () => {
    const { injector, dbClient, ledgerProvider } = setup(buildRecord(), {
      writeTargetOwnerId: OTHER_BUSINESS_ID,
    });

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(result).toEqual({
      __typename: 'CommonError',
      message: `This ledger record belongs to business ${RECORD_OWNER_ID}, but this request can only write to business ${OTHER_BUSINESS_ID}. Narrow the business scope to the ledger record's business and try again.`,
    });
    expect(dbClient.transaction).not.toHaveBeenCalled();
    expect(ledgerProvider.updateLedgerRecord).not.toHaveBeenCalled();
  });

  it('returns a CommonError listing every validation problem, and never updates', async () => {
    const { injector, ledgerProvider } = setup(buildRecord(), { ledgerLock: '2025-02-28' });

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: {
        ...INPUT,
        // a foreign amount on a local-currency record
        debitForeignAmount1: 30,
        // unbalanced
        creditLocalAmount1: 117,
        invoiceDate: '2025-02-28',
      },
    });

    expect(result).toEqual({
      __typename: 'CommonError',
      message: [
        'Debit 1: foreign amount is not allowed for ILS records',
        'Debit and credit totals must be equal (debit 100, credit 117)',
        'Invoice date must be after the ledger lock date (2025-02-28)',
      ].join('\n'),
    });
    expect(ledgerProvider.updateLedgerRecord).not.toHaveBeenCalled();
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it('returns a CommonError when the provider-invariant validation throws, and never updates', async () => {
    const { injector, ledgerProvider } = setup(buildRecord());
    vi.mocked(validateLedgerRecordParams).mockImplementationOnce(() => {
      throw new Error('Ledger record must have an invoice date');
    });

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(result).toEqual({
      __typename: 'CommonError',
      message: 'Ledger record must have an invoice date',
    });
    expect(ledgerProvider.updateLedgerRecord).not.toHaveBeenCalled();
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it.each([
    [
      'the invoice date is on the lock date',
      { invoiceDate: '2025-02-28' },
      'Invoice date must be after the ledger lock date (2025-02-28)',
    ],
    [
      'the invoice date is before the lock date',
      { invoiceDate: '2025-01-15' },
      'Invoice date must be after the ledger lock date (2025-02-28)',
    ],
    [
      'the value date is on the lock date',
      { valueDate: '2025-02-28' },
      'Value date must be after the ledger lock date (2025-02-28)',
    ],
    [
      'the value date is before the lock date',
      { valueDate: '2025-01-15' },
      'Value date must be after the ledger lock date (2025-02-28)',
    ],
  ] as const)('returns a CommonError and never updates when %s', async (_, dates, message) => {
    const { injector, ledgerProvider } = setup(buildRecord(), { ledgerLock: '2025-02-28' });

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: { ...INPUT, ...dates },
    });

    expect(result).toEqual({ __typename: 'CommonError', message });
    expect(ledgerProvider.updateLedgerRecord).not.toHaveBeenCalled();
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it('updates when both dates are after the lock date', async () => {
    const { injector, ledgerProvider } = setup(buildRecord(), { ledgerLock: '2025-03-11' });

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(ledgerProvider.updateLedgerRecord).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('__typename', 'CommonError');
  });

  it('returns a CommonError when the update matches no row', async () => {
    const { injector, ledgerProvider } = setup(buildRecord());
    ledgerProvider.updateLedgerRecord.mockResolvedValueOnce([]);

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(result).toMatchObject({ __typename: 'CommonError' });
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it('returns a CommonError instead of throwing on an unexpected failure', async () => {
    const { injector, ledgerProvider } = setup(buildRecord());
    ledgerProvider.updateLedgerRecord.mockRejectedValueOnce(new Error('connection lost'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(result).toMatchObject({ __typename: 'CommonError' });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('overwrites the record under its own owner, clearing absent slot-2 values', async () => {
    const { injector, ledgerProvider, charge, updatedRow } = setup(buildRecord());

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(ledgerProvider.updateLedgerRecord).toHaveBeenCalledTimes(1);
    expect(ledgerProvider.updateLedgerRecord).toHaveBeenCalledWith({
      ledgerId: RECORD_ID,
      ownerId: RECORD_OWNER_ID,
      debitEntity1: 'debit-entity-1',
      debitLocalAmount1: 100,
      debitForeignAmount1: null,
      creditEntity1: 'credit-entity-1',
      creditLocalAmount1: 100,
      creditForeignAmount1: null,
      debitEntity2: null,
      debitLocalAmount2: null,
      debitForeignAmount2: null,
      creditEntity2: null,
      creditLocalAmount2: null,
      creditForeignAmount2: null,
      currency: Currency.Ils,
      invoiceDate: '2025-03-12',
      valueDate: '2025-03-14',
      description: 'Edited record',
      reference: null,
    });
    expect(degradeChargesAccountantApproval).toHaveBeenCalledWith(injector, [CHARGE_ID]);
    expect(result).toEqual({ record: updatedRow, charge });
  });

  it('updates the record and re-flags the charge in one transaction', async () => {
    const { injector, events, isInTransaction } = setup(buildRecord());
    trackDegrade(events, isInTransaction);

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(events).toEqual([
      'transaction:start',
      'updateLedgerRecord:in',
      'degrade:in',
      'transaction:commit',
    ]);
    expect(result).not.toHaveProperty('__typename', 'CommonError');
  });

  it('rolls the update back and returns a CommonError when re-flagging the charge fails', async () => {
    const { injector, events } = setup(buildRecord());
    vi.mocked(degradeChargesAccountantApproval).mockRejectedValueOnce(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(events).toEqual(['transaction:start', 'updateLedgerRecord:in', 'transaction:rollback']);
    expect(result).toEqual({
      __typename: 'CommonError',
      message: `Failed to update ledger record ID="${RECORD_ID}"`,
    });
  });

  it('responds with the degraded charge when the update un-approves it', async () => {
    const { injector, updatedRow } = setup(buildRecord());
    const degradedCharge = {
      id: CHARGE_ID,
      accountant_status: 'PENDING',
    } as IGetChargesByIdsResult;
    vi.mocked(degradeChargesAccountantApproval).mockResolvedValueOnce(
      new Map([[CHARGE_ID, degradedCharge]]),
    );

    const result = await updateManualLedgerRecord(injector, {
      ledgerRecordId: RECORD_ID,
      input: INPUT,
    });

    expect(result).toEqual({ record: updatedRow, charge: degradedCharge });
  });
});

describe('insertManualLedgerRecord', () => {
  const OWNER_ID = 'charge-owner';
  const LEDGER_LOCK = '2025-01-31';
  const INSERT_INPUT: LedgerRecordInput = {
    debitEntity1: 'expense-category',
    debitLocalAmount1: 100,
    creditEntity1: 'supplier',
    creditLocalAmount1: 117,
    debitEntity2: 'vat-category',
    debitLocalAmount2: 17,
    currency: Currency.Ils,
    invoiceDate: '2025-03-12',
    valueDate: '2025-03-14',
    description: 'Office supplies',
    reference: 'INV-1',
  };

  const INPUT_VAT = 'input-vat-category';
  const OUTPUT_VAT = 'output-vat-category';
  const ENTITY_TYPES: Record<string, string> = {
    supplier: 'business',
    'expense-category': 'tax_category',
  };

  function setupInsert({
    chargeExists = true,
    writeTargetOwnerId = OWNER_ID,
  }: { chargeExists?: boolean; writeTargetOwnerId?: string } = {}) {
    const charge = chargeExists
      ? ({ id: CHARGE_ID, owner_id: OWNER_ID } as IGetChargesByIdsResult)
      : undefined;
    const events: string[] = [];
    const { dbClient, isInTransaction } = makeTransactionClient(events);
    const expenseRow = { id: 'misc-expense', charge_id: CHARGE_ID };
    const ledgerRow = buildRecord({ charge_id: CHARGE_ID, owner_id: OWNER_ID });

    const miscExpensesProvider = {
      insertExpense: vi.fn(async (_params: unknown): Promise<unknown[]> => {
        events.push(`insertExpense:${isInTransaction() ? 'in' : 'out'}`);
        return [expenseRow];
      }),
    };
    const documentRow = { id: 'document', charge_id: CHARGE_ID };
    const documentsProvider = {
      insertDocuments: vi.fn(async (_params: unknown): Promise<unknown[]> => {
        events.push(`insertDocuments:${isInTransaction() ? 'in' : 'out'}`);
        return [documentRow];
      }),
    };
    const financialEntitiesProvider = {
      getFinancialEntityByIdLoader: {
        loadMany: vi.fn(
          async (ids: readonly string[]): Promise<unknown[]> =>
            ids.map(id => (ENTITY_TYPES[id] ? { id, type: ENTITY_TYPES[id] } : undefined)),
        ),
      },
    };
    const ledgerProvider = {
      insertLedgerRecords: vi.fn(async (_params: unknown): Promise<unknown[]> => {
        events.push(`insertLedgerRecords:${isInTransaction() ? 'in' : 'out'}`);
        return [ledgerRow];
      }),
    };
    const chargesProvider = {
      getChargeByIdLoader: { load: vi.fn(async () => charge) },
    };
    const injector = makeInjector(
      new Map<unknown, unknown>([
        [TenantAwareDBClient, dbClient],
        [MiscExpensesProvider, miscExpensesProvider],
        [DocumentsProvider, documentsProvider],
        [FinancialEntitiesProvider, financialEntitiesProvider],
        [LedgerProvider, ledgerProvider],
        [ChargesProvider, chargesProvider],
        [
          AdminContextProvider,
          {
            getVerifiedAdminContext: async () => ({
              ownerId: writeTargetOwnerId,
              defaultLocalCurrency: Currency.Ils,
              ledgerLock: LEDGER_LOCK,
              authorities: {
                inputVatTaxCategoryId: INPUT_VAT,
                outputVatTaxCategoryId: OUTPUT_VAT,
              },
            }),
          },
        ],
      ]),
    );
    return {
      injector,
      events,
      isInTransaction,
      dbClient,
      miscExpensesProvider,
      documentsProvider,
      financialEntitiesProvider,
      ledgerProvider,
      charge,
      ledgerRow,
    };
  }

  function insert(
    injector: ReturnType<typeof setupInsert>['injector'],
    input = INSERT_INPUT,
    operation: LedgerRecordOperation = 'MISC_EXPENSE',
  ) {
    return insertManualLedgerRecord(injector, { chargeId: CHARGE_ID, operation, input });
  }

  beforeEach(() => {
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
    vi.mocked(isChargeLocked).mockReset().mockResolvedValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns a CommonError when the charge does not exist', async () => {
    const { injector, dbClient } = setupInsert({ chargeExists: false });

    const result = await insert(injector);

    expect(result).toEqual({
      __typename: 'CommonError',
      message: `Charge with id ${CHARGE_ID} not found`,
    });
    expect(dbClient.transaction).not.toHaveBeenCalled();
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it("returns a CommonError and writes nothing for a charge outside the request's write target", async () => {
    const { injector, dbClient } = setupInsert({ writeTargetOwnerId: OTHER_BUSINESS_ID });

    const result = await insert(injector);

    expect(result).toEqual({
      __typename: 'CommonError',
      message: `This charge belongs to business ${OWNER_ID}, but this request can only write to business ${OTHER_BUSINESS_ID}. Narrow the business scope to the charge's business and try again.`,
    });
    expect(isChargeLocked).not.toHaveBeenCalled();
    expect(dbClient.transaction).not.toHaveBeenCalled();
  });

  it("returns a CommonError when the charge's ledger is locked", async () => {
    const { injector, dbClient, charge } = setupInsert();
    vi.mocked(isChargeLocked).mockResolvedValueOnce(true);

    const result = await insert(injector);

    expect(isChargeLocked).toHaveBeenCalledWith(charge, injector, LEDGER_LOCK);
    expect(result).toEqual({
      __typename: 'CommonError',
      message: "The charge's ledger is locked",
    });
    expect(dbClient.transaction).not.toHaveBeenCalled();
  });

  it('returns every validation problem at once and writes nothing', async () => {
    const { injector, dbClient } = setupInsert();

    const result = await insert(injector, {
      ...INSERT_INPUT,
      creditLocalAmount1: 50,
      invoiceDate: '2025-01-15',
    });

    expect(result).toEqual({
      __typename: 'CommonError',
      message: [
        'Debit and credit totals must be equal (debit 117, credit 50)',
        `Invoice date must be after the ledger lock date (${LEDGER_LOCK})`,
      ].join('\n'),
    });
    expect(dbClient.transaction).not.toHaveBeenCalled();
  });

  it('inserts the misc expense, then the typed ledger record, then re-flags the charge, in one transaction', async () => {
    const {
      injector,
      events,
      isInTransaction,
      miscExpensesProvider,
      ledgerProvider,
      charge,
      ledgerRow,
    } = setupInsert();
    trackDegrade(events, isInTransaction);

    const result = await insert(injector);

    expect(events).toEqual([
      'transaction:start',
      'insertExpense:in',
      'insertLedgerRecords:in',
      'degrade:in',
      'transaction:commit',
    ]);
    expect(miscExpensesProvider.insertExpense).toHaveBeenCalledWith({
      chargeId: CHARGE_ID,
      ownerId: OWNER_ID,
      creditorId: 'supplier',
      debtorId: 'expense-category',
      amount: 117,
      currency: Currency.Ils,
      description: 'Office supplies',
      invoiceDate: '2025-03-12',
      valueDate: new Date(2025, 2, 14),
    });
    expect(ledgerProvider.insertLedgerRecords).toHaveBeenCalledWith({
      ledgerRecords: [
        {
          chargeId: CHARGE_ID,
          ownerId: OWNER_ID,
          debitEntity1: 'expense-category',
          debitLocalAmount1: 100,
          debitForeignAmount1: null,
          creditEntity1: 'supplier',
          creditLocalAmount1: 117,
          creditForeignAmount1: null,
          debitEntity2: 'vat-category',
          debitLocalAmount2: 17,
          debitForeignAmount2: null,
          creditEntity2: null,
          creditLocalAmount2: null,
          creditForeignAmount2: null,
          currency: Currency.Ils,
          invoiceDate: '2025-03-12',
          valueDate: '2025-03-14',
          description: 'Office supplies',
          reference: 'INV-1',
        },
      ],
    });
    expect(degradeChargesAccountantApproval).toHaveBeenCalledWith(injector, [CHARGE_ID]);
    expect(result).toEqual({ record: ledgerRow, charge });
  });

  it('responds with the degraded charge when the insert un-approves it', async () => {
    const { injector, ledgerRow } = setupInsert();
    const degradedCharge = { id: CHARGE_ID, accountant_status: 'PENDING' } as IGetChargesByIdsResult;
    vi.mocked(degradeChargesAccountantApproval).mockResolvedValueOnce(
      new Map([[CHARGE_ID, degradedCharge]]),
    );

    const result = await insert(injector);

    expect(result).toEqual({ record: ledgerRow, charge: degradedCharge });
  });

  it('rolls back and returns a CommonError when the ledger insert throws', async () => {
    const { injector, events, ledgerProvider } = setupInsert();
    ledgerProvider.insertLedgerRecords.mockRejectedValueOnce(new Error('db down'));

    const result = await insert(injector);

    expect(events).toEqual(['transaction:start', 'insertExpense:in', 'transaction:rollback']);
    expect(ledgerProvider.insertLedgerRecords).toHaveBeenCalledOnce();
    expect(result).toEqual({
      __typename: 'CommonError',
      message: `Failed to insert ledger record for charge ID="${CHARGE_ID}"`,
    });
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it('rolls both inserts back and returns a CommonError when re-flagging the charge fails', async () => {
    const { injector, events } = setupInsert();
    vi.mocked(degradeChargesAccountantApproval).mockRejectedValueOnce(new Error('db down'));

    const result = await insert(injector);

    expect(events).toEqual([
      'transaction:start',
      'insertExpense:in',
      'insertLedgerRecords:in',
      'transaction:rollback',
    ]);
    expect(result).toEqual({
      __typename: 'CommonError',
      message: `Failed to insert ledger record for charge ID="${CHARGE_ID}"`,
    });
  });

  it('rolls back when the misc expense insert returns no row', async () => {
    const { injector, events, miscExpensesProvider, ledgerProvider } = setupInsert();
    miscExpensesProvider.insertExpense.mockResolvedValueOnce([]);

    const result = await insert(injector);

    expect(events).toEqual(['transaction:start', 'transaction:rollback']);
    expect(miscExpensesProvider.insertExpense).toHaveBeenCalledOnce();
    expect(ledgerProvider.insertLedgerRecords).not.toHaveBeenCalled();
    expect(result).toMatchObject({ __typename: 'CommonError' });
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it('rolls back when the ledger insert returns no row', async () => {
    const { injector, events, ledgerProvider } = setupInsert();
    ledgerProvider.insertLedgerRecords.mockResolvedValueOnce([]);

    const result = await insert(injector);

    expect(events).toEqual(['transaction:start', 'insertExpense:in', 'transaction:rollback']);
    expect(result).toMatchObject({ __typename: 'CommonError' });
    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  describe('DOCUMENT operation', () => {
    const DOCUMENT_INPUT: LedgerRecordInput = { ...INSERT_INPUT, debitEntity2: INPUT_VAT };

    it('inserts the derived document, the typed ledger record and the re-flag in one transaction', async () => {
      const {
        injector,
        events,
        isInTransaction,
        miscExpensesProvider,
        documentsProvider,
        financialEntitiesProvider,
        ledgerProvider,
        charge,
        ledgerRow,
      } = setupInsert();
      trackDegrade(events, isInTransaction);

      const result = await insert(injector, DOCUMENT_INPUT, 'DOCUMENT');

      expect(financialEntitiesProvider.getFinancialEntityByIdLoader.loadMany).toHaveBeenCalledWith(
        ['expense-category', 'supplier'],
      );
      expect(events).toEqual([
        'transaction:start',
        'insertDocuments:in',
        'insertLedgerRecords:in',
        'degrade:in',
        'transaction:commit',
      ]);
      expect(miscExpensesProvider.insertExpense).not.toHaveBeenCalled();
      expect(documentsProvider.insertDocuments).toHaveBeenCalledWith({
        documents: [
          {
            chargeId: CHARGE_ID,
            ownerId: OWNER_ID,
            documentType: DocumentType.Invoice,
            creditorId: 'supplier',
            debtorId: OWNER_ID,
            amount: 117,
            currencyCode: Currency.Ils,
            vat: 17,
            serialNumber: 'INV-1',
            date: '2025-03-12',
            description: 'Office supplies',
            image: null,
            file: null,
            vatReportDateOverride: null,
            noVatAmount: null,
            allocationNumber: null,
            exchangeRateOverride: null,
            fileHash: null,
            remarks: null,
          },
        ],
      });
      expect(ledgerProvider.insertLedgerRecords).toHaveBeenCalledWith({
        ledgerRecords: [
          expect.objectContaining({
            chargeId: CHARGE_ID,
            ownerId: OWNER_ID,
            debitEntity2: INPUT_VAT,
          }),
        ],
      });
      expect(degradeChargesAccountantApproval).toHaveBeenCalledWith(injector, [CHARGE_ID]);
      expect(result).toEqual({ record: ledgerRow, charge });
    });

    it('rejects a charge of another business before looking up any entity', async () => {
      const { injector, dbClient, financialEntitiesProvider } = setupInsert({
        writeTargetOwnerId: OTHER_BUSINESS_ID,
      });

      const result = await insert(injector, DOCUMENT_INPUT, 'DOCUMENT');

      expect(result).toMatchObject({ __typename: 'CommonError' });
      expect(financialEntitiesProvider.getFinancialEntityByIdLoader.loadMany).not.toHaveBeenCalled();
      expect(dbClient.transaction).not.toHaveBeenCalled();
    });

    it('returns a CommonError and opens no transaction when an entity is missing', async () => {
      const { injector, dbClient } = setupInsert();

      const result = await insert(
        injector,
        { ...DOCUMENT_INPUT, creditEntity1: 'unknown-entity' },
        'DOCUMENT',
      );

      expect(result).toEqual({
        __typename: 'CommonError',
        message: 'Financial entity with id unknown-entity not found',
      });
      expect(dbClient.transaction).not.toHaveBeenCalled();
      expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
    });

    it('returns a CommonError and opens no transaction when the entity lookup fails', async () => {
      const { injector, dbClient, financialEntitiesProvider } = setupInsert();
      const lookupError = new Error('lookup failed');
      financialEntitiesProvider.getFinancialEntityByIdLoader.loadMany.mockResolvedValueOnce([
        { id: 'expense-category', type: 'tax_category' },
        lookupError,
      ]);

      const result = await insert(injector, DOCUMENT_INPUT, 'DOCUMENT');

      expect(result).toEqual({
        __typename: 'CommonError',
        message: 'Financial entity with id supplier not found',
      });
      // The lookup failure itself is logged, not lost
      expect(console.error).toHaveBeenCalledWith(
        'Failed to load financial entity ID="supplier"',
        lookupError,
      );
      expect(dbClient.transaction).not.toHaveBeenCalled();
    });

    it('returns the derivation error as a CommonError and opens no transaction', async () => {
      const { injector, dbClient, documentsProvider } = setupInsert();

      // Neither main entity is a business
      const result = await insert(
        injector,
        { ...DOCUMENT_INPUT, creditEntity1: 'expense-category', debitEntity1: 'expense-category' },
        'DOCUMENT',
      );

      expect(result).toEqual({
        __typename: 'CommonError',
        message: 'A document needs exactly one business among the main debit and credit entities',
      });
      expect(dbClient.transaction).not.toHaveBeenCalled();
      expect(documentsProvider.insertDocuments).not.toHaveBeenCalled();
    });

    it('rolls back when the document insert returns no row', async () => {
      const { injector, events, documentsProvider, ledgerProvider } = setupInsert();
      documentsProvider.insertDocuments.mockResolvedValueOnce([]);

      const result = await insert(injector, DOCUMENT_INPUT, 'DOCUMENT');

      expect(events).toEqual(['transaction:start', 'transaction:rollback']);
      expect(ledgerProvider.insertLedgerRecords).not.toHaveBeenCalled();
      expect(result).toMatchObject({ __typename: 'CommonError' });
      expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
    });

    it('rolls back the document when the ledger insert throws', async () => {
      const { injector, events, ledgerProvider } = setupInsert();
      ledgerProvider.insertLedgerRecords.mockRejectedValueOnce(new Error('db down'));

      const result = await insert(injector, DOCUMENT_INPUT, 'DOCUMENT');

      expect(events).toEqual(['transaction:start', 'insertDocuments:in', 'transaction:rollback']);
      expect(result).toEqual({
        __typename: 'CommonError',
        message: `Failed to insert ledger record for charge ID="${CHARGE_ID}"`,
      });
    });
  });
});
