import { gql } from 'urql';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ChargesListQuery = gql`
  query TenancyTestChargesList {
    allCharges {
      nodes {
        id
        __typename
        userDescription
      }
    }
  }
`;

describe('normalized cache and business scope', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not serve one scope's cached charges to another", async () => {
    const requests: Array<{ scope: string | null }> = [];
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      const scope = headers.get('x-business-scope');
      requests.push({ scope });
      const payload = JSON.stringify({
        data: {
          allCharges: {
            __typename: 'PaginatedCharges',
            nodes: [
              { __typename: 'CommonCharge', id: 'c1', userDescription: `seen by ${scope ?? 'all'}` },
            ],
          },
        },
      });
      return {
        status: 200,
        ok: true,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        text: async () => payload,
        json: async () => JSON.parse(payload),
      } as unknown as Response;
    });

    const urql = await import('../providers/urql.js');
    urql.resetUrqlClient();
    // The scope header rides along with the bearer token.
    urql.setUrqlAccessTokenProvider(async () => 'token-123');
    urql.setBusinessScope(['business-a']);

    const read = () =>
      urql
        .getUrqlClient()
        .query(ChargesListQuery, {}, { requestPolicy: 'cache-first' })
        .toPromise()
        .then(result => result.data?.allCharges.nodes[0]?.userDescription);

    expect(await read()).toBe('seen by business-a');
    // A cache hit within the scope: no second request.
    expect(await read()).toBe('seen by business-a');
    expect(requests).toHaveLength(1);

    urql.setBusinessScope(['business-b']);

    expect(await read()).toBe('seen by business-b');
    expect(requests).toEqual([{ scope: 'business-a' }, { scope: 'business-b' }]);

    urql.setBusinessScope([]);
    urql.setUrqlAccessTokenProvider(null);
  });
});
