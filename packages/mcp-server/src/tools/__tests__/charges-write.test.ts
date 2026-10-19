import { describe, expect, it } from 'vitest';
import { mergeChargesTool, updateChargeTool } from '../charges-write.js';
import {
  authContext,
  B1,
  B2,
  C1,
  C2,
  chargeEcho,
  mutationClient,
  runTool,
} from './review-write-harness.js';

/**
 * `accounter_update_charge` and `accounter_merge_charges` each wrap one upstream
 * mutation. What matters is which fields reach upstream (absent means "leave as
 * is", so an unrequested field must not be sent as null), how the result union
 * is mapped, and the guards that refuse a pointless or self-referential call
 * before any round trip.
 */

describe('updateChargeTool — request', () => {
  it('sends only the fields the caller passed, under the upstream names', async () => {
    const { client, captured } = mutationClient('updateCharge', {
      __typename: 'UpdateChargeSuccessfulResult',
      charge: chargeEcho(),
    });
    const result = await runTool(
      updateChargeTool,
      { chargeId: C1, type: 'PAYROLL', optionalVat: true, businessTripId: 'trip-1' },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
    expect(captured[0].query).toMatch(/^\s*mutation\b/);
    expect(captured[0].variables).toEqual({
      chargeId: C1,
      fields: { type: 'PAYROLL', optionalVAT: true, businessTripID: 'trip-1' },
    });
  });

  it('forwards the resolved business scope', async () => {
    const { client, captured } = mutationClient('updateCharge', {
      __typename: 'UpdateChargeSuccessfulResult',
      charge: chargeEcho(),
    });
    await runTool(updateChargeTool, { chargeId: C1, userDescription: 'Payroll' }, client);

    expect(captured[0].headers['x-business-scope']).toBe(B1);
  });
});

describe('updateChargeTool — guards', () => {
  it('rejects a call that changes nothing, without a round trip', async () => {
    const { client, captured } = mutationClient('updateCharge', null);
    const result = await runTool(updateChargeTool, { chargeId: C1 }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; message: string };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/No charge changes/);
    expect(captured).toHaveLength(0);
  });

  it('rejects an unknown charge type at validation', async () => {
    const { client, captured } = mutationClient('updateCharge', null);
    const result = await runTool(updateChargeTool, { chargeId: C1, type: 'EXPENSE' }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('does not accept a counterparty — that is a transaction edit', async () => {
    // The input schema rejects unknown fields, so a model that reaches for
    // `counterpartyId` here (the upstream input has it, but ignores it) is told
    // so rather than getting a silent no-op.
    const { client, captured } = mutationClient('updateCharge', null);
    const result = await runTool(updateChargeTool, { chargeId: C1, counterpartyId: 'b' }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = mutationClient('updateCharge', null);
    const result = await runTool(
      updateChargeTool,
      { chargeId: C1, type: 'FINANCIAL' },
      client,
      authContext([B1, B2]),
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(captured).toHaveLength(0);
  });
});

describe('updateChargeTool — result mapping', () => {
  it('echoes the charge with its type derived from the GraphQL typename', async () => {
    const { client } = mutationClient('updateCharge', {
      __typename: 'UpdateChargeSuccessfulResult',
      charge: chargeEcho({ __typename: 'CreditcardBankCharge', userDescription: 'Card bill' }),
    });
    const result = await runTool(updateChargeTool, { chargeId: C1, type: 'CREDITCARD_BANK' }, client);

    const structured = result.structuredContent as {
      ok: boolean;
      action: string;
      chargeId: string;
      updatedFields: string[];
      charges: Array<Record<string, unknown>>;
    };
    expect(structured.ok).toBe(true);
    expect(structured.action).toBe('update_charge');
    expect(structured.chargeId).toBe(C1);
    expect(structured.updatedFields).toEqual(['type']);
    expect(structured.charges).toEqual([
      {
        id: C1,
        chargeType: 'CREDITCARD_BANK',
        description: 'Card bill',
        optionalDocuments: null,
        optionalVat: null,
        counterparty: { id: expect.any(String), name: 'Poalim' },
        tags: [{ id: 'tag-1', name: 'financial' }],
        transactionsCount: 2,
        documentsCount: 0,
        invalidLedger: 'VALID',
      },
    ]);
  });

  it('maps an upstream CommonError to a non-retryable upstream error', async () => {
    const { client } = mutationClient('updateCharge', {
      __typename: 'CommonError',
      message: 'Charge ID="x" not found',
    });
    const result = await runTool(updateChargeTool, { chargeId: C1, type: 'COMMON' }, client);

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

describe('mergeChargesTool', () => {
  const merged = () =>
    mutationClient('mergeCharges', {
      __typename: 'MergeChargeSuccessfulResult',
      charge: chargeEcho({
        metadata: { transactionsCount: 1, documentsCount: 2, invalidLedger: 'INVALID' },
      }),
    });

  it('sends the base, the charges to fold in, and null fields when none were given', async () => {
    const { client, captured } = merged();
    const result = await runTool(
      mergeChargesTool,
      { baseChargeId: C1, chargeIdsToMerge: [C2] },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured[0].variables).toEqual({
      baseChargeId: C1,
      chargeIdsToMerge: [C2],
      fields: null,
    });
  });

  it('applies optional base-charge fields in the same call', async () => {
    const { client, captured } = merged();
    await runTool(
      mergeChargesTool,
      { baseChargeId: C1, chargeIdsToMerge: [C2], userDescription: 'Vercel domain', type: 'COMMON' },
      client,
    );

    expect(captured[0].variables.fields).toEqual({
      userDescription: 'Vercel domain',
      type: 'COMMON',
    });
  });

  it('refuses to merge a charge into itself, without a round trip', async () => {
    const { client, captured } = merged();
    const result = await runTool(
      mergeChargesTool,
      { baseChargeId: C1, chargeIdsToMerge: [C2, C1] },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; message: string };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/into itself/);
    expect(captured).toHaveLength(0);
  });

  it('refuses a duplicated charge id', async () => {
    const { client, captured } = merged();
    const result = await runTool(
      mergeChargesTool,
      { baseChargeId: C1, chargeIdsToMerge: [C2, C2] },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(/Duplicate/);
    expect(captured).toHaveLength(0);
  });

  it('reports the merged charge with its new counts', async () => {
    const { client } = merged();
    const result = await runTool(
      mergeChargesTool,
      { baseChargeId: C1, chargeIdsToMerge: [C2] },
      client,
    );

    const structured = result.structuredContent as {
      action: string;
      baseChargeId: string;
      mergedChargeIds: string[];
      mergedCount: number;
      charges: Array<{ transactionsCount: number; documentsCount: number }>;
    };
    expect(structured.action).toBe('merge_charges');
    expect(structured.baseChargeId).toBe(C1);
    expect(structured.mergedChargeIds).toEqual([C2]);
    expect(structured.mergedCount).toBe(1);
    expect(structured.charges[0]).toMatchObject({ transactionsCount: 1, documentsCount: 2 });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringMatching(/1 transaction\(s\) and 2 document\(s\)/),
    });
  });

  it('maps an upstream CommonError to a non-retryable upstream error', async () => {
    const { client } = mutationClient('mergeCharges', {
      __typename: 'CommonError',
      message: 'Charge not found',
    });
    const result = await runTool(
      mergeChargesTool,
      { baseChargeId: C1, chargeIdsToMerge: [C2] },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('UPSTREAM_ERROR');
  });
});
