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
  ['2025-11-19', PAID_OUT_INTEREST_ACTION, 0.01],
  ['2025-11-19', CAPITALIZED_INTEREST_ACTION, 4.43],
  ['2025-12-01', CAPITALIZED_INTEREST_ACTION, 7.44],
  ['2025-12-03', CAPITALIZED_INTEREST_ACTION, 2.69],
  ['2025-12-05', PAID_OUT_INTEREST_ACTION, 2.69],
] as const;

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

function timeline(withBankRows: boolean) {
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
        taxRows.map(([date, action, amount]) => ({
          id: `${date}-${action}`,
          date: date as TimelessDateString,
          actionTypeDescription: action,
          taxEventAmount: amount,
          debitAmount: 0,
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

function injectorFor(withBankRows: boolean): Injector {
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
              bankDepositWithholdingTaxCategoryId: null,
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
            load: async () => ({ id: INTEREST_INCOME_TAX_CATEGORY_ID }),
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
        { depositTimelineLoader: { load: async () => timeline(withBankRows) } },
      ],
      [FinancialEntitiesProvider, makeFinancialEntitiesProvider([DEPOSIT_BUSINESS_ID])],
      [SecurityBusinessesProvider, { getAllSecurityBusinessIds: async () => new Set<string>() }],
    ]),
  );
}

async function generate(chargeId: string, withBankRows = true) {
  return expectGeneratedRecords(
    await generateLedgerRecordsForBankDeposit(
      chargeOf(chargeId) as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector: injectorFor(withBankRows) } as never,
      {} as never,
    ),
  );
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
});
