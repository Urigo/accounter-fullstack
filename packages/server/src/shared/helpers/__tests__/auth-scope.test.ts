import { describe, expect, it } from 'vitest';
import type { BusinessMembership } from '../../types/auth.js';
import {
  isBusinessInScope,
  membershipFromTenant,
  narrowReadScope,
  readScopeFromMemberships,
  tenantFromMembership,
} from '../auth-scope.js';

describe('membershipFromTenant', () => {
  it('maps a tenant with role and name to a membership', () => {
    expect(
      membershipFromTenant({ businessId: 'b-1', roleId: 'admin', businessName: 'Acme' }),
    ).toEqual({ businessId: 'b-1', roleId: 'admin', businessName: 'Acme' });
  });

  it('defaults a missing role to an empty string and omits the name', () => {
    expect(membershipFromTenant({ businessId: 'b-1' })).toEqual({
      businessId: 'b-1',
      roleId: '',
    });
  });
});

describe('tenantFromMembership', () => {
  it('round-trips back to a tenant context', () => {
    const membership: BusinessMembership = { businessId: 'b-1', roleId: 'owner' };
    expect(tenantFromMembership(membership)).toEqual({ businessId: 'b-1', roleId: 'owner' });
  });

  it('preserves the business name when present', () => {
    expect(
      tenantFromMembership({ businessId: 'b-1', roleId: 'owner', businessName: 'Acme' }),
    ).toEqual({ businessId: 'b-1', roleId: 'owner', businessName: 'Acme' });
  });
});

describe('readScopeFromMemberships', () => {
  it('returns all membership business ids in order', () => {
    expect(
      readScopeFromMemberships([
        { businessId: 'b-1', roleId: 'owner' },
        { businessId: 'b-2', roleId: 'accountant' },
      ]),
    ).toEqual({ businessIds: ['b-1', 'b-2'] });
  });

  it('de-duplicates repeated business ids', () => {
    expect(
      readScopeFromMemberships([
        { businessId: 'b-1', roleId: 'owner' },
        { businessId: 'b-1', roleId: 'accountant' },
        { businessId: 'b-2', roleId: 'owner' },
      ]),
    ).toEqual({ businessIds: ['b-1', 'b-2'] });
  });

  it('returns an empty scope for a user with no memberships', () => {
    expect(readScopeFromMemberships([])).toEqual({ businessIds: [] });
  });
});

describe('isBusinessInScope', () => {
  const scope = { businessIds: ['b-1', 'b-2'] };

  it('is true for a business inside the scope', () => {
    expect(isBusinessInScope(scope, 'b-2')).toBe(true);
  });

  it('is false for a business outside the scope', () => {
    expect(isBusinessInScope(scope, 'b-3')).toBe(false);
  });
});

describe('narrowReadScope', () => {
  const memberships: BusinessMembership[] = [
    { businessId: 'b-1', roleId: 'owner' },
    { businessId: 'b-2', roleId: 'accountant' },
    { businessId: 'b-3', roleId: 'employee' },
  ];

  it('narrows to a requested subset, preserving request order', () => {
    expect(narrowReadScope(memberships, ['b-3', 'b-1'])).toEqual({
      businessIds: ['b-3', 'b-1'],
    });
  });

  it('de-duplicates repeated requested ids', () => {
    expect(narrowReadScope(memberships, ['b-1', 'b-1', 'b-2'])).toEqual({
      businessIds: ['b-1', 'b-2'],
    });
  });

  it('returns null when any requested id is outside the memberships', () => {
    expect(narrowReadScope(memberships, ['b-1', 'b-99'])).toBeNull();
  });

  it('accepts the full membership set', () => {
    expect(narrowReadScope(memberships, ['b-1', 'b-2', 'b-3'])).toEqual({
      businessIds: ['b-1', 'b-2', 'b-3'],
    });
  });
});
