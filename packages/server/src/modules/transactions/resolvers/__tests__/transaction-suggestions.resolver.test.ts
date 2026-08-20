import { describe, expect, it, vi } from 'vitest';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { BusinessesProvider } from '../../../financial-entities/providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../../financial-entities/providers/financial-entities.provider.js';
import { SecurityBusinessesProvider } from '../../../foreign-securities/providers/security-businesses.provider.js';
import { TransactionsProvider } from '../../providers/transactions.provider.js';
import { transactionSuggestionsResolvers } from '../transaction-suggestions.resolver.js';

const POALIM_BUSINESS_ID = 'poalim-business';
const SECURITY_BUSINESS_ID = 'security-business';

type TransactionStub = {
  id?: string;
  business_id?: string | null;
  is_fee?: boolean;
  source_description?: string | null;
  source_origin?: string | null;
  amount?: string;
};

function createContext(transaction: TransactionStub, securityKeyOwner: string | null) {
  const securityLookup = vi.fn().mockResolvedValue(
    securityKeyOwner ? { id: securityKeyOwner } : null,
  );

  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: () =>
          Promise.resolve({
            financialAccounts: { poalimBusinessId: POALIM_BUSINESS_ID },
          }),
      },
    ],
    [
      TransactionsProvider,
      {
        transactionByIdLoader: {
          load: () =>
            Promise.resolve({
              id: 't1',
              business_id: null,
              is_fee: false,
              source_origin: 'POALIM',
              amount: '-1000.00',
              ...transaction,
            }),
        },
      },
    ],
    [SecurityBusinessesProvider, { getSecurityBusinessByIdentifierLoader: { load: securityLookup } }],
    // No business carries suggestion phrases in these cases.
    [BusinessesProvider, { getAllBusinesses: () => Promise.resolve([]) }],
    [
      FinancialEntitiesProvider,
      { getFinancialEntityByIdLoader: { load: (id: string) => Promise.resolve({ id }) } },
    ],
  ]);

  return {
    context: {
      injector: { get: (token: unknown) => providers.get(token) },
    },
    securityLookup,
  };
}

const suggest = async (transaction: TransactionStub, securityKeyOwner: string | null = null) => {
  const { context, securityLookup } = createContext(transaction, securityKeyOwner);
  const resolver = transactionSuggestionsResolvers.CommonTransaction!
    .missingInfoSuggestions as unknown as (
    parent: string,
    args: object,
    context: unknown,
    info: unknown,
  ) => Promise<{ business?: { id: string } } | null>;

  const result = await resolver('t1', {}, context, {});
  // The wrapper hands GraphQL a promise for the business; resolve it for the assertions.
  const business = result?.business ? await result.business : null;
  return { result, business, securityLookup };
};

describe('transaction business suggestion — securities', () => {
  it('suggests the security a trade names in its description', async () => {
    const { business, securityLookup } = await suggest(
      { source_description: 'ניע"ז מכירה 0005129523' },
      SECURITY_BUSINESS_ID,
    );

    expect(securityLookup).toHaveBeenCalledWith({
      type: 'POALIM_SECURITY_KEY',
      value: '5129523',
    });
    expect(business).toEqual({ id: SECURITY_BUSINESS_ID });
  });

  it('falls back to Poalim when the key resolves to no security business', async () => {
    // The security exists in the bank's world but has no business yet — the description
    // heuristics still claim it, exactly as before.
    const { business } = await suggest({ source_description: 'ניע"ז קניה 0005129523 FEE' }, null);

    expect(business).toEqual({ id: POALIM_BUSINESS_ID });
  });

  it('does not guess when a description names two securities', async () => {
    const { business, securityLookup } = await suggest(
      { source_description: 'ניע"ז 0005129523 0007654321' },
      SECURITY_BUSINESS_ID,
    );

    expect(securityLookup).not.toHaveBeenCalled();
    expect(business).not.toEqual({ id: SECURITY_BUSINESS_ID });
  });

  it('leaves the fee row to Poalim', async () => {
    const { business, securityLookup } = await suggest(
      { is_fee: true, source_description: 'ניעז עמ׳ תשלום FSEC PYMNT FEE 0005129523' },
      SECURITY_BUSINESS_ID,
    );

    expect(securityLookup).not.toHaveBeenCalled();
    expect(business).toEqual({ id: POALIM_BUSINESS_ID });
  });

  it('suggests nothing once a counterparty is set', async () => {
    const { result } = await suggest(
      { business_id: SECURITY_BUSINESS_ID, source_description: 'ניע"ז מכירה 0005129523' },
      SECURITY_BUSINESS_ID,
    );

    expect(result).toBeNull();
  });
});
