import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getChargeBusinesses } from '../../../charges/helpers/common.helper.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import { SecurityBusinessesProvider } from '../../providers/security-businesses.provider.js';
import type { ChargeSecurityProto } from '../../types.js';
import { foreignSecuritiesResolvers } from '../foreign-securities.resolver.js';

vi.mock('../../../charges/helpers/common.helper.js', () => ({
  getChargeBusinesses: vi.fn(),
}));

// Synthetic values only — never lifted from a real bank capture.
const CHARGE_ID = 'charge-securities';
const OWNER_ID = 'owner-business';
const FUND_ALPHA = 'business-fund-alpha';
const GENERAL_SECURITIES = 'business-general-securities';
const ALPHA_KEY = '11111111';

function security(securityKey: string): ChargeSecurityProto {
  return {
    id: `${CHARGE_ID}-${securityKey}`,
    chargeId: CHARGE_ID,
    ownerId: OWNER_ID,
    securityKey,
    details: null,
    transactionIds: [],
    executions: [],
  };
}

/**
 * The fund is bought and sold back. A third trade carries the fund's key in its description but
 * is booked to the general securities business — the key and the business disagree about it.
 */
const transactions = [
  { id: 'buy-alpha', business_id: FUND_ALPHA, is_fee: false, amount: '-1000', currency: 'USD' },
  { id: 'sell-alpha', business_id: FUND_ALPHA, is_fee: false, amount: '1000', currency: 'USD' },
  {
    id: 'unrecognized',
    business_id: GENERAL_SECURITIES,
    is_fee: false,
    amount: '-250',
    currency: 'USD',
  },
];

const injector = {
  get: (token: unknown) => {
    if (token === SecurityBusinessesProvider) {
      return {
        getSecurityBusinessByIdentifierLoader: {
          load: async ({ value }: { value: string }) =>
            value === ALPHA_KEY ? { id: FUND_ALPHA } : undefined,
        },
      };
    }
    if (token === TransactionsProvider) {
      return { transactionsByChargeIDLoader: { load: async () => transactions } };
    }
    throw new Error(`Unexpected provider token: ${String(token)}`);
  },
} as unknown as Injector;

const { netAmount, isOffsetting } = foreignSecuritiesResolvers.ChargeSecurity as unknown as {
  netAmount: (
    parent: ChargeSecurityProto,
    args: object,
    context: { injector: Injector },
  ) => Promise<{ raw: number; currency: string } | null>;
  isOffsetting: (
    parent: ChargeSecurityProto,
    args: object,
    context: { injector: Injector },
  ) => Promise<boolean>;
};

describe('ChargeSecurity net amount and offsetting', () => {
  beforeEach(() => {
    vi.mocked(getChargeBusinesses).mockResolvedValue({
      allBusinessIds: [FUND_ALPHA, GENERAL_SECURITIES],
      mainBusinessIds: [GENERAL_SECURITIES],
      offsettingBusinessIds: [FUND_ALPHA],
      spansSeveralSecurities: false,
      mainBusinessId: GENERAL_SECURITIES,
    });
  });

  it("nets the security's business, the grouping the counterparty is narrowed by", async () => {
    const amount = await netAmount(security(ALPHA_KEY), {}, { injector });

    // the trade booked to the general business is not counted, although it carries the key
    expect(amount).toMatchObject({ raw: 0, currency: 'USD' });
  });

  it('is offsetting exactly when the charge left the security out of its counterparties', async () => {
    expect(await isOffsetting(security(ALPHA_KEY), {}, { injector })).toBe(true);

    vi.mocked(getChargeBusinesses).mockResolvedValue({
      allBusinessIds: [FUND_ALPHA],
      mainBusinessIds: [FUND_ALPHA],
      offsettingBusinessIds: [],
      spansSeveralSecurities: false,
      mainBusinessId: FUND_ALPHA,
    });
    expect(await isOffsetting(security(ALPHA_KEY), {}, { injector })).toBe(false);
  });

  it('has no net amount and never offsets without a security business', async () => {
    expect(await netAmount(security('22222222'), {}, { injector })).toBeNull();
    expect(await isOffsetting(security('22222222'), {}, { injector })).toBe(false);
  });
});
