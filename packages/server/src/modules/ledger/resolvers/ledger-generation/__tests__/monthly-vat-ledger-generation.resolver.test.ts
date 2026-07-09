import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { Currency } from '../../../../../shared/enums.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import { getChargeTransactionsMeta } from '../../../../charges/helpers/common.helper.js';
import { getVatRecords } from '../../../../reports/resolvers/get-vat-records.resolver.js';
import { TransactionsProvider } from '../../../../transactions/providers/transactions.provider.js';
import { storeInitialGeneratedRecords } from '../../../helpers/ledgrer-storage.helper.js';
import { generateMiscExpensesLedger } from '../../../helpers/misc-expenses-ledger.helper.js';
import { getVatDataFromVatReportRecords } from '../../../helpers/monthly-vat-ledger-generation.helper.js';
import {
  getLedgerBalanceInfo,
  ledgerProtoToRecordsConverter,
} from '../../../helpers/utils.helper.js';
import { UnbalancedBusinessesProvider } from '../../../providers/unbalanced-businesses.provider.js';
import { generateLedgerRecordsForMonthlyVat } from '../monthly-vat-ledger-generation.resolver.js';

vi.mock('../../../../charges/helpers/common.helper.js', () => ({
  getChargeTransactionsMeta: vi.fn(),
}));

vi.mock('../../../../reports/resolvers/get-vat-records.resolver.js', () => ({
  getVatRecords: vi.fn(),
}));

vi.mock('../../../helpers/ledgrer-storage.helper.js', () => ({
  storeInitialGeneratedRecords: vi.fn(),
}));

vi.mock('../../../helpers/misc-expenses-ledger.helper.js', () => ({
  generateMiscExpensesLedger: vi.fn(),
}));

vi.mock('../../../helpers/monthly-vat-ledger-generation.helper.js', () => ({
  getVatDataFromVatReportRecords: vi.fn(),
}));

vi.mock('../../../helpers/utils.helper.js', () => {
  class LedgerError extends Error {}

  return {
    LedgerError,
    generatePartialLedgerEntry: vi.fn(),
    getFinancialAccountTaxCategoryId: vi.fn(),
    getLedgerBalanceInfo: vi.fn(),
    ledgerProtoToRecordsConverter: vi.fn((records: unknown) => records),
    updateLedgerBalanceByEntry: vi.fn(),
    validateTransactionRequiredVariables: vi.fn(),
  };
});

type InjectorOptions = {
  transactions?: unknown[];
  unbalancedBusinesses?: Array<{ business_id: string }>;
};

function makeInjector(options: InjectorOptions = {}): Injector {
  const transactionsByChargeIDLoader = {
    load: vi.fn().mockResolvedValue(options.transactions ?? []),
  };
  const getChargeUnbalancedBusinessesByChargeIds = {
    load: vi.fn().mockResolvedValue(options.unbalancedBusinesses ?? []),
  };

  return {
    get: <T>(token: unknown): T => {
      if (token === AdminContextProvider) {
        return {
          getVerifiedAdminContext: vi.fn().mockResolvedValue({
            defaultLocalCurrency: Currency.Ils,
            authorities: {
              vatBusinessId: 'vat-business-id',
              inputVatTaxCategoryId: 'input-vat-tax-category-id',
              outputVatTaxCategoryId: 'output-vat-tax-category-id',
              propertyOutputVatTaxCategoryId: 'property-output-vat-tax-category-id',
            },
            general: {
              taxCategories: {
                balanceCancellationTaxCategoryId: 'balance-cancellation-tax-category-id',
              },
            },
          }),
        } as T;
      }

      if (token === TransactionsProvider) {
        return {
          transactionsByChargeIDLoader,
        } as T;
      }

      if (token === UnbalancedBusinessesProvider) {
        return {
          getChargeUnbalancedBusinessesByChargeIds,
        } as T;
      }

      throw new Error(`Unexpected provider token: ${String(token)}`);
    },
  } as unknown as Injector;
}

describe('generateLedgerRecordsForMonthlyVat validation', () => {
  const chargeBase = {
    id: 'charge-1',
    owner_id: 'owner-1',
    is_property: false,
  };

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(generateMiscExpensesLedger).mockResolvedValue([]);
    vi.mocked(getLedgerBalanceInfo).mockResolvedValue({ isBalanced: true } as never);
    vi.mocked(ledgerProtoToRecordsConverter).mockImplementation(records => records as never);
    vi.mocked(getVatDataFromVatReportRecords).mockReturnValue([0, 0]);
    vi.mocked(storeInitialGeneratedRecords).mockResolvedValue(undefined as never);
  });

  it('adds an error when description contains multiple months', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -100,
      transactionsMinDebitDate: new Date('2026-05-10T00:00:00.000Z'),
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({ income: [], expenses: [] } as never);

    const result = await generateLedgerRecordsForMonthlyVat(
      { ...chargeBase, user_description: 'VAT for 03-04/2026' } as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector: makeInjector() } as never,
      {} as never,
    );

    if (!result || 'message' in result) {
      throw new Error('Expected GeneratedLedgerRecords result');
    }

    expect(result.errors).toContain(
      'Monthly VAT description must include a single report month',
    );
  });

  it('adds an error when transaction date is missing for VAT validation', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -100,
      transactionsMinDebitDate: null,
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({ income: [], expenses: [] } as never);

    const result = await generateLedgerRecordsForMonthlyVat(
      { ...chargeBase, user_description: 'VAT for 04/2026' } as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector: makeInjector() } as never,
      {} as never,
    );

    if (!result || 'message' in result) {
      throw new Error('Expected GeneratedLedgerRecords result');
    }

    expect(result.errors).toContain(
      'Monthly VAT validation requires at least one transaction date',
    );
  });

  it('adds an error when transactions amount is missing for VAT validation', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: null,
      transactionsMinDebitDate: new Date('2026-05-10T00:00:00.000Z'),
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({ income: [], expenses: [] } as never);

    const result = await generateLedgerRecordsForMonthlyVat(
      { ...chargeBase, user_description: 'VAT for 04/2026' } as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector: makeInjector() } as never,
      {} as never,
    );

    if (!result || 'message' in result) {
      throw new Error('Expected GeneratedLedgerRecords result');
    }

    expect(result.errors).toContain('Monthly VAT validation requires transactions amount');
  });

  it('adds an error when VAT amount does not match transactions sum', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -100,
      transactionsMinDebitDate: new Date('2026-05-10T00:00:00.000Z'),
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({
      income: [{ roundedVATToAdd: 130 }],
      expenses: [{ roundedVATToAdd: 10 }],
    } as never);

    const result = await generateLedgerRecordsForMonthlyVat(
      { ...chargeBase, user_description: 'VAT for 04/2026' } as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector: makeInjector() } as never,
      {} as never,
    );

    if (!result || 'message' in result) {
      throw new Error('Expected GeneratedLedgerRecords result');
    }

    expect(result.errors).toContain('Monthly VAT amount mismatch for 04/2026');
  });

  it('does not add VAT mismatch validation errors when amounts match', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -120,
      transactionsMinDebitDate: new Date('2026-05-10T00:00:00.000Z'),
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({
      income: [{ roundedVATToAdd: 130 }],
      expenses: [{ roundedVATToAdd: 10 }],
    } as never);

    const result = await generateLedgerRecordsForMonthlyVat(
      { ...chargeBase, user_description: 'VAT for 04/2026' } as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector: makeInjector() } as never,
      {} as never,
    );

    if (!result || 'message' in result) {
      throw new Error('Expected GeneratedLedgerRecords result');
    }

    expect(result.errors).not.toContain('Monthly VAT amount mismatch for 04/2026');
    expect(result.errors).not.toContain(
      'Monthly VAT validation requires at least one transaction date',
    );
    expect(result.errors).not.toContain('Monthly VAT validation requires transactions amount');
  });
});
