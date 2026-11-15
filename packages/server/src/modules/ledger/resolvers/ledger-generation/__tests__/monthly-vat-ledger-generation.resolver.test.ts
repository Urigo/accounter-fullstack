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
  propertyOutputVatTaxCategoryId?: string | null;
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
              propertyOutputVatTaxCategoryId:
                'propertyOutputVatTaxCategoryId' in options
                  ? options.propertyOutputVatTaxCategoryId
                  : 'property-output-vat-tax-category-id',
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
      transactionsMinDebitDate: '2026-05-10',
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({ income: [], expenses: [], incompleteDocuments: [] } as never);

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
    vi.mocked(getVatRecords).mockResolvedValue({ income: [], expenses: [], incompleteDocuments: [] } as never);

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
      transactionsMinDebitDate: '2026-05-10',
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({ income: [], expenses: [], incompleteDocuments: [] } as never);

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
      transactionsMinDebitDate: '2026-05-10',
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({
      income: [{ roundedVATToAdd: 130 }],
      expenses: [{ roundedVATToAdd: 10 }],
      incompleteDocuments: [],
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
      transactionsMinDebitDate: '2026-05-10',
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({
      income: [{ roundedVATToAdd: 130 }],
      expenses: [{ roundedVATToAdd: 10 }],
      incompleteDocuments: [],
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

  it('flags a month whose VAT leaves out documents with missing data (#4946)', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -120,
      transactionsMinDebitDate: '2026-05-10',
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({
      income: [{ roundedVATToAdd: 130 }],
      expenses: [{ roundedVATToAdd: 10 }],
      incompleteDocuments: [
        { documentId: 'doc-1', chargeId: 'charge-1', missingFields: ['currency'] },
      ],
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

    expect(result.errors).toContain(
      'Monthly VAT for 04/2026 leaves out documents with missing data: document ID=doc-1 (charge ID=charge-1) is missing currency',
    );
  });

  it('does not store the ledger of a month that leaves out documents with missing data', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -120,
      transactionsMinDebitDate: '2026-05-10',
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({
      income: [{ roundedVATToAdd: 130 }],
      expenses: [{ roundedVATToAdd: 10 }],
      incompleteDocuments: [
        { documentId: 'doc-1', chargeId: 'charge-1', missingFields: ['currency'] },
      ],
    } as never);

    const result = await generateLedgerRecordsForMonthlyVat(
      { ...chargeBase, user_description: 'VAT for 04/2026' } as never,
      { insertLedgerRecordsIfNotExists: true },
      { injector: makeInjector() } as never,
      {} as never,
    );

    if (!result || 'message' in result) {
      throw new Error('Expected GeneratedLedgerRecords result');
    }
    // Still generated and returned for display, with the error explaining why it isn't stored.
    expect(result.errors.some(error => error.includes('leaves out documents'))).toBe(true);
    expect(storeInitialGeneratedRecords).not.toHaveBeenCalled();
  });

  it('stores the ledger of a complete month', async () => {
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -120,
      transactionsMinDebitDate: '2026-05-10',
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({
      income: [{ roundedVATToAdd: 130 }],
      expenses: [{ roundedVATToAdd: 10 }],
      incompleteDocuments: [],
    } as never);

    await generateLedgerRecordsForMonthlyVat(
      { ...chargeBase, user_description: 'VAT for 04/2026' } as never,
      { insertLedgerRecordsIfNotExists: true },
      { injector: makeInjector() } as never,
      {} as never,
    );

    expect(storeInitialGeneratedRecords).toHaveBeenCalledTimes(1);
  });

  it('rejects a property charge without a property VAT category before starting any branch', async () => {
    // Returning this error after the transaction and misc-expense branches had
    // started would end the request while they still query its DB client.
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -100,
      transactionsMinDebitDate: '2026-05-10',
      transactionsMinEventDate: null,
    } as never);
    vi.mocked(getVatRecords).mockResolvedValue({ income: [], expenses: [], incompleteDocuments: [] } as never);

    const result = await generateLedgerRecordsForMonthlyVat(
      { ...chargeBase, is_property: true, user_description: 'VAT for 04/2026' } as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector: makeInjector({ propertyOutputVatTaxCategoryId: null }) } as never,
      {} as never,
    );

    expect(result).toMatchObject({ __typename: 'CommonError' });
    expect(generateMiscExpensesLedger).not.toHaveBeenCalled();
  });

  it('does not return while another month is still loading its VAT records', async () => {
    // Each month is a full getVatRecords run. Returning on the first rejection
    // would leave the others querying a DB client the request has disposed.
    vi.mocked(getChargeTransactionsMeta).mockResolvedValue({
      transactionsAmount: -100,
      transactionsMinDebitDate: '2026-05-10',
      transactionsMinEventDate: null,
    } as never);
    let releaseSibling!: () => void;
    const sibling = new Promise<void>(resolve => {
      releaseSibling = resolve;
    });
    let requestDone = false;
    const queriesAfterRequest: string[] = [];
    vi.mocked(getVatRecords)
      .mockRejectedValueOnce(new Error('Currency missing'))
      .mockImplementationOnce(async () => {
        await sibling;
        if (requestDone) {
          queriesAfterRequest.push('SELECT documents');
        }
        return { income: [], expenses: [], incompleteDocuments: [] } as never;
      });

    const resultPromise = (async () => {
      try {
        return await generateLedgerRecordsForMonthlyVat(
          { ...chargeBase, user_description: 'VAT for 03-04/2026' } as never,
          { insertLedgerRecordsIfNotExists: false },
          { injector: makeInjector() } as never,
          {} as never,
        );
      } finally {
        requestDone = true;
      }
    })();
    setTimeout(releaseSibling, 20);

    await expect(resultPromise).resolves.toMatchObject({ __typename: 'CommonError' });
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(queriesAfterRequest).toEqual([]);
  });
});

