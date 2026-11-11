import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { describe, expect, it } from 'vitest';
import { BusinessesProvider } from '../../providers/businesses.provider.js';
import { businessesResolvers } from '../businesses.resolver.js';

const MISSING_ID = 'aa000000-0000-4000-8000-000000000404';

function makeInjector(business: unknown) {
  const providers = new Map<unknown, unknown>([
    [BusinessesProvider, { getBusinessByIdLoader: { load: async () => business } }],
  ]);
  return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
}

/** The generated resolver type is a function or a `{ resolve }` object; unwrap whichever it is */
function businessQuery(id: string, injector: Injector): Promise<unknown> {
  const resolver = businessesResolvers.Query?.business as unknown;
  const resolve = typeof resolver === 'function' ? resolver : (resolver as { resolve: unknown }).resolve;
  return (resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => Promise<unknown>)(
    {},
    { id },
    { injector },
    {},
  );
}

describe('Query.business', () => {
  it('returns NOT_FOUND for a missing business, not a masked server error', async () => {
    const error = await businessQuery(MISSING_ID, makeInjector(undefined)).catch(
      (error: unknown) => error,
    );

    expect(error).toBeInstanceOf(GraphQLError);
    expect((error as GraphQLError).extensions['code']).toBe('NOT_FOUND');
  });

  it('returns the business when it exists', async () => {
    const business = { id: MISSING_ID, name: 'Some Business' };

    await expect(businessQuery(MISSING_ID, makeInjector(business))).resolves.toBe(business);
  });
});
