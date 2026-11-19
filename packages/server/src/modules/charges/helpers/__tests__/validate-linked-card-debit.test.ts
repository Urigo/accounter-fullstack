import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargeTypeEnum, MissingChargeInfo } from '../../../../shared/enums.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { BusinessesProvider } from '../../../financial-entities/providers/businesses.provider.js';
import { SecurityExecutionChargesProvider } from '../../../foreign-securities/providers/security-execution-charges.provider.js';
import { ChargeTagsProvider } from '../../../tags/providers/charge-tags.provider.js';
import { CreditCardStatementsProvider } from '../../../transactions/providers/creditcard-statements.provider.js';
import type { IGetChargesByIdsResult } from '../../types.js';
import { getChargeType } from '../charge-type.js';
import { getChargeBusinesses } from '../common.helper.js';
import { validateCharge } from '../validate.helper.js';

vi.mock('../charge-type.js', () => ({ getChargeType: vi.fn() }));
vi.mock('../common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../common.helper.js')>()),
  getChargeBusinesses: vi.fn(),
  getChargeTaxCategoryId: vi.fn(async () => null),
  getChargeTransactionsMeta: vi.fn(async () => ({ invalidTransactions: false, transactionsCount: 2 })),
  getChargeDocumentsMeta: vi.fn(async () => ({
    documentsVatAmount: null,
    invoiceCount: 0,
    receiptCount: 0,
  })),
}));

// Synthetic values only
const charge = {
  id: 'charge-card-debit',
  owner_id: 'owner-business',
  type: null,
  user_description: 'Card debit',
} as IGetChargesByIdsResult;

function makeInjector(linked: boolean) {
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          general: { taxCategories: { generalFeeTaxCategoryId: 'tax-category-fees' } },
          foreignSecurities: { foreignSecuritiesBusinessId: null },
          locality: 'ISR',
        }),
      },
    ],
    [
      SecurityExecutionChargesProvider,
      { linkedExecutionIdsByChargeIdLoader: { load: async () => [] } },
    ],
    [
      BusinessesProvider,
      { getBusinessByIdLoader: { load: async (id: string) => ({ id, country: 'USA' }) } },
    ],
    [DocumentsProvider, { getDocumentsByChargeIdLoader: { load: async () => [] } }],
    [ChargeTagsProvider, { getTagsByChargeIDLoader: { load: async () => [{ id: 'tag' }] } }],
    [CreditCardStatementsProvider, { hasLinksByChargeIdLoader: { load: async () => linked } }],
  ]);
  // a fresh injector per test, since validation is memoized per injector
  return {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider token: ${String(token)}`);
      }
      return providers.get(token);
    },
  } as unknown as Injector;
}

describe('validateCharge — card debits', () => {
  beforeEach(() => {
    vi.mocked(getChargeType).mockResolvedValue(ChargeTypeEnum.CreditcardBankCharge);
    vi.mocked(getChargeBusinesses).mockResolvedValue({
      allBusinessIds: [],
      mainBusinessIds: [],
      offsettingBusinessIds: [],
      spansSeveralSecurities: false,
      mainBusinessId: null,
    });
  });

  it('needs neither a counterparty nor a tax category for a debit linked to its statements', async () => {
    const { isValid, missingInfo } = await validateCharge(charge, makeInjector(true));

    expect(missingInfo).toEqual([]);
    expect(isValid).toBe(true);
  });

  it('still requires them for an unlinked card debit', async () => {
    const { missingInfo } = await validateCharge(charge, makeInjector(false));

    expect(missingInfo).toContain(MissingChargeInfo.Counterparty);
    expect(missingInfo).toContain(MissingChargeInfo.TaxCategory);
  });

  it('does not waive them for other charge types', async () => {
    vi.mocked(getChargeType).mockResolvedValue(ChargeTypeEnum.Common);

    const { missingInfo } = await validateCharge(charge, makeInjector(true));

    expect(missingInfo).toContain(MissingChargeInfo.Counterparty);
    expect(missingInfo).toContain(MissingChargeInfo.TaxCategory);
  });
});
