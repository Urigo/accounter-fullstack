import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteCharges } from '../../helpers/delete-charges.helper.js';
import { isChargeEmpty } from '../../helpers/delete-empty-charges.helper.js';
import { ChargesProvider } from '../../providers/charges.provider.js';
import { chargesResolvers } from '../charges.resolver.js';

/**
 * `Mutation.deleteCharge` refuses a charge that still holds anything.
 *
 * It used to count only transactions and documents, so a charge still holding misc expenses (or
 * salary records, business trip employee payments, …) passed the check and then either lost those
 * records' charge or failed on their foreign key. It now asks the shared `isChargeEmpty`.
 */

vi.mock('../../helpers/delete-charges.helper.js', () => ({
  deleteCharges: vi.fn(),
}));

vi.mock('../../helpers/delete-empty-charges.helper.js', () => ({
  isChargeEmpty: vi.fn(),
}));

const CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';

function context({ chargeExists = true }: { chargeExists?: boolean } = {}) {
  const injector = {
    get: (token: unknown) => {
      if (token === ChargesProvider) {
        return {
          getChargeByIdLoader: {
            load: vi.fn().mockResolvedValue(chargeExists ? { id: CHARGE_ID } : undefined),
          },
        };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { injector } as never;
}

const deleteCharge = chargesResolvers.Mutation!.deleteCharge as unknown as (
  parent: unknown,
  args: { chargeId: string },
  context: unknown,
) => Promise<boolean>;

describe('Mutation.deleteCharge', () => {
  beforeEach(() => {
    vi.mocked(deleteCharges).mockReset().mockResolvedValue(undefined);
    vi.mocked(isChargeEmpty).mockReset();
  });

  it('deletes an empty charge', async () => {
    vi.mocked(isChargeEmpty).mockResolvedValue(true);

    await expect(deleteCharge(null, { chargeId: CHARGE_ID }, context())).resolves.toBe(true);
    expect(deleteCharges).toHaveBeenCalledWith([CHARGE_ID], expect.anything());
  });

  it('refuses a charge that still holds records', async () => {
    vi.mocked(isChargeEmpty).mockResolvedValue(false);

    await expect(deleteCharge(null, { chargeId: CHARGE_ID }, context())).rejects.toThrow(
      /has linked/,
    );
    expect(deleteCharges).not.toHaveBeenCalled();
  });

  it('refuses a missing charge', async () => {
    vi.mocked(isChargeEmpty).mockResolvedValue(true);

    await expect(
      deleteCharge(null, { chargeId: CHARGE_ID }, context({ chargeExists: false })),
    ).rejects.toThrow(/not found/);
    expect(deleteCharges).not.toHaveBeenCalled();
  });
});
