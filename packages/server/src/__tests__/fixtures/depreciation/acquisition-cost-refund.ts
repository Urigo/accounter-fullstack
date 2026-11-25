/**
 * The acquisition cost-refund scenario (docs/annual-audit-workflow/depreciation/
 * acquisition-cost-refund-test-spec.md). All names, dates, amounts and rates are fictional.
 *
 * A buyer acquires the activity of a seller for USD 480,000 (an asset deal, contract date
 * 2023-08-20): USD 440,000 paid on 2023-08-27 and USD 40,000 of the seller's liabilities assumed.
 * The price is allocated to software, customer relationships, goodwill, trademarks (not
 * depreciated) and acquired receivables, entered as misc expenses against the seller. On 2024-04-14
 * a supplier refunds USD 100,000 the acquired business was already owed: a credit note, a bank
 * receipt of USD 99,980 and a USD 20 fee. The refund corrects the cost of the intangibles (from
 * activation): goodwill first, the rest pro rata.
 *
 * The ledger is on the system's aggregate accounts: one accumulated-depreciation account, the R&D
 * and G&A depreciation expense accounts by asset type, a depreciation-correction (ordinary income)
 * account, exchange rates and fees, and a clearing account P that the refund charge books the
 * credit note to.
 *
 * The scenario is inserted in two steps, like the real flow: `acquisitionCostRefundFixture` (the
 * charges, the assets and the money), then `costRefundsFixture` (the cost refunds, entered on the
 * refund charge once the supplier's credit note arrives).
 */

import type { PoolClient } from 'pg';
import { makeUUID } from '../../../demo-fixtures/helpers/deterministic-uuid.js';
import { CountryCode, Currency } from '../../../shared/enums.js';
import {
  createBusiness,
  createCharge,
  createDocument,
  createFinancialAccount,
  createTaxCategory,
  createTransaction,
} from '../../factories/index.js';
import type { Fixture } from '../../helpers/fixture-types.js';
import { ensureBusinessForEntity, ensureFinancialEntity } from '../../helpers/seed-helpers.js';
import { qualifyTable } from '../../helpers/test-db-config.js';

const id = (namespace: string, name: string) => makeUUID(namespace, `acquisition-refund-${name}`);

export const BUYER_ID = id('business', 'buyer');

export const BUSINESSES = {
  buyer: BUYER_ID,
  seller: id('business', 'seller'),
  refundSupplier: id('business', 'refund-supplier'),
} as const;

/** The tax categories (ledger accounts) of the scenario */
export const ACCOUNTS = {
  software: id('tax-category', 'software'),
  customerRelationships: id('tax-category', 'customer-relationships'),
  goodwill: id('tax-category', 'goodwill'),
  trademarks: id('tax-category', 'trademarks'),
  acquiredReceivables: id('tax-category', 'acquired-receivables'),
  assumedLiabilities: id('tax-category', 'assumed-liabilities'),
  accumulatedDepreciation: id('tax-category', 'accumulated-depreciation'),
  rndDepreciation: id('tax-category', 'rnd-depreciation-expenses'),
  gnaDepreciation: id('tax-category', 'gna-depreciation-expenses'),
  marketingDepreciation: id('tax-category', 'marketing-depreciation-expenses'),
  depreciationCorrection: id('tax-category', 'depreciation-correction'),
  exchangeRates: id('tax-category', 'exchange-rates'),
  fees: id('tax-category', 'bank-fees'),
  /** P: the refund charge's tax category */
  refundClearing: id('tax-category', 'refund-clearing'),
  bankUsd: id('tax-category', 'bank-usd'),
} as const;

export const BANK_ACCOUNT_NUMBER = 'ACQ-REFUND-USD-001';

export const CHARGES = {
  acquisition: id('charge', 'acquisition'),
  refund: id('charge', 'refund'),
  depreciation2023: id('charge', 'depreciation-2023'),
  depreciation2024: id('charge', 'depreciation-2024'),
} as const;

export const CATEGORIES = {
  software: id('depreciation-category', 'software-33'),
  customerRelationships: id('depreciation-category', 'customer-relationships-12.5'),
  goodwill: id('depreciation-category', 'goodwill-10'),
  notDepreciated: id('depreciation-category', 'not-depreciated'),
} as const;

/** The depreciation records (assets) */
export const ASSETS = {
  software: id('depreciation', 'software'),
  customerRelationships: id('depreciation', 'customer-relationships'),
  goodwill: id('depreciation', 'goodwill'),
  trademarks: id('depreciation', 'trademarks'),
} as const;

export const REFUNDS = {
  goodwill: id('depreciation-disposal', 'goodwill-refund'),
  software: id('depreciation-disposal', 'software-refund'),
  customerRelationships: id('depreciation-disposal', 'customer-relationships-refund'),
  trademarks: id('depreciation-disposal', 'trademarks-refund'),
} as const;

export const ACQUISITION_DATE = '2023-08-20';
export const PAYMENT_DATE = '2023-08-27';
export const REFUND_DATE = '2024-04-14';

/** USD → ILS */
export const RATES = {
  [ACQUISITION_DATE]: 3.7,
  [PAYMENT_DATE]: 3.68,
  [REFUND_DATE]: 3.65,
} as const;

/** The purchase price allocation, in USD */
export const ALLOCATION_USD = {
  software: 160_000,
  customerRelationships: 200_000,
  goodwill: 60_000,
  trademarks: 40_000,
  acquiredReceivables: 20_000,
} as const;
export const ASSUMED_LIABILITIES_USD = 40_000;
export const PAYMENT_USD = 440_000;

/** The refund, allocated in USD: goodwill first, then pro rata 80 : 100 : 20 */
export const REFUND_USD = {
  goodwill: 60_000,
  software: 16_000,
  customerRelationships: 20_000,
  trademarks: 4000,
} as const;
export const REFUND_TOTAL_USD = 100_000;
export const REFUND_FEE_USD = 20;

const owner = { ownerId: BUYER_ID };
const atMidnight = (date: string) => `${date} 00:00:00`;

const acquisitionMiscExpense = (
  name: keyof typeof ALLOCATION_USD,
  description: string,
): NonNullable<Fixture['miscExpenses']>['expenses'][number] => ({
  id: id('misc-expense', `acquisition-${name}`),
  chargeId: CHARGES.acquisition,
  ...owner,
  amount: String(ALLOCATION_USD[name]),
  currency: Currency.Usd,
  debtorId: ACCOUNTS[name],
  creditorId: BUSINESSES.seller,
  description,
  invoiceDate: ACQUISITION_DATE,
  valueDate: atMidnight(ACQUISITION_DATE),
});

const asset = (
  name: keyof typeof ASSETS,
  categoryId: string,
  type: 'RESEARCH_AND_DEVELOPMENT' | 'GENERAL_AND_MANAGEMENT',
): NonNullable<Fixture['depreciationRecords']>['records'][number] => ({
  id: ASSETS[name],
  // the acquisition charge bought all of the assets, so each names its own cost account: the one
  // its misc expense debits
  chargeId: CHARGES.acquisition,
  assetTaxCategoryId: ACCOUNTS[name],
  ...owner,
  categoryId,
  amount: String(ALLOCATION_USD[name]),
  currency: Currency.Usd,
  activationDate: ACQUISITION_DATE,
  type,
});

/** Everything but the cost refunds */
export const acquisitionCostRefundFixture: Fixture = {
  exchangeRates: {
    rates: Object.entries(RATES).map(([date, usd]) => ({ date, usd })),
  },

  depreciationCategories: {
    categories: [
      { id: CATEGORIES.software, name: 'Software (acquisition refund scenario)', percentage: 33 },
      {
        id: CATEGORIES.customerRelationships,
        name: 'Customer relationships (acquisition refund scenario)',
        percentage: 12.5,
      },
      { id: CATEGORIES.goodwill, name: 'Goodwill (acquisition refund scenario)', percentage: 10 },
      {
        id: CATEGORIES.notDepreciated,
        name: 'Trademarks, not depreciated (acquisition refund scenario)',
        percentage: 0,
      },
    ],
  },

  businesses: {
    businesses: [
      createBusiness({ id: BUYER_ID, name: 'Buyer Ltd. (acquisition refund scenario)', ...owner }),
      createBusiness({
        id: BUSINESSES.seller,
        name: 'Acme Ventures Ltd.',
        country: CountryCode.Israel,
        ...owner,
      }),
      createBusiness({
        id: BUSINESSES.refundSupplier,
        name: 'Globex Services Inc.',
        country: CountryCode['United States of America (the)'],
        ...owner,
      }),
    ],
  },

  taxCategories: {
    taxCategories: (
      [
        ['software', 'Software'],
        ['customerRelationships', 'Customer relationships'],
        ['goodwill', 'Goodwill'],
        ['trademarks', 'Trademarks and domains'],
        ['acquiredReceivables', 'Acquired receivables'],
        ['assumedLiabilities', 'Assumed liabilities'],
        ['accumulatedDepreciation', 'Accumulated depreciation'],
        ['rndDepreciation', 'R&D depreciation expenses'],
        ['gnaDepreciation', 'G&A depreciation expenses'],
        ['marketingDepreciation', 'Marketing depreciation expenses'],
        ['depreciationCorrection', 'Depreciation correction'],
        ['exchangeRates', 'Exchange rates'],
        ['fees', 'Bank fees'],
        ['refundClearing', 'Refund clearing (P)'],
        ['bankUsd', 'USD bank account'],
      ] as const
    ).map(([key, name]) => createTaxCategory({ id: ACCOUNTS[key], name, ...owner })),
  },

  accounts: {
    accounts: [
      createFinancialAccount({
        accountNumber: BANK_ACCOUNT_NUMBER,
        type: 'BANK_ACCOUNT',
        ...owner,
      }),
    ],
  },

  accountTaxCategories: {
    mappings: [
      {
        accountNumber: BANK_ACCOUNT_NUMBER,
        currency: Currency.Usd,
        taxCategoryId: ACCOUNTS.bankUsd,
        ...owner,
      },
    ],
  },

  charges: {
    charges: [
      createCharge(
        { owner_id: BUYER_ID, user_description: 'Acquisition of the activity of Acme Ventures' },
        // entered as misc expenses: the charge itself books nothing to a tax category
        { id: CHARGES.acquisition, type: 'COMMON', tax_category_id: null },
      ),
      createCharge(
        {
          owner_id: BUYER_ID,
          tax_category_id: ACCOUNTS.refundClearing,
          user_description: 'Supplier refund of the acquired activity',
        },
        { id: CHARGES.refund, type: 'COMMON' },
      ),
      createCharge(
        {
          owner_id: BUYER_ID,
          tax_category_id: ACCOUNTS.accumulatedDepreciation,
          user_description: 'Depreciation 2023',
        },
        { id: CHARGES.depreciation2023, type: 'FINANCIAL' },
      ),
      createCharge(
        {
          owner_id: BUYER_ID,
          tax_category_id: ACCOUNTS.accumulatedDepreciation,
          user_description: 'Depreciation 2024',
        },
        { id: CHARGES.depreciation2024, type: 'FINANCIAL' },
      ),
    ],
  },

  transactions: {
    transactions: [
      createTransaction(
        {
          charge_id: CHARGES.acquisition,
          business_id: BUSINESSES.seller,
          amount: String(-PAYMENT_USD),
          currency: Currency.Usd,
          event_date: PAYMENT_DATE,
          owner_id: BUYER_ID,
        },
        {
          id: id('transaction', 'payment'),
          account_id: BANK_ACCOUNT_NUMBER,
          source_description: 'Payment to Acme Ventures',
          debit_date: PAYMENT_DATE,
        },
      ),
      createTransaction(
        {
          charge_id: CHARGES.refund,
          business_id: BUSINESSES.refundSupplier,
          amount: String(REFUND_TOTAL_USD - REFUND_FEE_USD),
          currency: Currency.Usd,
          event_date: REFUND_DATE,
          owner_id: BUYER_ID,
        },
        {
          id: id('transaction', 'refund-receipt'),
          account_id: BANK_ACCOUNT_NUMBER,
          source_description: 'Refund from Globex Services',
          debit_date: REFUND_DATE,
        },
      ),
    ],
  },

  documents: {
    documents: [
      // the supplier's credit note: Dr supplier / Cr P
      createDocument(
        {
          charge_id: CHARGES.refund,
          creditor_id: BUYER_ID,
          debtor_id: BUSINESSES.refundSupplier,
          type: 'CREDIT_INVOICE',
          total_amount: REFUND_TOTAL_USD,
          currency_code: Currency.Usd,
          date: REFUND_DATE,
          owner_id: BUYER_ID,
        },
        { id: id('document', 'credit-note'), serial_number: 'CN-2024-0414' },
      ),
    ],
  },

  miscExpenses: {
    expenses: [
      acquisitionMiscExpense('software', 'PPA: software'),
      acquisitionMiscExpense('customerRelationships', 'PPA: customer relationships'),
      acquisitionMiscExpense('goodwill', 'PPA: goodwill (residual)'),
      acquisitionMiscExpense('trademarks', 'PPA: trademarks and domains'),
      acquisitionMiscExpense('acquiredReceivables', 'PPA: acquired receivables'),
      {
        id: id('misc-expense', 'acquisition-assumed-liabilities'),
        chargeId: CHARGES.acquisition,
        ...owner,
        amount: String(ASSUMED_LIABILITIES_USD),
        currency: Currency.Usd,
        debtorId: BUSINESSES.seller,
        creditorId: ACCOUNTS.assumedLiabilities,
        description: 'Seller liabilities assumed',
        invoiceDate: ACQUISITION_DATE,
        valueDate: atMidnight(ACQUISITION_DATE),
      },
      // the SWIFT fee withheld from the refund
      {
        id: id('misc-expense', 'refund-fee'),
        chargeId: CHARGES.refund,
        ...owner,
        amount: String(REFUND_FEE_USD),
        currency: Currency.Usd,
        debtorId: ACCOUNTS.fees,
        creditorId: BUSINESSES.refundSupplier,
        description: 'SWIFT fee',
        invoiceDate: REFUND_DATE,
        valueDate: atMidnight(REFUND_DATE),
      },
    ],
  },

  depreciationRecords: {
    records: [
      asset('software', CATEGORIES.software, 'RESEARCH_AND_DEVELOPMENT'),
      asset('customerRelationships', CATEGORIES.customerRelationships, 'GENERAL_AND_MANAGEMENT'),
      asset('goodwill', CATEGORIES.goodwill, 'GENERAL_AND_MANAGEMENT'),
      asset('trademarks', CATEGORIES.notDepreciated, 'GENERAL_AND_MANAGEMENT'),
    ],
  },
};

/**
 * The cost refunds, from activation, entered in the assets' currency (USD) on the refund charge, as
 * the API stores them: the USD amount and no local cost, which is converted when read
 */
export const costRefundsFixture: Fixture = {
  depreciationDisposals: {
    disposals: (Object.keys(REFUNDS) as Array<keyof typeof REFUNDS>).map(name => ({
      id: REFUNDS[name],
      ...owner,
      depreciationId: ASSETS[name],
      chargeId: CHARGES.refund,
      type: 'COST_REFUND' as const,
      refundMode: 'FROM_ACTIVATION' as const,
      disposalDate: REFUND_DATE,
      disposedCost: null,
      originalAmount: String(REFUND_USD[name]),
      originalCurrency: Currency.Usd,
      proceeds: '0',
    })),
  },
};

/**
 * The buyer: a business of its own (owner of itself), so its depreciation and reports see only
 * this scenario. Insert it before `acquisitionCostRefundFixture`.
 */
export async function insertBuyer(client: PoolClient): Promise<void> {
  await ensureFinancialEntity(client, {
    id: BUYER_ID,
    name: 'Buyer Ltd. (acquisition refund scenario)',
    type: 'business',
  });
  await ensureBusinessForEntity(client, BUYER_ID, { ownerId: BUYER_ID });
  await client.query(
    `UPDATE ${qualifyTable('financial_entities')} SET owner_id = $1 WHERE id = $1`,
    [BUYER_ID],
  );
}

/**
 * The buyer's admin context: the seeded admin's, with this scenario's accounts for depreciation,
 * exchange rates and fees, and no ledger lock. Insert it after `acquisitionCostRefundFixture`,
 * whose tax categories it points to.
 */
export async function insertBuyerAdminContext(
  client: PoolClient,
  seededAdminId: string,
): Promise<void> {
  const overrides = {
    owner_id: BUYER_ID,
    ledger_lock: null,
    accumulated_depreciation_tax_category_id: ACCOUNTS.accumulatedDepreciation,
    rnd_depreciation_expenses_tax_category_id: ACCOUNTS.rndDepreciation,
    gnm_depreciation_expenses_tax_category_id: ACCOUNTS.gnaDepreciation,
    marketing_depreciation_expenses_tax_category_id: ACCOUNTS.marketingDepreciation,
    depreciation_correction_tax_category_id: ACCOUNTS.depreciationCorrection,
    depreciation_disposal_gain_tax_category_id: null,
    depreciation_disposal_loss_tax_category_id: null,
    exchange_rate_tax_category_id: ACCOUNTS.exchangeRates,
    income_exchange_rate_tax_category_id: ACCOUNTS.exchangeRates,
    fee_tax_category_id: ACCOUNTS.fees,
    general_fee_tax_category_id: ACCOUNTS.fees,
  };
  const result = await client.query(
    `INSERT INTO ${qualifyTable('user_context')}
     SELECT (jsonb_populate_record(NULL::${qualifyTable('user_context')}, to_jsonb(uc) || $2::jsonb)).*
     FROM ${qualifyTable('user_context')} uc
     WHERE uc.owner_id = $1`,
    [seededAdminId, JSON.stringify(overrides)],
  );
  if (result.rowCount !== 1) {
    throw new Error(`No admin context to copy for ${seededAdminId}; seed the admin first`);
  }
}
