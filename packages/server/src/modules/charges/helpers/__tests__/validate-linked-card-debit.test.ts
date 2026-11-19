import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChargeTypeEnum, MissingChargeInfo } from '../../../../shared/enums.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DocumentsProvider } from '../../../documents/providers/documents.provider.js';
import { BusinessesProvider } from '../../../financial-entities/providers/businesses.provider.js';
import { SecurityExecutionChargesProvider } from '../../../foreign-securities/providers/security-execution-charges.provider.js';
import { ChargeTagsProvider } from '../../../tags/providers/charge-tags.provider.js';
import { CreditCardStatementsProvider } from '../../../transactions/providers/creditcard-statements.provider.js';
import { TransactionsProvider } from '../../../transactions/providers/transactions.provider.js';
import type { IGetChargesByIdsResult } from '../../types.js';
import { getChargeType } from '../charge-type.js';
import { getChargeBusinesses } from '../common.helper.js';
import { validateCharge } from '../validate.helper.js';

// Only the charge's type, businesses and tax category are stubbed: the transactions and documents
// checks run on the stubbed providers' rows
vi.mock('../charge-type.js', () => ({ getChargeType: vi.fn() }));
vi.mock('../common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../common.helper.js')>()),
  getChargeBusinesses: vi.fn(),
  getChargeTaxCategoryId: vi.fn(async () => null),
}));

// Synthetic values only
const ISSUER = 'business-card-issuer';

const charge = {
  id: 'charge-card-debit',
  owner_id: 'owner-business',
  type: null,
  user_description: 'Card debit',
} as IGetChargesByIdsResult;

function bankDebit(businessId: string | null) {
  return {
    id: 'bank-debit',
    charge_id: charge.id,
    owner_id: charge.owner_id,
    account_id: 'account-bank',
    amount: '-100',
    currency: 'ILS',
    business_id: businessId,
    debit_date: '2026-03-10',
    debit_date_override: null,
    debit_timestamp: null,
    event_date: '2026-03-10',
    is_fee: false,
  };
}

function makeInjector(options: {
  linked: boolean;
  businessId?: string | null;
  documents?: { id: string; type: string }[];
}) {
  const providers = new Map<unknown, unknown>([
    [
      AdminContextProvider,
      {
        getVerifiedAdminContext: async () => ({
          general: { taxCategories: { generalFeeTaxCategoryId: 'tax-category-fees' } },
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
      { getBusinessByIdLoader: { load: async (id: string) => ({ id, country: 'ISR' }) } },
    ],
    [
      TransactionsProvider,
      {
        transactionsByChargeIDLoader: {
          load: async () => [
            bankDebit(options.businessId === undefined ? ISSUER : options.businessId),
          ],
        },
      },
    ],
    [
      DocumentsProvider,
      { getDocumentsByChargeIdLoader: { load: async () => options.documents ?? [] } },
    ],
    [ChargeTagsProvider, { getTagsByChargeIDLoader: { load: async () => [{ id: 'tag' }] } }],
    [
      CreditCardStatementsProvider,
      { hasLinksByChargeIdLoader: { load: async () => options.linked } },
    ],
  ]);
  return {
    get: (token: unknown) => {
      if (!providers.has(token)) {
        throw new Error(`Unexpected provider token: ${String(token)}`);
      }
      return providers.get(token);
    },
  } as unknown as Injector;
}

function withMainBusiness(mainBusinessId: string | null) {
  vi.mocked(getChargeBusinesses).mockResolvedValue({
    allBusinessIds: mainBusinessId ? [mainBusinessId] : [],
    mainBusinessIds: mainBusinessId ? [mainBusinessId] : [],
    offsettingBusinessIds: [],
    spansSeveralSecurities: false,
    mainBusinessId,
  });
}

describe('validateCharge — card debits', () => {
  beforeEach(() => {
    vi.mocked(getChargeType).mockResolvedValue(ChargeTypeEnum.CreditcardBankCharge);
    withMainBusiness(ISSUER);
  });

  it('needs no tax category for a linked debit without relevant documents', async () => {
    const { isValid, missingInfo } = await validateCharge(charge, makeInjector({ linked: true }));

    expect(missingInfo).toEqual([]);
    expect(isValid).toBe(true);
  });

  it('still requires a counterparty on a linked debit', async () => {
    withMainBusiness(null);

    const { missingInfo } = await validateCharge(
      charge,
      makeInjector({ linked: true, businessId: null }),
    );

    expect(missingInfo).toContain(MissingChargeInfo.Counterparty);
    expect(missingInfo).toContain(MissingChargeInfo.Transactions);
    expect(missingInfo).not.toContain(MissingChargeInfo.TaxCategory);
  });

  it('requires a tax category for a linked debit with relevant documents', async () => {
    const { missingInfo } = await validateCharge(
      charge,
      makeInjector({ linked: true, documents: [{ id: 'invoice', type: 'INVOICE' }] }),
    );

    expect(missingInfo).toContain(MissingChargeInfo.TaxCategory);
  });

  it('requires a tax category for an unlinked card debit', async () => {
    const { missingInfo } = await validateCharge(charge, makeInjector({ linked: false }));

    expect(missingInfo).toEqual([MissingChargeInfo.TaxCategory]);
  });

  it('does not waive the tax category for other charge types', async () => {
    vi.mocked(getChargeType).mockResolvedValue(ChargeTypeEnum.Common);

    const { missingInfo } = await validateCharge(charge, makeInjector({ linked: true }));

    expect(missingInfo).toContain(MissingChargeInfo.TaxCategory);
  });
});
