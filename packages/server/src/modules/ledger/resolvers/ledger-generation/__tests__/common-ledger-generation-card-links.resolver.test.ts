import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { Currency } from '../../../../../shared/enums.js';
import type { TimelessDateString } from '../../../../../shared/types/index.js';
import { AdminContextProvider } from '../../../../admin-context/providers/admin-context.provider.js';
import {
  calculateTotalAmount,
  getChargeBusinesses,
  getChargeDocumentsMeta,
} from '../../../../charges/helpers/common.helper.js';
import type { IGetChargesByIdsResult } from '../../../../charges/types.js';
import { ExchangeProvider } from '../../../../exchange-rates/providers/exchange.provider.js';
import { FinancialAccountsProvider } from '../../../../financial-accounts/providers/financial-accounts.provider.js';
import { BusinessesProvider } from '../../../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../../../financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '../../../../financial-entities/providers/tax-categories.provider.js';
import { MiscExpensesProvider } from '../../../../misc-expenses/providers/misc-expenses.provider.js';
import { statementKeyId } from '../../../../transactions/helpers/creditcard-statement-matcher.helper.js';
import { CreditCardStatementsProvider } from '../../../../transactions/providers/creditcard-statements.provider.js';
import { TransactionsProvider } from '../../../../transactions/providers/transactions.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '../../../../transactions/types.js';
import { BalanceCancellationProvider } from '../../../providers/balance-cancellation.provider.js';
import { UnbalancedBusinessesProvider } from '../../../providers/unbalanced-businesses.provider.js';
import { ledgerEntriesFromMainTransaction } from '../../../helpers/common-charge-ledger.helper.js';
import { generateLedgerRecordsForCommonCharge } from '../common-ledger-generation.resolver.js';
import {
  buildTransaction,
  expectGeneratedRecords,
  makeExchangeProvider,
  makeFinancialEntitiesProvider,
  makeInjector as makeMockInjector,
  summarize,
  type MockRate,
} from './helpers/ledger-generation-mocks.js';

/*
 * A bank's card debit, booked by the common charge generator. A debit with stored links to card
 * statements is booked against the linked card accounts, one entry per statement, and needs no
 * counterparty business. A debit without links keeps the reference lookup.
 *
 * All IDs, amounts, rates and dates below are made up.
 */

vi.mock('../../../../charges/helpers/common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../../charges/helpers/common.helper.js')>()),
  calculateTotalAmount: vi.fn(),
  getChargeBusinesses: vi.fn(),
  getChargeDocumentsMeta: vi.fn(),
  getChargeTaxCategoryId: vi.fn(async () => null),
}));

vi.mock('../../../helpers/cross-year-ledger.helper.js', () => ({
  handleCrossYearLedgerEntries: vi.fn(async () => null),
}));

vi.mock('../../../../deel/helpers/deel.helper.js', () => ({
  getDeelEmployeeId: vi.fn(async () => undefined),
  isDeelDocument: vi.fn(() => false),
}));

const CHARGE_ID = 'charge-card-debit';
const OWNER_ID = 'owner-business';
const ISSUER_ID = 'business-card-issuer';
const BANK_ACCOUNT_ID = 'account-bank';
const CARD_A = 'account-card-a';
const CARD_B = 'account-card-b';

const DAY: TimelessDateString = '2026-03-10';

function accountTaxCategoryId(accountId: string, currency: Currency): string {
  return `tax-category:${accountId}:${currency}`;
}

const charge: IGetChargesByIdsResult = {
  id: CHARGE_ID,
  accountant_status: 'PENDING',
  created_at: new Date('2026-03-12T00:00:00.000Z'),
  documents_optional_flag: false,
  invoice_payment_currency_diff: null,
  is_property: false,
  optional_vat: false,
  owner_id: OWNER_ID,
  tax_category_id: null,
  type: null,
  updated_at: new Date('2026-03-12T00:00:00.000Z'),
  user_description: null,
};

function bankDebit(options: {
  amount: string;
  currency?: Currency;
  businessId?: string | null;
  reference?: string;
}): IGetTransactionsByChargeIdsResult {
  return {
    ...buildTransaction({
      id: 'bank-debit',
      chargeId: CHARGE_ID,
      ownerId: OWNER_ID,
      accountId: BANK_ACCOUNT_ID,
      businessId: ISSUER_ID,
      amount: options.amount,
      currency: options.currency ?? Currency.Ils,
      debitDate: DAY,
    }),
    business_id: options.businessId ?? null,
    source_reference: options.reference ?? 'bank-reference',
  };
}

type Link = {
  cardAccountId: string;
  debitDate: TimelessDateString;
  cardAmounts: string[];
  /** Defaults to the bank transaction's owner */
  ownerId?: string;
  /** Defaults to the bank transaction's currency */
  currency?: Currency;
};

function makeInjector(options: {
  transaction: IGetTransactionsByChargeIdsResult;
  links?: Link[];
  rates?: MockRate[];
  internalWalletsIds?: string[];
  accountsByNumber?: Record<string, string>;
}): Injector {
  const currency = options.transaction.currency;
  const links = options.links ?? [];
  const cardRows = new Map(
    links.map(link => [
      statementKeyId({
        cardAccountId: link.cardAccountId,
        currency: link.currency ?? currency,
        debitDate: link.debitDate,
      }),
      link.cardAmounts.map((amount, index) => ({
        id: `${link.cardAccountId}-${index}`,
        owner_id: OWNER_ID,
        amount,
      })),
    ]),
  );
  return makeMockInjector(
    new Map<unknown, unknown>([
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: async () => ({
            defaultLocalCurrency: Currency.Ils,
            defaultTaxCategoryId: 'tax-category-default',
            general: {
              taxCategories: {
                exchangeRateTaxCategoryId: 'tax-category-exchange-rates',
                incomeExchangeRateTaxCategoryId: 'tax-category-income-exchange-rates',
                feeTaxCategoryId: 'tax-category-fees',
                generalFeeTaxCategoryId: 'tax-category-general-fees',
              },
            },
            financialAccounts: {
              internalWalletsIds: options.internalWalletsIds ?? [],
              creditCardIds: [ISSUER_ID],
              swiftBusinessId: null,
            },
          }),
        },
      ],
      [
        TransactionsProvider,
        { transactionsByChargeIDLoader: { load: async () => [options.transaction] } },
      ],
      [
        CreditCardStatementsProvider,
        {
          getLinksByBankTransactionIdLoader: {
            load: async (id: string) =>
              id === options.transaction.id
                ? links.map(link => ({
                    owner_id: link.ownerId ?? OWNER_ID,
                    bank_transaction_id: id,
                    card_account_id: link.cardAccountId,
                    currency: link.currency ?? currency,
                    debit_date: link.debitDate,
                    link_method: 'MANUAL',
                  }))
                : [],
          },
          getCardTransactionsByStatementKeyLoader: {
            load: async (key: string) => cardRows.get(key) ?? [],
          },
        },
      ],
      [
        FinancialAccountsProvider,
        {
          getFinancialAccountByAccountNumberLoader: {
            load: async (accountNumber: string) => {
              const id = options.accountsByNumber?.[accountNumber];
              return id ? { id, account_number: accountNumber } : undefined;
            },
          },
        },
      ],
      [
        UnbalancedBusinessesProvider,
        { getChargeUnbalancedBusinessesByChargeIds: { load: async () => [] } },
      ],
      [
        BalanceCancellationProvider,
        { getBalanceCancellationByChargesIdLoader: { load: async () => [] } },
      ],
      [
        BusinessesProvider,
        {
          getBusinessByIdLoader: {
            load: async (id: string) => ({
              id,
              name: 'Issuer',
              can_settle_with_receipt: false,
              no_invoices_required: false,
            }),
          },
        },
      ],
      [ExchangeProvider, makeExchangeProvider(options.rates ?? [])],
      [
        TaxCategoriesProvider,
        {
          taxCategoryByFinancialAccountIdsAndCurrenciesLoader: {
            load: async ({
              financialAccountId,
              currency,
            }: {
              financialAccountId: string;
              currency: Currency;
            }) => ({ id: accountTaxCategoryId(financialAccountId, currency) }),
          },
        },
      ],
      [MiscExpensesProvider, { getExpensesByChargeIdLoader: { load: async () => [] } }],
      [FinancialEntitiesProvider, makeFinancialEntitiesProvider([ISSUER_ID])],
    ]),
  );
}

async function generate(injector: Injector) {
  return expectGeneratedRecords(
    await generateLedgerRecordsForCommonCharge(
      charge as never,
      { insertLedgerRecordsIfNotExists: false },
      { injector } as never,
      {} as never,
    ),
  );
}

describe('generateLedgerRecordsForCommonCharge — card debits', () => {
  beforeEach(() => {
    vi.mocked(getChargeDocumentsMeta).mockResolvedValue({
      invoiceCount: 0,
      receiptCount: 0,
    } as never);
    vi.mocked(calculateTotalAmount).mockResolvedValue(null as never);
    vi.mocked(getChargeBusinesses).mockResolvedValue({ mainBusinessId: null } as never);
  });

  it('books a debit linked to one statement against its card account, for the full amount', async () => {
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: ISSUER_ID }),
      // the card rows don't add up to the debit: a single statement takes the whole debit anyway
      links: [{ cardAccountId: CARD_A, debitDate: DAY, cardAmounts: ['-300'] }],
    });

    const { records, balance, errors } = await generate(injector);

    expect(errors).toEqual([]);
    expect(balance?.isBalanced).toBe(true);
    expect(records.map(summarize)).toEqual([
      expect.objectContaining({
        debit: accountTaxCategoryId(CARD_A, Currency.Ils),
        credit: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Ils),
        currency: Currency.Ils,
        localAmount: 500,
        valueDate: DAY,
      }),
    ]);
  });

  it('needs no counterparty business for a linked debit', async () => {
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: null }),
      links: [{ cardAccountId: CARD_A, debitDate: DAY, cardAmounts: ['-500'] }],
    });

    const { records, balance, errors } = await generate(injector);

    expect(errors).toEqual([]);
    expect(balance?.isBalanced).toBe(true);
    expect(records.map(summarize)).toEqual([
      expect.objectContaining({
        debit: accountTaxCategoryId(CARD_A, Currency.Ils),
        credit: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Ils),
        localAmount: 500,
      }),
    ]);
  });

  it('splits a combined debit into one entry per linked statement, exactly', async () => {
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500.30', businessId: null }),
      links: [
        { cardAccountId: CARD_A, debitDate: DAY, cardAmounts: ['-200.10', '-100.05'] },
        // a refund in the statement nets against its charges
        { cardAccountId: CARD_B, debitDate: '2026-03-09', cardAmounts: ['-210.15', '10.00'] },
      ],
    });

    const { records, balance, errors } = await generate(injector);

    expect(errors).toEqual([]);
    expect(balance?.isBalanced).toBe(true);
    const entries = records.map(summarize);
    expect(entries).toEqual([
      expect.objectContaining({
        debit: accountTaxCategoryId(CARD_A, Currency.Ils),
        credit: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Ils),
        localAmount: 300.15,
        valueDate: DAY,
      }),
      expect.objectContaining({
        debit: accountTaxCategoryId(CARD_B, Currency.Ils),
        credit: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Ils),
        localAmount: 200.15,
        valueDate: DAY,
      }),
    ]);
    const totalCents = entries.reduce((sum, entry) => sum + Math.round((entry.localAmount ?? 0) * 100), 0);
    expect(totalCents).toBe(50_030);
  });

  it('refuses linked statements that do not add up to the debit', async () => {
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: null, reference: 'debit-ref' }),
      links: [
        { cardAccountId: CARD_A, debitDate: DAY, cardAmounts: ['-300'] },
        { cardAccountId: CARD_B, debitDate: DAY, cardAmounts: ['-199.99'] },
      ],
    });

    const { records, errors } = await generate(injector);

    expect(errors).toEqual([
      'Transaction reference "debit-ref": linked card statements total -499.99 but the debit is -500.00; fix the links',
    ]);
    expect(records).toEqual([]);
  });

  it('books every part of a foreign-currency combined debit at the debit date rate', async () => {
    const rateDay: TimelessDateString = '2026-03-10';
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-150', currency: Currency.Usd, businessId: null }),
      links: [
        { cardAccountId: CARD_A, debitDate: '2026-03-08', cardAmounts: ['-100'] },
        { cardAccountId: CARD_B, debitDate: '2026-03-12', cardAmounts: ['-50'] },
      ],
      // only the debit's own date is quoted: a lookup at a statement's date fails the test
      rates: [[Currency.Usd, rateDay, 3.5]],
    });

    const { records, balance, errors } = await generate(injector);

    expect(errors).toEqual([]);
    expect(balance?.isBalanced).toBe(true);
    expect(records.map(summarize)).toEqual([
      expect.objectContaining({
        debit: accountTaxCategoryId(CARD_A, Currency.Usd),
        credit: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Usd),
        currency: Currency.Usd,
        foreignAmount: 100,
        localAmount: 350,
        valueDate: rateDay,
      }),
      expect.objectContaining({
        debit: accountTaxCategoryId(CARD_B, Currency.Usd),
        credit: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Usd),
        currency: Currency.Usd,
        foreignAmount: 50,
        localAmount: 175,
        valueDate: rateDay,
      }),
    ]);
    expect(
      vi.mocked(injector.get(ExchangeProvider).getExchangeRates).mock.calls.every(
        ([, , date]) => date === rateDay,
      ),
    ).toBe(true);
  });

  it('keeps the reference lookup for an unlinked debit', async () => {
    vi.mocked(getChargeBusinesses).mockResolvedValue({ mainBusinessId: ISSUER_ID } as never);
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: ISSUER_ID, reference: '4242' }),
      internalWalletsIds: [ISSUER_ID],
      accountsByNumber: { '4242': CARD_A },
    });

    const { records, balance, errors } = await generate(injector);

    expect(errors).toEqual([]);
    expect(balance?.isBalanced).toBe(true);
    expect(records.map(summarize)).toEqual([
      expect.objectContaining({
        debit: accountTaxCategoryId(CARD_A, Currency.Ils),
        credit: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Ils),
        localAmount: 500,
      }),
    ]);
  });

  it('reports an unlinked debit whose reference resolves to no account', async () => {
    vi.mocked(getChargeBusinesses).mockResolvedValue({ mainBusinessId: ISSUER_ID } as never);
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: ISSUER_ID, reference: '8547' }),
      internalWalletsIds: [ISSUER_ID],
    });

    const { errors } = await generate(injector);

    expect(errors).toContain(
      `Transaction reference "8547" is missing account: link the debit to its card statement in the charge's CreditCard Transactions panel`,
    );
  });

  it('still requires a counterparty for an unlinked debit', async () => {
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: null, reference: 'debit-ref' }),
    });

    const { errors } = await generate(injector);

    expect(errors).toContain('Transaction reference "debit-ref" is missing business_id');
  });

  it('books each part in its own direction: a statement in credit offsets the others', async () => {
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: null }),
      links: [
        { cardAccountId: CARD_A, debitDate: DAY, cardAmounts: ['-600'] },
        { cardAccountId: CARD_B, debitDate: DAY, cardAmounts: ['100'] },
      ],
    });

    const { records, balance, errors } = await generate(injector);

    expect(errors).toEqual([]);
    expect(balance?.isBalanced).toBe(true);
    expect(records.map(summarize)).toEqual([
      expect.objectContaining({
        debit: accountTaxCategoryId(CARD_A, Currency.Ils),
        credit: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Ils),
        localAmount: 600,
      }),
      expect.objectContaining({
        debit: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Ils),
        credit: accountTaxCategoryId(CARD_B, Currency.Ils),
        localAmount: 100,
      }),
    ]);
  });

  it("ignores another owner's link", async () => {
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: null }),
      links: [
        { cardAccountId: CARD_A, debitDate: DAY, cardAmounts: ['-500'] },
        { cardAccountId: CARD_B, debitDate: DAY, cardAmounts: ['-70'], ownerId: 'owner-other' },
      ],
    });

    const { records, errors } = await generate(injector);

    // the own link alone: one statement, the whole debit
    expect(errors).toEqual([]);
    expect(records.map(summarize)).toEqual([
      expect.objectContaining({
        debit: accountTaxCategoryId(CARD_A, Currency.Ils),
        localAmount: 500,
      }),
    ]);
  });

  it('refuses a link in another currency than the debit', async () => {
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: null, reference: 'debit-ref' }),
      links: [
        { cardAccountId: CARD_A, debitDate: DAY, cardAmounts: ['-500'], currency: Currency.Usd },
      ],
    });

    const { errors } = await generate(injector);

    expect(errors).toEqual([
      'Transaction reference "debit-ref": a linked card statement is in USD but the debit is in ILS; fix the links',
    ]);
  });
});

describe('ledgerEntriesFromMainTransaction', () => {
  it('ignores the links of a charge with relevant documents', async () => {
    const injector = makeInjector({
      transaction: bankDebit({ amount: '-500', businessId: ISSUER_ID, reference: '4242' }),
      links: [{ cardAccountId: CARD_B, debitDate: DAY, cardAmounts: ['-500'] }],
      internalWalletsIds: [ISSUER_ID],
      accountsByNumber: { '4242': CARD_A },
    });

    const entries = await ledgerEntriesFromMainTransaction(
      bankDebit({ amount: '-500', businessId: ISSUER_ID, reference: '4242' }),
      injector,
      CHARGE_ID,
      OWNER_ID,
      ISSUER_ID,
      true,
    );

    // booked against the counterparty, as any payment of an invoiced charge
    expect(entries).toEqual([
      expect.objectContaining({
        debitAccountID1: ISSUER_ID,
        creditAccountID1: accountTaxCategoryId(BANK_ACCOUNT_ID, Currency.Ils),
        localCurrencyDebitAmount1: 500,
      }),
    ]);
  });
});
