import { describe, expect, it } from 'vitest';
import type { AuthPrincipal } from '../token.js';
import {
  buildAuthContext,
  dedupeMemberships,
  IdentityMappingError,
  membershipsFromClaims,
  narrowReadScope,
  readScopeFromMemberships,
  resolveAuthContext,
  resolveRequestedReadScope,
} from '../identity.js';

function principal(overrides: Partial<AuthPrincipal> = {}): AuthPrincipal {
  return {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: ['read:charges'],
    email: 'a@b.com',
    expiresAt: undefined,
    claims: { sub: 'user-1' },
    ...overrides,
  };
}

// The internal membership shape. Claim/row *payload* keys stay `businessId` /
// `business_id` in the fixtures below — those are external and unrenamed.
const M = (memberBusinessId: string, roleId = 'accountant') => ({ memberBusinessId, roleId });

describe('readScopeFromMemberships', () => {
  it('is every business, de-duplicated and order-preserving', () => {
    expect(readScopeFromMemberships([M('b1'), M('b2'), M('b1')])).toEqual({
      memberBusinessIds: ['b1', 'b2'],
    });
  });
});

describe('narrowReadScope', () => {
  const memberships = [M('b1'), M('b2'), M('b3')];

  it('returns the requested subset (de-duplicated, order preserved)', () => {
    expect(narrowReadScope(memberships, ['b2', 'b1', 'b2'])).toEqual({ memberBusinessIds: ['b2', 'b1'] });
  });

  it('returns null when any requested id is outside memberships', () => {
    expect(narrowReadScope(memberships, ['b2', 'bX'])).toBeNull();
  });
});

describe('dedupeMemberships', () => {
  it('keeps the first occurrence per business id', () => {
    expect(dedupeMemberships([M('b1', 'r1'), M('b1', 'r2'), M('b2', 'r3')])).toEqual([
      M('b1', 'r1'),
      M('b2', 'r3'),
    ]);
  });
});

describe('buildAuthContext', () => {
  it('maps a user with multiple businesses to context + default scope', () => {
    const ctx = buildAuthContext(principal(), [M('b1'), M('b2')]);
    expect(ctx.userId).toBe('user-1');
    expect(ctx.auth0UserId).toBe('user-1');
    expect(ctx.email).toBe('a@b.com');
    expect(ctx.roles).toEqual(['read:charges']);
    expect(ctx.memberships).toEqual([M('b1'), M('b2')]);
    expect(ctx.defaultReadScope).toEqual({ memberBusinessIds: ['b1', 'b2'] });
  });

  it('accepts a valid user with no memberships (empty scope)', () => {
    const ctx = buildAuthContext(principal(), []);
    expect(ctx.memberships).toEqual([]);
    expect(ctx.defaultReadScope).toEqual({ memberBusinessIds: [] });
  });

  it('throws IdentityMappingError when the subject is missing', () => {
    expect(() => buildAuthContext(principal({ subject: '' }), [M('b1')])).toThrow(
      IdentityMappingError,
    );
  });
});

describe('resolveRequestedReadScope', () => {
  const ctx = buildAuthContext(principal(), [M('b1'), M('b2'), M('b3')]);

  it('defaults to all memberships when nothing is requested', () => {
    expect(resolveRequestedReadScope(ctx)).toEqual({ memberBusinessIds: ['b1', 'b2', 'b3'] });
    expect(resolveRequestedReadScope(ctx, [])).toEqual({ memberBusinessIds: ['b1', 'b2', 'b3'] });
  });

  it('narrows to a requested subset', () => {
    expect(resolveRequestedReadScope(ctx, ['b3', 'b1'])).toEqual({ memberBusinessIds: ['b3', 'b1'] });
  });

  it('returns null for a requested id outside the memberships', () => {
    expect(resolveRequestedReadScope(ctx, ['b1', 'bX'])).toBeNull();
  });
});

describe('membershipsFromClaims', () => {
  it('parses camelCase and snake_case entries and de-duplicates', () => {
    const p = principal({
      claims: {
        sub: 'user-1',
        memberships: [
          { businessId: 'b1', roleId: 'admin' },
          { business_id: 'b2', role_id: 'accountant' },
          { businessId: 'b1', roleId: 'ignored-duplicate' },
        ],
      },
    });
    expect(membershipsFromClaims(p)).toEqual([M('b1', 'admin'), M('b2', 'accountant')]);
  });

  it('ignores malformed entries and a non-array claim', () => {
    expect(membershipsFromClaims(principal({ claims: { sub: 'u', memberships: 'nope' } }))).toEqual(
      [],
    );
    expect(
      membershipsFromClaims(
        principal({
          claims: { sub: 'u', memberships: [null, {}, { roleId: 'x' }, 42, ['b1', 'r1']] },
        }),
      ),
    ).toEqual([]);
  });

  it('coerces a numeric roleId but rejects entries with object/array roles', () => {
    // A present-but-non-primitive role marks a malformed entry: it is dropped
    // entirely rather than coerced to '', so its business id cannot slip into the
    // derived read scope. A missing role is still allowed (empty role).
    expect(
      membershipsFromClaims(
        principal({
          claims: {
            sub: 'u',
            memberships: [
              { businessId: 'b1', roleId: 7 },
              { businessId: 'b2', roleId: { nested: true } },
              { businessId: 'b3', roleId: ['array-role'] },
              { businessId: 'b4' },
            ],
          },
        }),
      ),
    ).toEqual([M('b1', '7'), M('b4', '')]);
  });

  it('carries businessName but never drops a membership over a malformed one', () => {
    // Unlike roleId, the display name is not load-bearing for authorization, so
    // a bad name must never cost the caller access to a real business — it is
    // simply treated as "no name".
    const memberships = membershipsFromClaims(
      principal({
        claims: {
          sub: 'u',
          memberships: [
            { businessId: 'b1', roleId: 'accountant', businessName: 'Acme' },
            { businessId: 'b2', roleId: 'accountant', business_name: 'Snake Case' },
            { businessId: 'b3', roleId: 'accountant', businessName: { nested: true } },
            { businessId: 'b4', roleId: 'accountant', businessName: null },
            { businessId: 'b5', roleId: 'accountant' },
          ],
        },
      }),
    );

    expect(memberships.map(m => [m.memberBusinessId, m.businessName])).toEqual([
      ['b1', 'Acme'],
      ['b2', 'Snake Case'],
      ['b3', undefined],
      ['b4', undefined],
      ['b5', undefined],
    ]);
  });
});

describe('resolveAuthContext', () => {
  it('reads memberships from the token claim by default', async () => {
    const p = principal({
      claims: { sub: 'user-1', memberships: [{ businessId: 'b1', roleId: 'admin' }] },
    });
    const ctx = await resolveAuthContext(p);
    expect(ctx.memberships).toEqual([M('b1', 'admin')]);
    expect(ctx.defaultReadScope).toEqual({ memberBusinessIds: ['b1'] });
  });

  it('supports an injected async membership source (multi-business)', async () => {
    const ctx = await resolveAuthContext(principal(), async () => [M('b1'), M('b2')]);
    expect(ctx.defaultReadScope).toEqual({ memberBusinessIds: ['b1', 'b2'] });
    // and narrowing works against the resolved memberships
    expect(resolveRequestedReadScope(ctx, ['b2'])).toEqual({ memberBusinessIds: ['b2'] });
  });
});
