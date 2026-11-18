import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { Currency } from '../../../../../shared/enums.js';
import type { LedgerProto } from '../../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import { storeInitialGeneratedRecords } from '../../../helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '../../../helpers/misc-expenses-ledger.helper.js';
import { ledgerProtoToRecordsConverter } from '../../../helpers/utils.helper.js';
import { calculateVacationReserveAmount } from '../../../helpers/vacation-reserve.helper.js';
import { generateLedgerRecordsForVacationReserveExpenses } from '../financial-ledger-generation/vacation-reserve-ledger-generation.resolver.js';

vi.mock('../../../helpers/vacation-reserve.helper.js', () => ({
  calculateVacationReserveAmount: vi.fn(),
}));

vi.mock('../../../helpers/ledgrer-storage.helper.js', () => ({
  storeInitialGeneratedRecords: vi.fn(),
}));

vi.mock('../../../helpers/misc-expenses-ledger.helper.js', () => ({
  generateMiscExpensesLedger: vi.fn(),
}));

vi.mock('../../../helpers/utils.helper.js', () => ({
  ledgerProtoToRecordsConverter: vi.fn(),
}));

const RESERVE = 'vacation-reserve-tax-category-id';
const EXPENSE = 'vacation-expenses-tax-category-id';

function makeInjector(): Injector {
  return {
    get: <T>(token: unknown): T => {
      if (token === AdminContextProvider) {
        return {
          getVerifiedAdminContext: vi.fn().mockResolvedValue({
            defaultLocalCurrency: Currency.Ils,
            salaries: {
              vacationReserveTaxCategoryId: RESERVE,
              vacationReserveExpensesTaxCategoryId: EXPENSE,
            },
          }),
        } as T;
      }
      throw new Error(`Unexpected provider token: ${String(token)}`);
    },
  } as unknown as Injector;
}

async function generate(vacationReserveAmount: number) {
  vi.mocked(calculateVacationReserveAmount).mockResolvedValue({ vacationReserveAmount });
  const result = await generateLedgerRecordsForVacationReserveExpenses(
    { id: 'charge-1', owner_id: 'owner-1', user_description: 'Vacation reserve 2025' } as never,
    { insertLedgerRecordsIfNotExists: false },
    { injector: makeInjector() } as never,
    {} as never,
  );
  if (!result || 'message' in result) {
    throw new Error(`Expected GeneratedLedgerRecords result, got ${JSON.stringify(result)}`);
  }
  return result.records as unknown as LedgerProto[];
}

describe('generateLedgerRecordsForVacationReserveExpenses', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(generateMiscExpensesLedger).mockResolvedValue([]);
    vi.mocked(ledgerProtoToRecordsConverter).mockImplementation(records => records as never);
    vi.mocked(storeInitialGeneratedRecords).mockResolvedValue(undefined);
  });

  it('books an increase as Dr expense / Cr reserve', async () => {
    const records = await generate(1000);

    expect(calculateVacationReserveAmount).toHaveBeenCalledWith(expect.anything(), 2025);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      creditAccountID1: RESERVE,
      debitAccountID1: EXPENSE,
      localCurrencyCreditAmount1: 1000,
      localCurrencyDebitAmount1: 1000,
      valueDate: '2025-12-31',
    });
  });

  it('books a decrease as Dr reserve / Cr expense', async () => {
    const records = await generate(-1000);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      creditAccountID1: EXPENSE,
      debitAccountID1: RESERVE,
      localCurrencyCreditAmount1: 1000,
      localCurrencyDebitAmount1: 1000,
    });
  });

  it('books no reserve entry when the reserve did not change', async () => {
    const records = await generate(0);

    expect(records).toHaveLength(0);
  });
});
