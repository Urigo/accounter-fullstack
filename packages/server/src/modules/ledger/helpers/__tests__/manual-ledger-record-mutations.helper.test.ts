import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LedgerRecordInput } from '../../../../__generated__/types.js';
import { Currency } from '../../../../shared/enums.js';
import { LedgerLockError } from '../../../../shared/errors.js';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { ChargesProvider } from '../../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../../charges/types.js';
import { LedgerProvider } from '../../providers/ledger.provider.js';
import { makeInjector } from '../../resolvers/ledger-generation/__tests__/helpers/ledger-generation-mocks.js';
import type { IGetLedgerRecordsByIdsResult } from '../../types.js';
import { updateManualLedgerRecord } from '../manual-ledger-record-mutations.helper.js';

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

/* All IDs, amounts and dates below are made up. */

const RECORD_ID = 'ledger-record';
const CHARGE_ID = 'charge';
const RECORD_OWNER_ID = 'record-owner';
const CONTEXT_OWNER_ID = 'context-owner';

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
  { ledgerLock }: { ledgerLock?: string } = {},
) {
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
    updateLedgerRecord: vi.fn(async (_params: unknown) => [updatedRow]),
  };
  const chargesProvider = {
    getChargeByIdLoader: { load: vi.fn(async () => charge) },
  };
  const injector = makeInjector(
    new Map<unknown, unknown>([
      [LedgerProvider, ledgerProvider],
      [ChargesProvider, chargesProvider],
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            ownerId: CONTEXT_OWNER_ID,
            defaultLocalCurrency: Currency.Ils,
            ledgerLock,
          }),
        },
      ],
    ]),
  );
  return { injector, ledgerProvider, chargesProvider, charge, updatedRow };
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
