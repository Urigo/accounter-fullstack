import { describe, expect, it, vi } from 'vitest';
import { BusinessUsersProvider } from '../business-users.provider.js';

function buildProvider(loadedRows: Array<{ business_id: string; role_id: string }>) {
  const provider = new BusinessUsersProvider({} as never);
  (provider as unknown as { getBusinessUsersByAuth0IdsLoader: { load: ReturnType<typeof vi.fn> } }).getBusinessUsersByAuth0IdsLoader =
    { load: vi.fn().mockResolvedValue(loadedRows) };
  return provider;
}

describe('BusinessUsersProvider.getMembershipsByAuth0UserId', () => {
  it('returns an empty array for a user with no memberships', async () => {
    const provider = buildProvider([]);
    await expect(provider.getMembershipsByAuth0UserId('auth0|none')).resolves.toEqual([]);
  });

  it('returns a single membership', async () => {
    const provider = buildProvider([{ business_id: 'b-1', role_id: 'business_owner' }]);
    await expect(provider.getMembershipsByAuth0UserId('auth0|one')).resolves.toEqual([
      { businessId: 'b-1', roleId: 'business_owner' },
    ]);
  });

  it('returns all memberships for a multi-business user', async () => {
    const provider = buildProvider([
      { business_id: 'b-1', role_id: 'business_owner' },
      { business_id: 'b-2', role_id: 'accountant' },
    ]);
    await expect(provider.getMembershipsByAuth0UserId('auth0|many')).resolves.toEqual([
      { businessId: 'b-1', roleId: 'business_owner' },
      { businessId: 'b-2', roleId: 'accountant' },
    ]);
  });
});
