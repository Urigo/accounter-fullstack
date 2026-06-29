import { describe, expect, it, vi } from 'vitest';
import { adminBusinessesResolvers } from '../admin-businesses.resolver.js';
import { clientsResolvers } from '../clients.resolvers.js';

type FieldResolver = (parent: unknown, args: unknown, context: unknown) => unknown;

function buildContext(loaderKey: string, loadResult: unknown) {
  const load = vi.fn().mockResolvedValue(loadResult);
  const injector = {
    get: vi.fn().mockReturnValue({
      [loaderKey]: { load },
    }),
  };
  return { injector };
}

describe('LtdFinancialEntity.isClient resolver', () => {
  const resolver = (clientsResolvers.LtdFinancialEntity as Record<string, FieldResolver>).isClient;

  it('is true when a client record exists', async () => {
    const context = buildContext('getClientByIdLoader', { business_id: 'business-1' });
    await expect(resolver({ id: 'business-1' }, {}, context)).resolves.toBe(true);
  });

  it('is false when no client record exists', async () => {
    const context = buildContext('getClientByIdLoader', undefined);
    await expect(resolver({ id: 'business-1' }, {}, context)).resolves.toBe(false);
  });
});

describe('LtdFinancialEntity.isAdmin resolver', () => {
  const resolver = (adminBusinessesResolvers.LtdFinancialEntity as Record<string, FieldResolver>)
    .isAdmin;

  it('is true when an admin business record exists', async () => {
    const context = buildContext('getAdminBusinessByIdLoader', { id: 'business-1' });
    await expect(resolver({ id: 'business-1' }, {}, context)).resolves.toBe(true);
  });

  it('is false when no admin business record exists', async () => {
    const context = buildContext('getAdminBusinessByIdLoader', undefined);
    await expect(resolver({ id: 'business-1' }, {}, context)).resolves.toBe(false);
  });
});
