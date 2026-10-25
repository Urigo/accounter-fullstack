import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargeTypeEnum, MissingChargeInfo } from '../../../../shared/enums.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { BusinessesProvider } from '../../../financial-entities/providers/businesses.provider.js';
import { SecurityExecutionChargesProvider } from '../../../foreign-securities/providers/security-execution-charges.provider.js';
import { ChargeTagsProvider } from '../../../tags/providers/charge-tags.provider.js';
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

// Synthetic values only — never lifted from a real bank capture.
const FUND_ALPHA = 'business-fund-alpha';
const FUND_BETA = 'business-fund-beta';
const BANK = 'business-bank';

const charge = {
  id: 'charge-securities',
  owner_id: 'owner-business',
  type: 'FOREIGN_SECURITIES',
  user_description: 'Securities',
} as IGetChargesByIdsResult;

function makeInjector() {
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

describe('validateCharge — securities counterparty', () => {
  beforeEach(() => {
    vi.mocked(getChargeType).mockResolvedValue(ChargeTypeEnum.ForeignSecurities);
  });

  it('accepts a charge spanning several securities without a single counterparty', async () => {
    vi.mocked(getChargeBusinesses).mockResolvedValue({
      allBusinessIds: [FUND_ALPHA, FUND_BETA],
      mainBusinessIds: [FUND_ALPHA, FUND_BETA],
      offsettingBusinessIds: [],
      spansSeveralSecurities: true,
      mainBusinessId: null,
    });

    const { missingInfo } = await validateCharge(charge, makeInjector());

    expect(missingInfo).not.toContain(MissingChargeInfo.Counterparty);
  });

  it('still flags candidates that are not all securities', async () => {
    vi.mocked(getChargeBusinesses).mockResolvedValue({
      allBusinessIds: [FUND_ALPHA, BANK],
      mainBusinessIds: [FUND_ALPHA, BANK],
      offsettingBusinessIds: [],
      spansSeveralSecurities: false,
      mainBusinessId: null,
    });

    const { missingInfo } = await validateCharge(charge, makeInjector());

    expect(missingInfo).toContain(MissingChargeInfo.Counterparty);
  });

  it('does not waive the counterparty on other charge types', async () => {
    vi.mocked(getChargeType).mockResolvedValue(ChargeTypeEnum.Common);
    vi.mocked(getChargeBusinesses).mockResolvedValue({
      allBusinessIds: [FUND_ALPHA, FUND_BETA],
      mainBusinessIds: [FUND_ALPHA, FUND_BETA],
      offsettingBusinessIds: [],
      spansSeveralSecurities: true,
      mainBusinessId: null,
    });

    const { missingInfo } = await validateCharge(charge, makeInjector());

    expect(missingInfo).toContain(MissingChargeInfo.Counterparty);
  });
});
