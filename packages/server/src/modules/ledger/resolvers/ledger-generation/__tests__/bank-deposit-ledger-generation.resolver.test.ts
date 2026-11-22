import { describe, expect, it } from 'vitest';
import type { Injector } from 'graphql-modules';
import { Currency } from '../../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import {
  buildDepositTimeline,
  CAPITALIZED_INTEREST_ACTION,
  matchDepositTaxEvents,
  PAID_OUT_INTEREST_ACTION,
  type DepositMovement,
} from '../../../../bank-deposits/helpers/deposit-timeline.helper.js';
import { BankDepositChargesProvider } from '../../../../bank-deposits/providers/bank-deposit-charges.provider.js';
import { DepositTimelineProvider } from '../../../../bank-deposits/providers/deposit-timeline.provider.js';
import { ChargesProvider } from '../../../../charges/providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../../../charges/types.js';
import { DocumentsProvider } from '../../../../documents/providers/documents.provider.js';
import { ExchangeProvider } from '../../../../exchange-rates/providers/exchange.provider.js';
import { SecurityBusinessesProvider } from '../../../../foreign-securities/providers/security-businesses.provider.js';
import { FinancialEntitiesProvider } from '../../../../financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../../../../financial-entities/providers/tax-categories.provider.js';
import { MiscExpensesProvider } from '../../../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../../transactions/types.js';
import { LedgerProvider } from '../../../providers/ledger.provider.js';
import { generateLedgerRecordsForBankDeposit } from '../bank-deposit-ledger-generation.resolver.js';
import {
  buildTransaction,
  expectGeneratedRecords,
  makeExchangeProvider,
  makeFinancialEntitiesProvider,
  makeInjector,
} from './helpers/ledger-generation-mocks.js';

/*
 * An ILS prime deposit: two top-ups, two partial withdrawals, then closed. At every event the bank
 * realized interest on the whole deposit; the withdrawn share was paid out (the "Interest" lines),
 * the rest (14.56 in total) was capitalized silently — no transaction — which is exactly what the
 * final withdrawal over-draws by. With the bank's tax-collection rows the ledger books it per
 * event, and the deposit account nets to zero across the deposit.
 *
 * All IDs are made up.
 */

const OWNER_ID = 'owner-business';
const DEPOSIT_ID = 'deposit-1';
const DEPOSIT_BUSINESS_ID = 'business-bank-deposit';
const BANK_ACCOUNT_ID = 'account-bank';
const INTEREST_BUSINESS_ID = 'business-bank-interest';
const INTEREST_INCOME_TAX_CATEGORY_ID = 'tax-category-deposit-interest-income';
const EXCHANGE_RATES_TAX_CATEGORY_ID = 'tax-category-exchange-rates';
const WITHHOLDING_TAX_CATEGORY_ID = 'tax-category-withholding';
const INTEREST_BUSINESS_TAX_CATEGORY_ID = 'tax-category-interest-business';

type Line = { id: string; chargeId: string; date: string; amount: number; isInterest?: boolean };

const lines: Line[] = [
  { id: 't1', chargeId: 'c1', date: '2025-11-13', amount: -5743.69 },
  { id: 't2', chargeId: 'c2', date: '2025-11-19', amount: 14.08 },
  { id: 't2i', chargeId: 'c2', date: '2025-11-19', amount: 0.01, isInterest: true },
  { id: 't3', chargeId: 'c3', date: '2025-12-01', amount: -7255.97 },
  { id: 't4', chargeId: 'c4', date: '2025-12-03', amount: 19.84 },
  { id: 't5', chargeId: 'c5', date: '2025-12-05', amount: 12_980.3 },
  { id: 't5i', chargeId: 'c5', date: '2025-12-05', amount: 2.69, isInterest: true },
];

const taxRows = [
  ['2025-11-19', PAID_OUT_INTEREST_ACTION, 0.01, 0],
  ['2025-11-19', CAPITALIZED_INTEREST_ACTION, 4.43, 0],
  ['2025-12-01', CAPITALIZED_INTEREST_ACTION, 7.44, 0],
  ['2025-12-03', CAPITALIZED_INTEREST_ACTION, 2.69, 0],
  ['2025-12-05', PAID_OUT_INTEREST_ACTION, 2.69, 0],
] as const;

/** Same rows, but the bank withheld 0.47 tax on the 2.69 net interest paid out on 05/12 */
const taxRowsWithWithholding = taxRows.map(([date, action, amount, tax]) =>
  date === '2025-12-05' ? ([date, action, 3.16, 0.47] as const) : ([date, action, amount, tax] as const),
);

function transactionsOf(chargeId: string): IGetTransactionsByChargeIdsResult[] {
  return lines
    .filter(line => line.chargeId === chargeId)
    .map(line =>
      buildTransaction({
        id: line.id,
        chargeId,
        ownerId: OWNER_ID,
        accountId: BANK_ACCOUNT_ID,
        businessId: line.isInterest ? INTEREST_BUSINESS_ID : DEPOSIT_BUSINESS_ID,
        amount: String(line.amount),
        currency: Currency.Ils,
        debitDate: line.date as TimelessDateString,
      }),
    );
}

function chargeOf(chargeId: string): IGetChargesByIdsResult {
  return {
    id: chargeId,
    accountant_status: 'PENDING',
    created_at: new Date('2025-12-06T00:00:00.000Z'),
    documents_optional_flag: false,
    invoice_payment_currency_diff: null,
    is_property: false,
    optional_vat: false,
    owner_id: OWNER_ID,
    tax_category_id: null,
    type: 'BANK_DEPOSIT',
    updated_at: new Date('2025-12-06T00:00:00.000Z'),
    user_description: null,
  } as IGetChargesByIdsResult;
}

function timeline(withBankRows: boolean, rows: ReadonlyArray<readonly [string, string, number, number]> = taxRows) {
  const movements: DepositMovement[] = lines.map(line => ({
    id: line.id,
    chargeId: line.chargeId,
    date: line.date as TimelessDateString,
    amount: line.amount,
    rate: 1,
    isPrincipal: !line.isInterest,
  }));
  const bankFigures = withBankRows
    ? matchDepositTaxEvents(
        rows.map(([date, action, amount, tax]) => ({
          id: `${date}-${action}`,
          date: date as TimelessDateString,
          actionTypeDescription: action,
          taxEventAmount: amount,
          debitAmount: tax,
          crditAmount: 0,
        })),
        [{ depositId: DEPOSIT_ID, movements }],
      ).byDeposit.get(DEPOSIT_ID)
    : undefined;
  return {
    ...buildDepositTimeline({
      currency: Currency.Ils,
      localCurrency: Currency.Ils,
      movements,
      bankFigures,
      isClosed: true,
    }),
    depositId: DEPOSIT_ID,
    currency: Currency.Ils,
    unmatchedTaxEvents: [],
  };
}

type InjectorOptions = {
  withBankRows?: boolean;
  /** Tax category of the interest business (the visible interest lines' credit account) */
  interestTaxCategoryId?: string;
  withholdingTaxCategoryId?: string | null;
  loadTimeline?: () => Promise<ReturnType<typeof timeline>>;
};

function injectorFor({
  withBankRows = true,
  interestTaxCategoryId = INTEREST_INCOME_TAX_CATEGORY_ID,
  withholdingTaxCategoryId = null,
  loadTimeline = async () => timeline(withBankRows),
}: InjectorOptions = {}): Injector {
  return makeInjector(
    new Map<unknown, unknown>([
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            defaultLocalCurrency: Currency.Ils,
            general: { taxCategories: { exchangeRateTaxCategoryId: EXCHANGE_RATES_TAX_CATEGORY_ID } },
            financialAccounts: { internalWalletsIds: [] },
            bankDeposits: {
              bankDepositBusinessId: DEPOSIT_BUSINESS_ID,
              bankDepositInterestIncomeTaxCategoryId: INTEREST_INCOME_TAX_CATEGORY_ID,
              bankDepositWithholdingTaxCategoryId: withholdingTaxCategoryId,
            },
          }),
        },
      ],
      [
        TransactionsProvider,
        { transactionsByChargeIDLoader: { load: async (id: string) => transactionsOf(id) } },
      ],
      [ChargesProvider, { getChargeByIdLoader: { load: async (id: string) => chargeOf(id) } }],
      [DocumentsProvider, { getDocumentsByChargeIdLoader: { load: async () => [] } }],
      [LedgerProvider, { getLedgerRecordsByChargesIdLoader: { load: async () => [] } }],
      [MiscExpensesProvider, { getExpensesByChargeIdLoader: { load: async () => [] } }],
      [ExchangeProvider, makeExchangeProvider([])],
      [
        TaxCategoriesProvider,
        {
          taxCategoryByBusinessIDsLoader: {
            load: async () => ({ id: interestTaxCategoryId }),
          },
          taxCategoryByFinancialAccountIdsAndCurrenciesLoader: {
            load: async () => ({ id: 'tax-category-bank-account' }),
          },
        },
      ],
      [
        BankDepositChargesProvider,
        { getBankDepositByChargeIdLoader: { load: async () => ({ id: DEPOSIT_ID }) } },
      ],
      [
        DepositTimelineProvider,
        { depositTimelineLoader: { load: loadTimeline } },
      ],
      [FinancialEntitiesProvider, makeFinancialEntitiesProvider([DEPOSIT_BUSINESS_ID])],
      [SecurityBusinessesProvider, { getAllSecurityBusinessIds: async () => new Set<string>() }],
    ]),
  );
}

async function generateRaw(chargeId: string, options: InjectorOptions = {}) {
  return generateLedgerRecordsForBankDeposit(
    chargeOf(chargeId) as never,
    { insertLedgerRecordsIfNotExists: false },
    { injector: injectorFor(options) } as never,
    {} as never,
  );
}

async function generate(chargeId: string, withBankRows = true) {
  return expectGeneratedRecords(await generateRaw(chargeId, { withBankRows }));
}

/** Debit − credit of the deposit account, local currency */
function depositAccountBalance(result: Awaited<ReturnType<typeof generate>>) {
  return result.records.reduce((sum, record) => {
    let next = sum;
    if (record.debit_entity1 === DEPOSIT_BUSINESS_ID) next += Number(record.debit_local_amount1);
    if (record.credit_entity1 === DEPOSIT_BUSINESS_ID) next -= Number(record.credit_local_amount1);
    return next;
  }, 0);
}

/** The gross-up of the tax withheld from paid-out interest (not the in-deposit `|tax` entry) */
function taxPaidOutRecord(result: Awaited<ReturnType<typeof generate>>) {
  const records = result.records.filter(
    r =>
      r.description === 'Bank deposit interest tax withheld' &&
      r.debit_entity1 === WITHHOLDING_TAX_CATEGORY_ID &&
      r.credit_entity1 !== DEPOSIT_BUSINESS_ID,
  );
  expect(records).toHaveLength(1);
  return records[0];
}

describe('generateLedgerRecordsForBankDeposit', () => {
  it('books the capitalized interest on the partial withdrawal', async () => {
    const result = await generate('c2');
    expect(result.errors).toEqual([]);
    const interest = result.records.find(r => r.description === 'Bank deposit capitalized interest');
    expect(interest?.debit_entity1).toBe(DEPOSIT_BUSINESS_ID);
    expect(interest?.credit_entity1).toBe(INTEREST_INCOME_TAX_CATEGORY_ID);
    expect(Number(interest?.debit_local_amount1)).toBeCloseTo(4.43, 6);
  });

  it.each([true, false])(
    'nets the deposit account to zero across the deposit (bank rows: %s)',
    async withBankRows => {
      let total = 0;
      for (const chargeId of ['c1', 'c2', 'c3', 'c4', 'c5']) {
        const result = await generate(chargeId, withBankRows);
        expect(result.errors.filter(e => !e.includes('inferred'))).toEqual([]);
        total += depositAccountBalance(result);
      }
      expect(total).toBeCloseTo(0, 6);
    },
  );

  it('credits the paid-out tax gross-up to the visible interest line account', async () => {
    const result = expectGeneratedRecords(
      await generateRaw('c5', {
        interestTaxCategoryId: INTEREST_BUSINESS_TAX_CATEGORY_ID,
        withholdingTaxCategoryId: WITHHOLDING_TAX_CATEGORY_ID,
        loadTimeline: async () => timeline(true, taxRowsWithWithholding),
      }),
    );
    expect(result.errors).toEqual([]);

    // the visible (net) interest line is credited to the interest business' tax category
    expect(
      result.records.filter(r => r.credit_entity1 === INTEREST_BUSINESS_TAX_CATEGORY_ID),
    ).toHaveLength(2);

    const taxPaidOut = taxPaidOutRecord(result);
    expect(taxPaidOut?.debit_entity1).toBe(WITHHOLDING_TAX_CATEGORY_ID);
    // the same account as the visible interest line, not the admin-context default
    expect(taxPaidOut?.credit_entity1).toBe(INTEREST_BUSINESS_TAX_CATEGORY_ID);
    expect(Number(taxPaidOut?.credit_local_amount1)).toBeCloseTo(0.47, 6);
  });

  it('falls back to the interest income tax category when the charge has no visible interest line', async () => {
    // the 0.47 tax is moved onto c4, which has no interest line
    const rows = taxRows.map(([date, action, amount, tax]) =>
      date === '2025-12-03'
        ? ([date, PAID_OUT_INTEREST_ACTION, 0.47, 0.47] as const)
        : ([date, action, amount, tax] as const),
    );
    const result = expectGeneratedRecords(
      await generateRaw('c4', {
        interestTaxCategoryId: INTEREST_BUSINESS_TAX_CATEGORY_ID,
        withholdingTaxCategoryId: WITHHOLDING_TAX_CATEGORY_ID,
        loadTimeline: async () => timeline(true, rows),
      }),
    );
    const taxPaidOut = taxPaidOutRecord(result);
    expect(taxPaidOut?.credit_entity1).toBe(INTEREST_INCOME_TAX_CATEGORY_ID);
    expect(Number(taxPaidOut?.credit_local_amount1)).toBeCloseTo(0.47, 6);
  });

  it('returns the charge records plus a ledger error when the deposit timeline fails', async () => {
    const result = await generateRaw('c2', {
      loadTimeline: async () => {
        throw new Error('missing exchange rate');
      },
    });
    expect(result).not.toHaveProperty('__typename', 'CommonError');
    const generated = expectGeneratedRecords(result);
    expect(generated.errors).toContain(
      'Failed to build bank deposit timeline: missing exchange rate',
    );
    // the bank movement and the visible interest line are still booked
    expect(generated.records).toHaveLength(2);
    expect(generated.records.some(r => r.credit_entity1 === INTEREST_INCOME_TAX_CATEGORY_ID)).toBe(
      true,
    );
  });
});
