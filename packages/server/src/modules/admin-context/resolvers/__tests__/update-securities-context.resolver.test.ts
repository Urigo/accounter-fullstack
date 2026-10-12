import { describe, expect, it, vi } from 'vitest';
import type { Injector } from 'graphql-modules';
import { TaxCategoriesProvider } from '../../../financial-entities/providers/tax-categories.provider.js';
import { SortCodesProvider } from '../../../sort-codes/providers/sort-codes.provider.js';
import { AdminContextProvider } from '../../providers/admin-context.provider.js';
import { adminContextResolvers } from '../admin-context.resolvers.js';

/*
 * `updateSecuritiesContext` stores ids in jsonb, which carries no foreign keys, so the resolver is
 * where a tax category is checked to belong to the business being configured. All ids are made up.
 */

const OWNER_ID = 'owner-business';
const OTHER_OWNER_ID = 'other-business-in-scope';
const OWN_TAX_CATEGORY_ID = '0190a1b2-0000-7000-8000-000000000001';
const OTHER_OWNERS_TAX_CATEGORY_ID = '0190a1b2-0000-7000-8000-000000000002';

function makeInjector() {
  const adminContextProvider = {
    getVerifiedAdminContext: vi.fn(async () => ({ ownerId: OWNER_ID })),
    updateSecuritiesContext: vi.fn(async () => ({
      ownerId: OWNER_ID,
      foreignSecurities: { sortCode: 990, taxCategories: {} },
    })),
  };
  const taxCategories = new Map([
    [OWN_TAX_CATEGORY_ID, { id: OWN_TAX_CATEGORY_ID, owner_id: OWNER_ID }],
    // visible to the request through a multi-business read scope, but another business's
    [OTHER_OWNERS_TAX_CATEGORY_ID, { id: OTHER_OWNERS_TAX_CATEGORY_ID, owner_id: OTHER_OWNER_ID }],
  ]);
  const providers = new Map<unknown, unknown>([
    [AdminContextProvider, adminContextProvider],
    [
      TaxCategoriesProvider,
      { taxCategoryByIdLoader: { load: async (id: string) => taxCategories.get(id) } },
    ],
    [
      SortCodesProvider,
      {
        getSortCodesByIdLoader: {
          load: async ({ key }: { key: number }) => (key === 990 ? { key } : undefined),
        },
      },
    ],
  ]);
  const injector = { get: (token: unknown) => providers.get(token) } as unknown as Injector;
  return { injector, adminContextProvider };
}

const updateSecuritiesContext = (
  injector: Injector,
  input: { sortCode?: number | null; taxCategories?: { key: string; taxCategoryId: string | null }[] },
) =>
  (
    adminContextResolvers.Mutation!.updateSecuritiesContext as unknown as (
      parent: unknown,
      args: unknown,
      context: unknown,
    ) => Promise<unknown>
  )({}, { input }, { injector });

describe('Mutation.updateSecuritiesContext', () => {
  it("stores one of the business's own tax categories and a known sort code", async () => {
    const { injector, adminContextProvider } = makeInjector();

    await updateSecuritiesContext(injector, {
      sortCode: 990,
      taxCategories: [{ key: 'FOREIGN_DIVIDEND_INCOME', taxCategoryId: OWN_TAX_CATEGORY_ID }],
    });

    expect(adminContextProvider.updateSecuritiesContext).toHaveBeenCalledWith({
      sortCode: 990,
      taxCategories: [{ key: 'FOREIGN_DIVIDEND_INCOME', taxCategoryId: OWN_TAX_CATEGORY_ID }],
    });
  });

  it("refuses another business's tax category, even when the request can read it", async () => {
    const { injector, adminContextProvider } = makeInjector();

    await expect(
      updateSecuritiesContext(injector, {
        taxCategories: [
          { key: 'FOREIGN_DIVIDEND_INCOME', taxCategoryId: OTHER_OWNERS_TAX_CATEGORY_ID },
        ],
      }),
    ).rejects.toThrow('Tax category not found in this business: Foreign dividend income');
    expect(adminContextProvider.updateSecuritiesContext).not.toHaveBeenCalled();
  });

  it('refuses an unknown sort code', async () => {
    const { injector, adminContextProvider } = makeInjector();

    await expect(updateSecuritiesContext(injector, { sortCode: 123 })).rejects.toThrow(
      'Sort code 123 not found',
    );
    expect(adminContextProvider.updateSecuritiesContext).not.toHaveBeenCalled();
  });

  it('clears an assignment without looking anything up', async () => {
    const { injector, adminContextProvider } = makeInjector();

    await updateSecuritiesContext(injector, {
      taxCategories: [{ key: 'DIVIDEND_WITHHOLDING_TAX', taxCategoryId: null }],
    });

    expect(adminContextProvider.updateSecuritiesContext).toHaveBeenCalledWith({
      taxCategories: [{ key: 'DIVIDEND_WITHHOLDING_TAX', taxCategoryId: null }],
    });
  });
});
