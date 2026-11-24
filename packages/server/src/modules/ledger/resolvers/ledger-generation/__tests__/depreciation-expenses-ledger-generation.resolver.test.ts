import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { Currency } from '../../../../../shared/enums.js';
import type { LedgerProto } from '../../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import { DepreciationDisposalsProvider } from '../../../../depreciation/providers/depreciation-disposals.provider.js';
import type { IGetDepreciationDisposalsByIdsResult } from '../../../../depreciation/types.js';
import { calculateDepreciationAmount } from '../../../../reports/helpers/depreciation-report.helper.js';
import { generateDepreciationDisposalsLedger } from '../../../helpers/depreciation-disposal-ledger.helper.js';
import { generateLedgerRecordsForDepreciationExpenses } from '../financial-ledger-generation/depreciation-expenses-ledger-generation.resolver.js';
import {
  expectGeneratedRecords,
  makeInjector as makeMockInjector,
  summarize,
} from './helpers/ledger-generation-mocks.js';

/*
 * The yearly depreciation charge: it books the year's depreciation expense, and the disposals of
 * the year that have no charge of their own (write-offs). Disposals carried by a sale or refund
 * charge are booked there, not here.
 *
 * All IDs, amounts and dates below are made up. The yearly amounts and the disposal entries are
 * stubbed: how they are computed is tested with their helpers.
 */

vi.mock('../../../../reports/helpers/depreciation-report.helper.js', () => ({
  calculateDepreciationAmount: vi.fn(),
}));

vi.mock('../../../helpers/depreciation-disposal-ledger.helper.js', () => ({
  generateDepreciationDisposalsLedger: vi.fn(),
}));

vi.mock('../../../helpers/misc-expenses-ledger.helper.js', () => ({
  generateMiscExpensesLedger: vi.fn(async () => []),
}));

vi.mock('../../../helpers/ledgrer-storage.helper.js', () => ({
  storeInitialGeneratedRecords: vi.fn(),
}));

const CHARGE_ID = 'charge-depreciation-2024';
const OWNER_ID = 'owner-business';
const OTHER_OWNER_ID = 'other-business';
const ACCUMULATED_DEPRECIATION_ID = 'tax-category-accumulated-depreciation';
const GNM_EXPENSES_ID = 'tax-category-gnm-depreciation';
const ASSET_ACCOUNT_ID = 'tax-category-computers';

const charge = {
  id: CHARGE_ID,
  owner_id: OWNER_ID,
  user_description: 'Depreciation 2024',
};

function disposal(
  overrides: Partial<IGetDepreciationDisposalsByIdsResult> & { id: string },
): IGetDepreciationDisposalsByIdsResult {
  return {
    charge_id: null,
    created_at: new Date('2024-12-01T00:00:00.000Z'),
    depreciation_id: 'asset',
    description: null,
    disposal_date: '2024-06-30',
    disposed_cost: '1000',
    original_amount: null,
    original_currency: null,
    owner_id: OWNER_ID,
    proceeds: '0',
    refund_mode: null,
    type: 'WRITE_OFF',
    updated_at: new Date('2024-12-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeInjector(disposals: IGetDepreciationDisposalsByIdsResult[]) {
  const getDisposalsByDates = vi.fn(async () => disposals);
  const injector: Injector = makeMockInjector(
    new Map<unknown, unknown>([
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            defaultLocalCurrency: Currency.Ils,
            depreciation: {
              accumulatedDepreciationTaxCategoryId: ACCUMULATED_DEPRECIATION_ID,
              rndDepreciationExpensesTaxCategoryId: 'tax-category-rnd-depreciation',
              gnmDepreciationExpensesTaxCategoryId: GNM_EXPENSES_ID,
              marketingDepreciationExpensesTaxCategoryId: 'tax-category-marketing-depreciation',
            },
          }),
        },
      ],
      [DepreciationDisposalsProvider, { getDisposalsByDates }],
    ]),
  );
  return { injector, getDisposalsByDates };
}

/** A disposal entry, as `generateDepreciationDisposalsLedger` books it */
function disposalEntry(amount: number): LedgerProto {
  return {
    id: 'write-off-ad',
    chargeId: CHARGE_ID,
    ownerId: OWNER_ID,
    invoiceDate: '2024-06-30',
    valueDate: '2024-06-30',
    currency: Currency.Ils,
    currencyRate: 1,
    isCreditorCounterparty: true,
    debitAccountID1: ACCUMULATED_DEPRECIATION_ID,
    creditAccountID1: ASSET_ACCOUNT_ID,
    localCurrencyDebitAmount1: amount,
    localCurrencyCreditAmount1: amount,
    description: 'Asset disposal: accumulated depreciation',
  };
}

async function generate(injector: Injector) {
  return expectGeneratedRecords(
    await generateLedgerRecordsForDepreciationExpenses(
      charge as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector } as never,
      {} as never,
    ),
  );
}

describe('generateLedgerRecordsForDepreciationExpenses', () => {
  beforeEach(() => {
    vi.mocked(calculateDepreciationAmount).mockResolvedValue({
      rndDepreciationYearlyAmount: 0,
      gnmDepreciationYearlyAmount: 2500,
      marketingDepreciationYearlyAmount: 0,
      totalDepreciationYearlyAmount: 2500,
    });
  });

  it("books the owner's charge-less write-offs of the year, and passes their errors through", async () => {
    const writeOff = disposal({ id: 'write-off' });
    const sold = disposal({ id: 'sold', type: 'SALE', charge_id: 'charge-sale', proceeds: '700' });
    const othersWriteOff = disposal({ id: 'others-write-off', owner_id: OTHER_OWNER_ID });
    const { injector, getDisposalsByDates } = makeInjector([writeOff, sold, othersWriteOff]);
    vi.mocked(generateDepreciationDisposalsLedger).mockResolvedValueOnce({
      entries: [disposalEntry(400)],
      errors: ['Loss on disposal of fixed assets tax category is not defined'],
      expectedProceeds: null,
    });

    const { records, errors } = await generate(injector);

    expect(calculateDepreciationAmount).toHaveBeenCalledWith(injector, 2024, OWNER_ID);
    expect(getDisposalsByDates).toHaveBeenCalledWith({
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
    });
    // the sale is booked by its own charge, and the other owner's write-off by that owner
    expect(generateDepreciationDisposalsLedger).toHaveBeenCalledTimes(1);
    expect(generateDepreciationDisposalsLedger).toHaveBeenCalledWith([writeOff], charge, injector);
    expect(errors).toEqual(['Loss on disposal of fixed assets tax category is not defined']);
    expect(records.map(summarize)).toEqual([
      expect.objectContaining({
        debit: GNM_EXPENSES_ID,
        localAmount: 2500,
        valueDate: '2024-12-31',
      }),
      expect.objectContaining({
        credit: ACCUMULATED_DEPRECIATION_ID,
        localAmount: 2500,
        valueDate: '2024-12-31',
      }),
      expect.objectContaining({
        debit: ACCUMULATED_DEPRECIATION_ID,
        credit: ASSET_ACCOUNT_ID,
        localAmount: 400,
        valueDate: '2024-06-30',
      }),
    ]);
  });
});
