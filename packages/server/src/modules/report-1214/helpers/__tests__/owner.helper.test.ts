import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { describe, expect, it } from 'vitest';
import { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { isActiveReport1214Owner } from '../owner.helper.js';

const OWNER_ID = '6f1d2c3b-0000-4000-8000-00000000abcd';

/** An injector whose `AuthContextProvider` returns `authContext`. */
function injectorWith(authContext: unknown): Injector {
  return {
    get: (token: unknown) => {
      if (token !== AuthContextProvider) {
        throw new Error('unexpected provider');
      }
      return { getAuthContext: async () => authContext };
    },
  } as unknown as Injector;
}

const authContext = (businessId: string | null, scopedIds?: string[]) => ({
  tenant: { businessId },
  activeReadScope: scopedIds ? { businessIds: scopedIds } : null,
});

async function graphQLErrorCode(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(GraphQLError);
  return (error as GraphQLError).extensions.code;
}

describe('isActiveReport1214Owner', () => {
  it('matches the active business regardless of case', async () => {
    expect(
      await isActiveReport1214Owner(injectorWith(authContext(OWNER_ID.toUpperCase())), OWNER_ID),
    ).toBe(true);
    expect(
      await isActiveReport1214Owner(injectorWith(authContext(OWNER_ID)), OWNER_ID.toUpperCase()),
    ).toBe(true);
  });

  it('takes the active business from a single-business read scope', async () => {
    const other = '6f1d2c3b-0000-4000-8000-00000000ffff';
    expect(
      await isActiveReport1214Owner(injectorWith(authContext(other, [OWNER_ID])), OWNER_ID),
    ).toBe(true);
  });

  it('does not match another business', async () => {
    expect(
      await isActiveReport1214Owner(
        injectorWith(authContext('6f1d2c3b-0000-4000-8000-00000000ffff')),
        OWNER_ID,
      ),
    ).toBe(false);
  });

  it('requires authentication', async () => {
    expect(await graphQLErrorCode(isActiveReport1214Owner(injectorWith(null), OWNER_ID))).toBe(
      'UNAUTHENTICATED',
    );
  });

  it('requires an active business', async () => {
    expect(
      await graphQLErrorCode(isActiveReport1214Owner(injectorWith(authContext(null)), OWNER_ID)),
    ).toBe('FORBIDDEN');
  });
});
