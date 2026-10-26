import type { Injector } from 'graphql-modules';
import { describe, expect, it, vi } from 'vitest';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { ForeignSecuritiesProvider } from '../../../foreign-securities/providers/foreign-securities.provider.js';
import { SecurityBusinessesProvider } from '../../../foreign-securities/providers/security-businesses.provider.js';
import { LedgerProvider } from '../../../ledger/providers/ledger.provider.js';
import { MiscExpensesProvider } from '../../../misc-expenses/providers/misc-expenses.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import type { IGetChargesByIdsResult } from '../../types.js';
import { getChargeBusinesses } from '../common.helper.js';

// Synthetic values only — never lifted from a real bank capture.
const OWNER_ID = 'owner-business';
const CHARGE_ID = 'charge-securities';
const FUND_ALPHA = 'business-fund-alpha';
const FUND_BETA = 'business-fund-beta';
const BANK = 'business-bank';
const VENDOR = 'business-vendor';
/** The tenant's general foreign-securities business: a trade whose security was not recognized */
const GENERAL_SECURITIES = 'business-general-securities';

type StubTransaction = {
  id: string;
  business_id: string | null;
  is_fee: boolean;
  amount: string;
  currency: string;
};

function tx(
  id: string,
  businessId: string,
  amount: string,
  overrides: Partial<StubTransaction> = {},
): StubTransaction {
  return { id, business_id: businessId, is_fee: false, amount, currency: 'USD', ...overrides };
}

const charge = {
  id: CHARGE_ID,
  owner_id: OWNER_ID,
  type: 'FOREIGN_SECURITIES',
} as IGetChargesByIdsResult;

/** An execution the charge books directly, as a stock distribution's charge does */
type StubExecution = { owner_id: string; security: string; isin: string | null };

/** Security businesses by identifier: alpha by its Poalim key, beta only by its ISIN */
const IDENTIFIERS: Record<string, string> = {
  'POALIM_SECURITY_KEY:11111111': FUND_ALPHA,
  'ISIN:XS0000000002': FUND_BETA,
};

function makeInjector(transactions: StubTransaction[], linkedExecutions: StubExecution[] = []) {
  const transactionsLoader = vi.fn(async () => transactions);
  const providers = new Map<unknown, unknown>([
    [TransactionsProvider, { transactionsByChargeIDLoader: { load: transactionsLoader } }],
    [
      ForeignSecuritiesProvider,
      { executionsByChargeIdLoader: { load: async () => linkedExecutions } },
    ],
    [DocumentsProvider, { getDocumentsByChargeIdLoader: { load: async () => [] } }],
    [LedgerProvider, { getLedgerRecordsByChargesIdLoader: { load: async () => [] } }],
    [MiscExpensesProvider, { getExpensesByChargeIdLoader: { load: async () => [] } }],
    [
      SecurityBusinessesProvider,
      {
        getAllSecurityBusinessIds: async () => new Set([FUND_ALPHA, FUND_BETA]),
        getSecurityBusinessByIdentifierLoader: {
          load: async ({ type, value }: { type: string; value: string }) => {
            const id = IDENTIFIERS[`${type}:${value}`];
            return id ? { id } : undefined;
          },
        },
      },
    ],
  ]);
  const injector = {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider token: ${String(token)}`);
      }
      return providers.get(token);
    },
  } as unknown as Injector;
  return { injector, transactionsLoader };
}

/** A buy of one fund, plus another fund bought and sold back for the same amount, plus a fee */
const offsettingTransactions = [
  tx('buy-alpha', FUND_ALPHA, '-1000'),
  tx('buy-beta', FUND_BETA, '-1000'),
  tx('sell-beta', FUND_BETA, '1000'),
  tx('fee', BANK, '-12.34', { is_fee: true, currency: 'ILS' }),
];

describe('getChargeBusinesses — securities counterparty', () => {
  it('resolves to the security that moved money when another one cancels out', async () => {
    const { injector } = makeInjector(offsettingTransactions);

    const result = await getChargeBusinesses(charge, injector);

    expect(result.mainBusinessId).toBe(FUND_ALPHA);
    expect(result.mainBusinessIds).toEqual([FUND_ALPHA]);
    expect(result.offsettingBusinessIds).toEqual([FUND_BETA]);
    expect(result.spansSeveralSecurities).toBe(false);
    // every party is still listed, so filters and the charge type see the whole charge
    expect(result.allBusinessIds.sort()).toEqual([BANK, FUND_ALPHA, FUND_BETA].sort());
  });

  it('keeps every candidate when the charge truly spans several securities', async () => {
    const { injector } = makeInjector([
      tx('sell-alpha', FUND_ALPHA, '1000'),
      tx('buy-beta', FUND_BETA, '-1000'),
    ]);

    const result = await getChargeBusinesses(charge, injector);

    expect(result.mainBusinessId).toBeNull();
    expect(result.mainBusinessIds).toEqual([FUND_ALPHA, FUND_BETA]);
    expect(result.offsettingBusinessIds).toEqual([]);
    expect(result.spansSeveralSecurities).toBe(true);
  });

  it('keeps a charge of just a buy and its reversal on that security', async () => {
    const { injector } = makeInjector([
      tx('buy-alpha', FUND_ALPHA, '-1000'),
      tx('reverse-alpha', FUND_ALPHA, '1000'),
      tx('fee', BANK, '-12.34', { is_fee: true, currency: 'ILS' }),
    ]);

    const result = await getChargeBusinesses(charge, injector);

    expect(result.mainBusinessId).toBe(FUND_ALPHA);
    expect(result.offsettingBusinessIds).toEqual([]);
  });

  it('does not drop a reversed security in favour of a candidate that is not a security', async () => {
    const { injector } = makeInjector([
      tx('buy-alpha', FUND_ALPHA, '-1000'),
      tx('reverse-alpha', FUND_ALPHA, '1000'),
      // a bank row not flagged as a fee
      tx('bank', BANK, '-20'),
    ]);

    const result = await getChargeBusinesses(charge, injector);

    expect(result.mainBusinessId).toBeNull();
    expect(result.mainBusinessIds).toEqual([FUND_ALPHA, BANK]);
    expect(result.offsettingBusinessIds).toEqual([]);
  });

  it('marks nothing as offsetting when every security cancels out', async () => {
    const { injector } = makeInjector([
      tx('buy-alpha', FUND_ALPHA, '-1000'),
      tx('sell-alpha', FUND_ALPHA, '1000'),
      tx('buy-beta', FUND_BETA, '-500'),
      tx('sell-beta', FUND_BETA, '500'),
    ]);

    const result = await getChargeBusinesses(charge, injector);

    expect(result.mainBusinessIds).toEqual([FUND_ALPHA, FUND_BETA]);
    expect(result.offsettingBusinessIds).toEqual([]);
  });

  it('does not treat the general securities business as a security', async () => {
    // an unrecognized trade is a gap to surface, not a security to settle on
    const { injector } = makeInjector([
      tx('buy-alpha', FUND_ALPHA, '-1000'),
      tx('buy-unknown', GENERAL_SECURITIES, '-1000'),
      tx('sell-unknown', GENERAL_SECURITIES, '1000'),
    ]);

    const result = await getChargeBusinesses(charge, injector);

    expect(result.mainBusinessId).toBeNull();
    expect(result.mainBusinessIds).toEqual([FUND_ALPHA, GENERAL_SECURITIES]);
    expect(result.offsettingBusinessIds).toEqual([]);
    expect(result.spansSeveralSecurities).toBe(false);
  });

  it('leaves charges with no securities candidate as they are', async () => {
    const { injector } = makeInjector([
      tx('pay-vendor', VENDOR, '-1000'),
      tx('refund-bank', BANK, '-20'),
      tx('rebook-bank', BANK, '20'),
    ]);

    const result = await getChargeBusinesses(charge, injector);

    expect(result.mainBusinessId).toBeNull();
    expect(result.mainBusinessIds).toEqual([VENDOR, BANK]);
  });

  describe('stock distributions booked directly', () => {
    it("takes the distributed security's business as the counterparty", async () => {
      const { injector } = makeInjector(
        [],
        [{ owner_id: OWNER_ID, security: '11111111', isin: 'XS0000000001' }],
      );

      const result = await getChargeBusinesses(charge, injector);

      expect(result.mainBusinessId).toBe(FUND_ALPHA);
      expect(result.allBusinessIds).toEqual([FUND_ALPHA]);
    });

    it('falls back to the ISIN, and ignores a merged-in commission fee', async () => {
      const { injector } = makeInjector(
        [tx('commission', BANK, '-5', { is_fee: true })],
        [{ owner_id: OWNER_ID, security: '22222222', isin: 'XS0000000002' }],
      );

      const result = await getChargeBusinesses(charge, injector);

      expect(result.mainBusinessId).toBe(FUND_BETA);
    });

    it("adds nothing for another owner's execution or a security with no business", async () => {
      const { injector } = makeInjector(
        [],
        [
          { owner_id: 'another-owner', security: '11111111', isin: null },
          { owner_id: OWNER_ID, security: '99999999', isin: null },
        ],
      );

      const result = await getChargeBusinesses(charge, injector);

      expect(result.mainBusinessId).toBeNull();
      expect(result.allBusinessIds).toEqual([]);
    });

    it('does not look executions up for a charge not typed as foreign securities', async () => {
      const { injector } = makeInjector(
        [tx('pay-vendor', VENDOR, '-100')],
        [{ owner_id: OWNER_ID, security: '11111111', isin: null }],
      );

      const result = await getChargeBusinesses(
        { ...charge, type: 'COMMON' } as IGetChargesByIdsResult,
        injector,
      );

      expect(result.mainBusinessId).toBe(VENDOR);
    });

    it('resolves an enriched distribution row the SQL found no party for', async () => {
      const { injector } = makeInjector(
        [],
        [{ owner_id: OWNER_ID, security: '11111111', isin: null }],
      );
      const row = {
        ...charge,
        abs_event_amount: '0',
        business_array: [],
        main_business_array: [],
        business_id: null,
      } as unknown as IGetChargesByIdsResult;

      const result = await getChargeBusinesses(row, injector);

      expect(result.mainBusinessId).toBe(FUND_ALPHA);
      expect(result.allBusinessIds).toEqual([FUND_ALPHA]);
    });
  });

  describe('rows enriched by getChargesByFilters', () => {
    function enriched(mainBusinessArray: string[], businessId: string | null) {
      return {
        ...charge,
        abs_event_amount: '1000',
        business_array: [...mainBusinessArray, BANK],
        main_business_array: mainBusinessArray,
        business_id: businessId,
      } as unknown as IGetChargesByIdsResult;
    }

    it('applies the same narrowing to an ambiguous securities row', async () => {
      const { injector } = makeInjector(offsettingTransactions);

      const result = await getChargeBusinesses(enriched([FUND_ALPHA, FUND_BETA], null), injector);

      expect(result.mainBusinessId).toBe(FUND_ALPHA);
      expect(result.mainBusinessIds).toEqual([FUND_ALPHA]);
    });

    it('loads no transactions for a row with a single counterparty', async () => {
      const { injector, transactionsLoader } = makeInjector(offsettingTransactions);

      const result = await getChargeBusinesses(enriched([FUND_ALPHA], FUND_ALPHA), injector);

      expect(result.mainBusinessId).toBe(FUND_ALPHA);
      expect(transactionsLoader).not.toHaveBeenCalled();
    });

    it('loads no transactions when no candidate is a security', async () => {
      const { injector, transactionsLoader } = makeInjector([]);

      const result = await getChargeBusinesses(enriched([VENDOR, BANK], null), injector);

      expect(result.mainBusinessId).toBeNull();
      expect(result.mainBusinessIds).toEqual([VENDOR, BANK]);
      expect(transactionsLoader).not.toHaveBeenCalled();
    });
  });
});
