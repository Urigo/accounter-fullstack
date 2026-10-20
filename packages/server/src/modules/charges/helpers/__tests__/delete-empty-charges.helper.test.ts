import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_UUID } from '../../../../shared/constants.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { MiscExpensesProvider } from '../../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { ChargesProvider } from '../../providers/charges.provider.js';
import { deleteCharges } from '../delete-charges.helper.js';
import { deleteChargesIfEmpty, isChargeEmpty } from '../delete-empty-charges.helper.js';

vi.mock('../delete-charges.helper.js', () => ({
  deleteCharges: vi.fn(),
}));

const CHARGE_A = 'cc000000-0000-4000-8000-00000000000a';
const CHARGE_B = 'cc000000-0000-4000-8000-00000000000b';

type ChargeContent = { transactions?: number; documents?: number; miscExpenses?: number };

function buildInjector(
  contents: Record<string, ChargeContent>,
  { missingCharges = [] }: { missingCharges?: string[] } = {},
) {
  const rows = (count = 0) => Array.from({ length: count }, (_, i) => ({ id: String(i) }));
  const loader = (key: keyof ChargeContent) => ({
    load: vi.fn(async (chargeId: string) => rows(contents[chargeId]?.[key])),
    clear: vi.fn(),
  });

  const transactionsLoader = loader('transactions');
  const documentsLoader = loader('documents');
  const miscExpensesLoader = loader('miscExpenses');
  const invalidateCharge = vi.fn();

  const injector = {
    get: (token: unknown) => {
      if (token === TransactionsProvider) {
        return { transactionsByChargeIDLoader: transactionsLoader };
      }
      if (token === DocumentsProvider) {
        return { getDocumentsByChargeIdLoader: documentsLoader };
      }
      if (token === MiscExpensesProvider) {
        return { getExpensesByChargeIdLoader: miscExpensesLoader };
      }
      if (token === ChargesProvider) {
        return {
          getChargeByIdLoader: {
            load: vi.fn(async (id: string) => (missingCharges.includes(id) ? undefined : { id })),
          },
          invalidateCharge,
        };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;

  return { injector, transactionsLoader, documentsLoader, miscExpensesLoader, invalidateCharge };
}

describe('isChargeEmpty', () => {
  it('is empty only when there are no transactions, documents or misc expenses', async () => {
    const { injector } = buildInjector({
      [CHARGE_A]: {},
      [CHARGE_B]: { miscExpenses: 1 },
    });

    await expect(isChargeEmpty(CHARGE_A, injector)).resolves.toBe(true);
    await expect(isChargeEmpty(CHARGE_B, injector)).resolves.toBe(false);
  });

  it('clears the per-charge loaders before counting', async () => {
    const { injector, transactionsLoader, documentsLoader, miscExpensesLoader } = buildInjector({});

    await isChargeEmpty(CHARGE_A, injector);

    for (const loader of [transactionsLoader, documentsLoader, miscExpensesLoader]) {
      expect(loader.clear).toHaveBeenCalledWith(CHARGE_A);
      expect(loader.clear.mock.invocationCallOrder[0]).toBeLessThan(
        loader.load.mock.invocationCallOrder[0],
      );
    }
  });
});

describe('deleteChargesIfEmpty', () => {
  beforeEach(() => {
    vi.mocked(deleteCharges).mockReset().mockResolvedValue(undefined);
  });

  it.each<[string, ChargeContent]>([
    ['a transaction', { transactions: 1 }],
    ['a document', { documents: 1 }],
    ['a misc expense', { miscExpenses: 1 }],
  ])('keeps a charge that still holds %s', async (_, content) => {
    const { injector } = buildInjector({ [CHARGE_A]: content });

    await expect(deleteChargesIfEmpty([CHARGE_A], injector)).resolves.toEqual([]);
    expect(deleteCharges).not.toHaveBeenCalled();
  });

  it('deletes empty charges once each and reports them', async () => {
    const { injector, invalidateCharge } = buildInjector({
      [CHARGE_A]: {},
      [CHARGE_B]: { transactions: 2 },
    });

    const deleted = await deleteChargesIfEmpty([CHARGE_A, CHARGE_A, CHARGE_B], injector);

    expect(deleted).toEqual([CHARGE_A]);
    expect(deleteCharges).toHaveBeenCalledTimes(1);
    expect(deleteCharges).toHaveBeenCalledWith([CHARGE_A], injector);
    expect(invalidateCharge).toHaveBeenCalledWith(CHARGE_A);
  });

  it('ignores kept, empty, EMPTY_UUID and missing ids', async () => {
    const { injector } = buildInjector({}, { missingCharges: [CHARGE_B] });

    const deleted = await deleteChargesIfEmpty(
      [CHARGE_A, CHARGE_B, EMPTY_UUID, null, undefined, ''],
      injector,
      { keepChargeIds: [CHARGE_A] },
    );

    expect(deleted).toEqual([]);
    expect(deleteCharges).not.toHaveBeenCalled();
  });

  it('does not throw when deletion fails, and leaves the charge out of the result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(deleteCharges).mockImplementation(async ([chargeId]) => {
      if (chargeId === CHARGE_A) {
        throw new Error('FK violation');
      }
    });
    const { injector } = buildInjector({ [CHARGE_A]: {}, [CHARGE_B]: {} });

    const deleted = await deleteChargesIfEmpty([CHARGE_A, CHARGE_B], injector);

    expect(deleted).toEqual([CHARGE_B]);
  });
});
