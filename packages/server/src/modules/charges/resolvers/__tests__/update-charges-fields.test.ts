import type { Injector } from 'graphql-modules';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { degradeChargesAccountantApproval } from '../../../accountant-approval/helpers/degrade-charges.helper.js';
import { ChargesProvider } from '../../providers/charges.provider.js';
import { chargesResolvers, MAX_CHARGES_FIELDS_UPDATES } from '../charges.resolver.js';

/**
 * `Mutation.updateChargesFields` sets each listed charge's own description and/or type in one
 * statement. It validates the whole list before writing, so a bad entry leaves every charge as it
 * was, and it degrades accountant approval only for charges whose type changed.
 */

vi.mock('../../../accountant-approval/helpers/degrade-charges.helper.js', () => ({
  degradeChargesAccountantApproval: vi.fn(),
}));

const A = 'cc000000-0000-4000-8000-00000000000a';
const B = 'cc000000-0000-4000-8000-00000000000b';
const C = 'cc000000-0000-4000-8000-00000000000c';

type Update = { chargeId: string; userDescription?: string | null; type?: string | null };
type Result =
  | { __typename: 'CommonError'; message: string }
  | { charges: Array<{ id: string; user_description?: string | null; type?: string | null }> };

const updateChargesFields = chargesResolvers.Mutation!.updateChargesFields as unknown as (
  parent: unknown,
  args: { updates: Update[] },
  context: unknown,
) => Promise<Result>;

function setup({ existingIds = [A, B, C] }: { existingIds?: string[] } = {}) {
  const loadMany = vi.fn(async (ids: string[]) =>
    ids.map(id => (existingIds.includes(id) ? { id } : new Error('not found'))),
  );
  const updateChargesDescriptionAndType = vi.fn(
    async (params: {
      chargeIds: string[];
      userDescriptions: Array<string | null>;
      types: Array<string | null>;
    }) =>
      // the statement returns rows in table order, not input order
      params.chargeIds
        .map((id, index) => ({
          id,
          user_description: params.userDescriptions[index] ?? 'stored',
          type: params.types[index] ?? 'COMMON',
          accountant_status: 'APPROVED',
        }))
        .reverse(),
  );
  const injector = {
    get: (token: unknown) => {
      if (token === ChargesProvider) {
        return { getChargeByIdLoader: { loadMany }, updateChargesDescriptionAndType };
      }
      throw new Error('unexpected provider requested');
    },
  } as unknown as Injector;
  return { context: { injector } as never, loadMany, updateChargesDescriptionAndType };
}

describe('Mutation.updateChargesFields', () => {
  beforeEach(() => {
    vi.mocked(degradeChargesAccountantApproval).mockReset().mockResolvedValue(new Map());
  });

  it('sends each charge its own values in one statement, nulls for the fields it leaves', async () => {
    const { context, updateChargesDescriptionAndType } = setup();

    await updateChargesFields(
      null,
      {
        updates: [
          { chargeId: A, userDescription: 'Office rent' },
          { chargeId: B, type: 'PAYROLL' },
          { chargeId: C, userDescription: 'Bank fees', type: 'FINANCIAL' },
        ],
      },
      context,
    );

    expect(updateChargesDescriptionAndType).toHaveBeenCalledTimes(1);
    expect(updateChargesDescriptionAndType).toHaveBeenCalledWith({
      chargeIds: [A, B, C],
      userDescriptions: ['Office rent', null, 'Bank fees'],
      types: [null, 'PAYROLL', 'FINANCIAL'],
    });
  });

  it('returns the charges in the order they were listed', async () => {
    const { context } = setup();

    const result = await updateChargesFields(
      null,
      {
        updates: [
          { chargeId: A, userDescription: 'one' },
          { chargeId: B, userDescription: 'two' },
        ],
      },
      context,
    );

    expect('charges' in result && result.charges.map(c => c.id)).toEqual([A, B]);
  });

  it('degrades approval only for charges whose type changed, and returns the degraded rows', async () => {
    const { context } = setup();
    vi.mocked(degradeChargesAccountantApproval).mockResolvedValue(
      new Map([[B, { id: B, type: 'PAYROLL', accountant_status: 'PENDING' }]]) as never,
    );

    const result = await updateChargesFields(
      null,
      {
        updates: [
          { chargeId: A, userDescription: 'description only' },
          { chargeId: B, type: 'PAYROLL' },
        ],
      },
      context,
    );

    expect(degradeChargesAccountantApproval).toHaveBeenCalledWith(expect.anything(), [B]);
    expect('charges' in result && result.charges[1]).toMatchObject({
      id: B,
      accountant_status: 'PENDING',
    });
  });

  it('does not touch approval when only descriptions change', async () => {
    const { context } = setup();

    await updateChargesFields(
      null,
      { updates: [{ chargeId: A, userDescription: 'x' }] },
      context,
    );

    expect(degradeChargesAccountantApproval).not.toHaveBeenCalled();
  });

  it.each([
    ['an empty list', [], /No charges provided/],
    [
      'a charge listed twice',
      [
        { chargeId: A, userDescription: 'x' },
        { chargeId: A, type: 'COMMON' },
      ],
      /more than once/,
    ],
    ['an entry with nothing to set', [{ chargeId: A }, { chargeId: B, type: null }], /No userDescription or type/],
  ])('refuses %s before writing', async (_label, updates, message) => {
    const { context, loadMany, updateChargesDescriptionAndType } = setup();

    const result = await updateChargesFields(null, { updates: updates as Update[] }, context);

    expect(result).toMatchObject({ __typename: 'CommonError', message: expect.stringMatching(message) });
    expect(loadMany).not.toHaveBeenCalled();
    expect(updateChargesDescriptionAndType).not.toHaveBeenCalled();
  });

  it('refuses more than the limit', async () => {
    const { context, updateChargesDescriptionAndType } = setup();
    const updates = Array.from({ length: MAX_CHARGES_FIELDS_UPDATES + 1 }, (_, i) => ({
      chargeId: `cc000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      userDescription: 'x',
    }));

    const result = await updateChargesFields(null, { updates }, context);

    expect(result).toMatchObject({ __typename: 'CommonError', message: expect.stringMatching(/limit/) });
    expect(updateChargesDescriptionAndType).not.toHaveBeenCalled();
  });

  it('refuses the whole list, writing nothing, when a charge does not exist', async () => {
    const { context, updateChargesDescriptionAndType } = setup({ existingIds: [A] });

    const result = await updateChargesFields(
      null,
      {
        updates: [
          { chargeId: A, userDescription: 'x' },
          { chargeId: B, userDescription: 'y' },
        ],
      },
      context,
    );

    expect(result).toMatchObject({
      __typename: 'CommonError',
      message: expect.stringContaining(B),
    });
    expect(updateChargesDescriptionAndType).not.toHaveBeenCalled();
  });

  it('reports a database failure as a CommonError', async () => {
    const { context, updateChargesDescriptionAndType } = setup();
    updateChargesDescriptionAndType.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await updateChargesFields(
      null,
      { updates: [{ chargeId: A, userDescription: 'x' }] },
      context,
    );

    expect(result).toEqual({ __typename: 'CommonError', message: 'Error updating charges' });
  });
});
