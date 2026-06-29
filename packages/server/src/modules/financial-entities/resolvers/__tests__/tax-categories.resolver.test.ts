import { describe, expect, it, vi } from 'vitest';
import { taxCategoriesResolvers } from '../tax-categories.resolver.js';

type FieldResolver = (parent: unknown, args: unknown, context: unknown) => unknown;

function buildContext(loadResult: unknown) {
  const load = vi.fn().mockResolvedValue(loadResult);
  const injector = {
    get: vi.fn().mockReturnValue({
      taxCategoryByBusinessIDsLoader: { load },
    }),
  };
  return { context: { injector }, load };
}

describe('LtdFinancialEntity.taxCategory resolver', () => {
  const resolver = (taxCategoriesResolvers.LtdFinancialEntity as Record<string, FieldResolver>)
    .taxCategory;

  it('returns the matched tax category', async () => {
    const taxCategory = { id: 'tc-1', name: 'Income' };
    const { context } = buildContext(taxCategory);

    await expect(resolver({ id: 'business-1' }, {}, context)).resolves.toBe(taxCategory);
  });

  it('returns null when the business has no tax category', async () => {
    const { context } = buildContext(undefined);

    await expect(resolver({ id: 'business-1' }, {}, context)).resolves.toBeNull();
  });
});
