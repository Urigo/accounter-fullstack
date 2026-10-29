import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { mergeChargesExecutor } from '../../helpers/merge-charges.helper.js';
import { ChargesProvider } from '../../providers/charges.provider.js';
import type { IGetChargesByIdsResult } from '../../types.js';
import { chargesResolvers } from '../charges.resolver.js';

/**
 * `Mutation.mergeCharges` responds with the merged charge as it is after the merge.
 *
 * It used to respond with the base charge as loaded before applying `fields` and merging, unless
 * the accountant approval happened to be degraded. The client takes the charge's new state from
 * the mutation payload (#4481), so a stale payload showed the pre-merge description, approval and
 * type until the next refetch.
 */

vi.mock('../../helpers/merge-charges.helper.js', () => ({
  mergeChargesExecutor: vi.fn(),
}));

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

const BASE_CHARGE_ID = 'cc000000-0000-4000-8000-000000000001';
const MERGED_CHARGE_ID = 'cc000000-0000-4000-8000-000000000002';

const charge = (fields: Partial<IGetChargesByIdsResult>) =>
  ({ id: BASE_CHARGE_ID, ...fields }) as IGetChargesByIdsResult;

const staleCharge = charge({ user_description: 'before merge', accountant_status: 'UNAPPROVED' });
const freshCharge = charge({ user_description: 'after merge', accountant_status: 'UNAPPROVED' });

function context({ goneAfterMerge = false }: { goneAfterMerge?: boolean } = {}) {
  // Mirrors the real loader: the first load caches the charge as it was, and `updateCharge`
  // primes the cache with the updated row.
  let cached: IGetChargesByIdsResult | undefined = staleCharge;
  vi.mocked(mergeChargesExecutor).mockImplementation(async () => {
    if (goneAfterMerge) {
      cached = undefined;
    }
  });
  const chargesProvider = {
    getChargeByIdLoader: { load: vi.fn(async () => cached) },
    updateCharge: vi.fn(async () => {
      cached = freshCharge;
      return freshCharge;
    }),
  };
  const injector = {
    get: (token: unknown) => {
      if (token === ChargesProvider) {
        return chargesProvider;
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { injector } as never;
}

const mergeCharges = chargesResolvers.Mutation!.mergeCharges as unknown as (
  parent: unknown,
  args: {
    baseChargeID: string;
    chargeIdsToMerge: string[];
    fields?: { userDescription?: string };
  },
  context: unknown,
) => Promise<{ charge: IGetChargesByIdsResult }>;

describe('Mutation.mergeCharges', () => {
  beforeEach(() => {
    vi.mocked(mergeChargesExecutor).mockReset().mockResolvedValue(undefined);
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('responds with the charge as updated, not as loaded before the merge', async () => {
    const result = await mergeCharges(
      null,
      {
        baseChargeID: BASE_CHARGE_ID,
        chargeIdsToMerge: [MERGED_CHARGE_ID],
        fields: { userDescription: 'after merge' },
      },
      context(),
    );

    expect(mergeChargesExecutor).toHaveBeenCalledWith(
      [MERGED_CHARGE_ID],
      BASE_CHARGE_ID,
      expect.anything(),
    );
    expect(result.charge).toBe(freshCharge);
  });

  it('responds with the degraded charge when the merge degraded its approval', async () => {
    const degradedCharge = charge({ accountant_status: 'PENDING' });
    vi.mocked(degradeChargesAccountantApproval).mockResolvedValue(
      new Map([[BASE_CHARGE_ID, degradedCharge]]),
    );

    const result = await mergeCharges(
      null,
      { baseChargeID: BASE_CHARGE_ID, chargeIdsToMerge: [MERGED_CHARGE_ID] },
      context(),
    );

    expect(result.charge).toBe(degradedCharge);
  });

  it('reports an error rather than the pre-merge charge when the charge is gone after the merge', async () => {
    const result = await mergeCharges(
      null,
      { baseChargeID: BASE_CHARGE_ID, chargeIdsToMerge: [MERGED_CHARGE_ID] },
      context({ goneAfterMerge: true }),
    );

    expect(result).toEqual({ __typename: 'CommonError', message: 'Charge not found after merge' });
  });
});
