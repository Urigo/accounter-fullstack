import { describe, expect, it } from 'vitest';
import { MAX_CHARGES_PER_BATCH_UPDATE, updateChargesTool } from '../charges-write.js';
import { authContext, B1, B2, C1, C2, chargeEcho, mutationClient, runTool } from './review-write-harness.js';

/**
 * `accounter_update_charges` wraps upstream `updateChargesFields`: one mutation for many
 * charges, each with its own description and/or type. What matters is that each entry sends
 * only the fields it carries (absent means "leave as is" upstream), that a pointless or
 * self-contradicting list is refused before any round trip, and how the result union maps.
 */

const success = (charges: Array<Record<string, unknown>>) => ({
  __typename: 'BatchUpdateChargesSuccessfulResult',
  charges,
});

describe('updateChargesTool — request', () => {
  it('sends one mutation with each entry carrying only its own fields', async () => {
    const { client, captured } = mutationClient(
      'updateChargesFields',
      success([chargeEcho(), chargeEcho({ id: C2 })]),
    );
    const result = await runTool(
      updateChargesTool,
      {
        updates: [
          { chargeId: C1, userDescription: 'Office rent' },
          { chargeId: C2, type: 'FINANCIAL' },
        ],
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
    expect(captured[0].query).toMatch(/^\s*mutation\b/);
    expect(captured[0].variables).toEqual({
      updates: [
        { chargeId: C1, userDescription: 'Office rent' },
        { chargeId: C2, type: 'FINANCIAL' },
      ],
    });
  });

  it('forwards the resolved business scope', async () => {
    const { client, captured } = mutationClient('updateChargesFields', success([chargeEcho()]));
    await runTool(updateChargesTool, { updates: [{ chargeId: C1, userDescription: 'x' }] }, client);

    expect(captured[0].headers['x-business-scope']).toBe(B1);
  });
});

describe('updateChargesTool — guards', () => {
  const refused = async (args: Record<string, unknown>, auth?: ReturnType<typeof authContext>) => {
    const { client, captured } = mutationClient('updateChargesFields', null);
    const result = await runTool(updateChargesTool, args, client, auth);
    expect(result.isError).toBe(true);
    expect(captured).toHaveLength(0);
    return result.structuredContent as { code: string; message: string; details?: unknown };
  };

  it('refuses an entry that sets nothing, naming it', async () => {
    const structured = await refused({
      updates: [{ chargeId: C1, userDescription: 'x' }, { chargeId: C2 }],
    });
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(structured)).toContain('updates.1');
  });

  it('refuses a charge listed twice', async () => {
    const structured = await refused({
      updates: [
        { chargeId: C1, userDescription: 'x' },
        { chargeId: C1, type: 'COMMON' },
      ],
    });
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(structured)).toContain('more than once');
  });

  it('refuses an empty list and one over the cap', async () => {
    expect((await refused({ updates: [] })).code).toBe('VALIDATION_ERROR');
    const tooMany = Array.from({ length: MAX_CHARGES_PER_BATCH_UPDATE + 1 }, (_, i) => ({
      chargeId: `cc000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      userDescription: 'x',
    }));
    expect((await refused({ updates: tooMany })).code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown charge type, and fields the batch does not take', async () => {
    expect((await refused({ updates: [{ chargeId: C1, type: 'EXPENSE' }] })).code).toBe(
      'VALIDATION_ERROR',
    );
    expect(
      (await refused({ updates: [{ chargeId: C1, optionalVat: true }] })).code,
    ).toBe('VALIDATION_ERROR');
  });

  it('refuses an ambiguous write target', async () => {
    const structured = await refused(
      { updates: [{ chargeId: C1, type: 'FINANCIAL' }] },
      authContext([B1, B2]),
    );
    expect(structured.code).toBe('AUTHORIZATION_ERROR');
  });
});

describe('updateChargesTool — result mapping', () => {
  it('echoes every charge with its type from the typename, plus the counts', async () => {
    const { client } = mutationClient(
      'updateChargesFields',
      success([
        chargeEcho({ userDescription: 'Office rent' }),
        chargeEcho({ id: C2, __typename: 'SalaryCharge' }),
      ]),
    );
    const result = await runTool(
      updateChargesTool,
      {
        updates: [
          { chargeId: C1, userDescription: 'Office rent' },
          { chargeId: C2, type: 'PAYROLL' },
        ],
      },
      client,
    );

    const structured = result.structuredContent as {
      ok: boolean;
      action: string;
      updatedCount: number;
      requestedCount: number;
      descriptionsSet: number;
      typesSet: number;
      charges: Array<{ id: string; chargeType: string; description: string | null }>;
    };
    expect(structured).toMatchObject({
      ok: true,
      action: 'update_charges',
      updatedCount: 2,
      requestedCount: 2,
      descriptionsSet: 1,
      typesSet: 1,
    });
    expect(structured.charges.map(c => [c.id, c.chargeType])).toEqual([
      [C1, 'COMMON'],
      [C2, 'PAYROLL'],
    ]);
    expect(structured.charges[0].description).toBe('Office rent');
  });

  it('maps an upstream CommonError to a non-retryable upstream error', async () => {
    const { client } = mutationClient('updateChargesFields', {
      __typename: 'CommonError',
      message: `Charges not found: "${C2}"`,
    });
    const result = await runTool(
      updateChargesTool,
      { updates: [{ chargeId: C2, userDescription: 'x' }] },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      code: string;
      message: string;
      retryable: boolean;
    };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.message).toMatch(/not found/);
    expect(structured.retryable).toBe(false);
  });
});
