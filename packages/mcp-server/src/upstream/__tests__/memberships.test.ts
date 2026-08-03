import { describe, expect, it, vi } from 'vitest';
import { UpstreamError, type UpstreamGraphQLClient } from '../graphql-client.js';
import { createUpstreamMembershipSource, MY_MEMBERSHIPS_QUERY } from '../memberships.js';

const PRINCIPAL = {
  subject: 'user-1',
  issuer: 'https://tenant.auth0.com/',
  audience: 'aud',
  scopes: [],
  email: null,
  expiresAt: undefined,
  claims: { sub: 'user-1' },
};

function fakeClient(query: ReturnType<typeof vi.fn>): UpstreamGraphQLClient {
  return { query } as unknown as UpstreamGraphQLClient;
}

describe('createUpstreamMembershipSource', () => {
  it('maps myMemberships rows to the internal membership shape', async () => {
    const query = vi.fn().mockResolvedValue({
      myMemberships: [
        { businessId: 'b1', roleId: 'business_owner', businessName: 'Acme' },
        { businessId: 'b2', roleId: 'accountant', businessName: null },
      ],
    });
    const source = createUpstreamMembershipSource({
      client: fakeClient(query),
      authorization: 'Bearer forwarded-token',
      correlationId: 'corr-1',
    });

    const memberships = await source(PRINCIPAL);

    // businessName is carried through for `accounter_list_business_memberships`. A null
    // name maps to `undefined` (i.e. "no name"), never dropping the membership.
    expect(memberships).toEqual([
      { businessId: 'b1', roleId: 'business_owner', businessName: 'Acme' },
      { businessId: 'b2', roleId: 'accountant', businessName: undefined },
    ]);
  });

  it('forwards the authorization header and correlation id, and issues myMemberships', async () => {
    const query = vi.fn().mockResolvedValue({ myMemberships: [] });
    const source = createUpstreamMembershipSource({
      client: fakeClient(query),
      authorization: 'Bearer forwarded-token',
      correlationId: 'corr-1',
    });

    await source(PRINCIPAL);

    expect(query).toHaveBeenCalledTimes(1);
    const [request, context] = query.mock.calls[0];
    expect(request.query).toBe(MY_MEMBERSHIPS_QUERY);
    expect(context).toEqual({ correlationId: 'corr-1', authorization: 'Bearer forwarded-token' });
  });

  it('maps an empty server result to an empty list', async () => {
    const query = vi.fn().mockResolvedValue({ myMemberships: [] });
    const source = createUpstreamMembershipSource({
      client: fakeClient(query),
      correlationId: 'corr-1',
    });

    await expect(source(PRINCIPAL)).resolves.toEqual([]);
  });

  it('drops malformed rows but keeps valid ones', async () => {
    const query = vi.fn().mockResolvedValue({
      myMemberships: [
        { businessId: 'b1', roleId: 'business_owner' },
        { roleId: 'no-business-id' },
        null,
        'not-an-object',
      ],
    });
    const source = createUpstreamMembershipSource({
      client: fakeClient(query),
      correlationId: 'corr-1',
    });

    await expect(source(PRINCIPAL)).resolves.toEqual([
      { businessId: 'b1', roleId: 'business_owner' },
    ]);
  });

  it('throws when the server returns null data (misbehaving upstream)', async () => {
    const query = vi.fn().mockResolvedValue(null);
    const source = createUpstreamMembershipSource({
      client: fakeClient(query),
      correlationId: 'corr-1',
    });

    await expect(source(PRINCIPAL)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws when the server returns a non-list payload (contract violation)', async () => {
    const query = vi.fn().mockResolvedValue({ myMemberships: null });
    const source = createUpstreamMembershipSource({
      client: fakeClient(query),
      correlationId: 'corr-1',
    });

    await expect(source(PRINCIPAL)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('propagates upstream/auth/infra failures instead of silently emptying scope', async () => {
    const query = vi
      .fn()
      .mockRejectedValue(new UpstreamError('UPSTREAM_ERROR', 'Upstream responded with status 401', false));
    const source = createUpstreamMembershipSource({
      client: fakeClient(query),
      authorization: 'Bearer forwarded-token',
      correlationId: 'corr-1',
    });

    await expect(source(PRINCIPAL)).rejects.toBeInstanceOf(UpstreamError);
  });

  // This is the query that DISCOVERS the scope, so it must never be scoped:
  // narrowing it would be circular, and a stale/unknown business id would be
  // rejected upstream at authentication time, failing the whole request.
  it('never sends a business scope — the scope-discovery query must stay unscoped', async () => {
    const query = vi.fn().mockResolvedValue({ myMemberships: [] });
    const source = createUpstreamMembershipSource({
      client: fakeClient(query),
      authorization: 'Bearer forwarded-token',
      correlationId: 'corr-1',
    });

    await source(PRINCIPAL);

    const context = query.mock.calls[0][1] as Record<string, unknown>;
    expect(context).toEqual({ correlationId: 'corr-1', authorization: 'Bearer forwarded-token' });
    expect('businessScope' in context).toBe(false);
  });
});
