import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { BusinessesProvider } from '../../providers/businesses.provider.js';
import { FinancialEntitiesProvider } from '../../providers/financial-entities.provider.js';
import { businessesResolvers, describeBusinessInsertError } from '../businesses.resolver.js';

/**
 * `insertNewBusiness` inserts the financial entity and then the business row, in two statements.
 * When the second fails, the entity must not be left behind, and the caller must learn why when
 * the cause is one it can fix (a country the database does not know).
 */

const OWNER_ID = 'aa000000-0000-4000-8000-000000000001';
const ENTITY_ID = 'bb000000-0000-4000-8000-000000000001';

function callInsertNewBusiness(injector: Injector, fields: Record<string, unknown>) {
  const resolver = businessesResolvers.Mutation?.insertNewBusiness as unknown;
  const resolve =
    typeof resolver === 'function' ? resolver : (resolver as { resolve: unknown }).resolve;
  return (
    resolve as (parent: unknown, args: unknown, context: unknown, info: unknown) => Promise<unknown>
  )({}, { fields }, { injector }, {});
}

describe('insertNewBusiness', () => {
  const insertFinancialEntity = vi.fn();
  const deleteFinancialEntityById = vi.fn();
  const insertBusiness = vi.fn();
  const injector = {
    get: (token: unknown) => {
      if (token === AdminContextProvider) {
        return { getVerifiedAdminContext: async () => ({ ownerId: OWNER_ID }) };
      }
      if (token === FinancialEntitiesProvider) {
        return { insertFinancialEntity, deleteFinancialEntityById };
      }
      if (token === BusinessesProvider) {
        return { insertBusinessLoader: { load: insertBusiness } };
      }
      throw new Error(`Unexpected provider ${String(token)}`);
    },
  } as unknown as Injector;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    insertFinancialEntity
      .mockReset()
      .mockResolvedValue([{ id: ENTITY_ID, owner_id: OWNER_ID, name: 'Vendor' }]);
    deleteFinancialEntityById.mockReset().mockResolvedValue(undefined);
    insertBusiness.mockReset();
  });

  it('returns the created business', async () => {
    insertBusiness.mockResolvedValue({ id: ENTITY_ID, country: 'USA' });

    await expect(
      callInsertNewBusiness(injector, { name: 'Vendor', country: 'USA' }),
    ).resolves.toMatchObject({ id: ENTITY_ID, name: 'Vendor', country: 'USA' });
    expect(deleteFinancialEntityById).not.toHaveBeenCalled();
  });

  it('removes the entity and names the country when the country is unknown', async () => {
    insertBusiness.mockRejectedValue(
      Object.assign(new Error('violates foreign key constraint'), {
        constraint: 'businesses_countries_code_fk',
      }),
    );

    const result = await callInsertNewBusiness(injector, { name: 'Vendor', country: 'USA' });

    expect(result).toEqual({
      __typename: 'CommonError',
      message: 'Failed to create business: country "USA" is not in the countries table',
    });
    expect(deleteFinancialEntityById).toHaveBeenCalledWith(ENTITY_ID);
  });

  it('still answers when the cleanup itself fails', async () => {
    insertBusiness.mockRejectedValue(new Error('duplicate key value: (secret row values)'));
    deleteFinancialEntityById.mockRejectedValue(new Error('cannot delete'));

    const result = (await callInsertNewBusiness(injector, { name: 'Vendor', country: 'USA' })) as {
      message: string;
    };

    expect(result.message).toBe('Failed to create business: unexpected error, nothing was created');
    expect(result.message).not.toContain('secret');
  });

  it('does not try to remove anything when the entity was never created', async () => {
    insertFinancialEntity.mockResolvedValue([]);

    await expect(
      callInsertNewBusiness(injector, { name: 'Vendor', country: 'USA' }),
    ).resolves.toMatchObject({ __typename: 'CommonError' });
    expect(deleteFinancialEntityById).not.toHaveBeenCalled();
  });
});

describe('describeBusinessInsertError', () => {
  it('keeps unknown database errors generic', () => {
    expect(describeBusinessInsertError(new Error('relation "x" …'), 'USA')).toBe(
      'unexpected error, nothing was created',
    );
  });
});
