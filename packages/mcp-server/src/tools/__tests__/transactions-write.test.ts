import { describe, expect, it } from 'vitest';
import { EMPTY_UUID, updateTransactionsTool } from '../transactions-write.js';
import {
  authContext,
  B1,
  B2,
  BIZ,
  C1,
  C2,
  callsTo,
  mutationClient,
  rootFields,
  runTool,
  T1,
} from './review-write-harness.js';

const T2 = 'ee000000-0000-4000-8000-000000000002';
const C3 = 'cc000000-0000-4000-8000-000000000003';

const success = (transactions: Array<Record<string, unknown>>) => ({
  __typename: 'UpdatedTransactionsSuccessfulResult',
  transactions,
});

const emptyMeta = { transactionsCount: 0, documentsCount: 0, miscExpensesCount: 0 };
const busyMeta = { transactionsCount: 1, documentsCount: 0, miscExpensesCount: 0 };

describe('updateTransactionsTool — request', () => {
  it('sends one batch mutation with only the requested fields', async () => {
    const { client, captured } = mutationClient('updateTransactions', success([]));
    const result = await runTool(
      updateTransactionsTool,
      { transactionIds: [T1, T2], counterpartyId: BIZ },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
    expect(captured[0].query).toMatch(/^\s*mutation\b/);
    expect(captured[0].variables).toEqual({
      transactionIds: [T1, T2],
      fields: { counterpartyId: BIZ },
    });
  });

  it('passes the unlink sentinel through unchanged, with no cleanup pass', async () => {
    // Upstream deletes emptied former charges itself on the unlink path, and
    // puts every listed transaction into ONE new charge.
    const { client, captured } = mutationClient('updateTransactions', success([]));
    await runTool(updateTransactionsTool, { transactionIds: [T1], chargeId: EMPTY_UUID }, client);

    expect(captured).toHaveLength(1);
    expect(captured[0].variables.fields).toEqual({ chargeId: EMPTY_UUID });
  });

  it('sends an explicit false for isFee', async () => {
    const { client, captured } = mutationClient('updateTransactions', success([]));
    await runTool(updateTransactionsTool, { transactionIds: [T1], isFee: false }, client);

    expect(captured[0].variables.fields).toEqual({ isFee: false });
  });

  it('forwards the resolved business scope', async () => {
    const { client, captured } = mutationClient({
      transactionsByIDs: [],
      updateTransactions: success([]),
    });
    await runTool(updateTransactionsTool, { transactionIds: [T1], chargeId: C1 }, client);

    expect(captured[0].headers['x-business-scope']).toBe(B1);
  });
});

describe('updateTransactionsTool — moving onto a real charge', () => {
  it('notes the former charges first, then deletes the ones the move left empty', async () => {
    const { client, captured } = mutationClient({
      transactionsByIDs: [
        { id: T1, chargeId: C2 },
        { id: T2, chargeId: C3 },
      ],
      updateTransactions: success([
        { id: T1, chargeId: C1, isFee: null, counterparty: null },
        { id: T2, chargeId: C1, isFee: null, counterparty: null },
      ]),
      // One emptiness read per former charge; the fake answers "empty" to both.
      chargesByIDs: [{ id: C2, metadata: emptyMeta }],
      deleteCharge: true,
    });
    const result = await runTool(
      updateTransactionsTool,
      { transactionIds: [T1, T2], chargeId: C1 },
      client,
    );

    expect(result.isError).toBeUndefined();
    const order = rootFields(captured);
    // read former charges → move → read emptiness (one per former charge) → delete
    expect(order.slice(0, 2)).toEqual(['transactionsByIDs', 'updateTransactions']);
    expect(callsTo(captured, 'chargesByIDs').map(c => c.variables.chargeIDs)).toEqual([[C2], [C3]]);
    expect(callsTo(captured, 'deleteCharge').map(c => c.variables.chargeId)).toEqual([C2, C3]);

    const structured = result.structuredContent as {
      cleanup: { deletedChargeIds: string[]; keptChargeIds: string[]; failures: unknown[] };
    };
    expect(structured.cleanup).toEqual({ deletedChargeIds: [C2, C3], keptChargeIds: [], failures: [] });
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringMatching(/Deleted 2 former charge\(s\) left empty/),
    });
  });

  it('keeps a former charge that still holds something, and never touches the target', async () => {
    const { client, captured } = mutationClient({
      transactionsByIDs: [
        { id: T1, chargeId: C2 },
        { id: T2, chargeId: C1 }, // already on the target
      ],
      updateTransactions: success([]),
      chargesByIDs: [{ id: C2, metadata: busyMeta }],
      deleteCharge: true,
    });
    const result = await runTool(
      updateTransactionsTool,
      { transactionIds: [T1, T2], chargeId: C1 },
      client,
    );

    expect(callsTo(captured, 'chargesByIDs').map(c => c.variables.chargeIDs)).toEqual([[C2]]);
    expect(callsTo(captured, 'deleteCharge')).toHaveLength(0);
    const structured = result.structuredContent as { cleanup: { keptChargeIds: string[] } };
    expect(structured.cleanup.keptChargeIds).toEqual([C2]);
  });

  it('reports a refused deletion without failing the move', async () => {
    const { client } = mutationClient({
      transactionsByIDs: [{ id: T1, chargeId: C2 }],
      updateTransactions: success([]),
      chargesByIDs: [{ id: C2, metadata: emptyMeta }],
      deleteCharge: false,
    });
    const result = await runTool(updateTransactionsTool, { transactionIds: [T1], chargeId: C1 }, client);

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      cleanup: { deletedChargeIds: string[]; failures: Array<{ chargeId: string }> };
    };
    expect(structured.cleanup.deletedChargeIds).toEqual([]);
    expect(structured.cleanup.failures).toEqual([{ chargeId: C2, message: expect.any(String) }]);
  });

  it('skips the cleanup entirely when deleteEmptiedCharges is false', async () => {
    const { client, captured } = mutationClient('updateTransactions', success([]));
    await runTool(
      updateTransactionsTool,
      { transactionIds: [T1], chargeId: C1, deleteEmptiedCharges: false },
      client,
    );

    expect(captured).toHaveLength(1);
    expect(callsTo(captured, 'transactionsByIDs')).toHaveLength(0);
  });
});

describe('updateTransactionsTool — guards', () => {
  it('rejects a call that changes nothing, without a round trip', async () => {
    const { client, captured } = mutationClient('updateTransactions', success([]));
    const result = await runTool(updateTransactionsTool, { transactionIds: [T1] }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; message: string };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/No transaction changes/);
    expect(captured).toHaveLength(0);
  });

  it('requires at least one transaction', async () => {
    const { client } = mutationClient('updateTransactions', success([]));
    const result = await runTool(
      updateTransactionsTool,
      { transactionIds: [], counterpartyId: BIZ },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = mutationClient('updateTransactions', success([]));
    const result = await runTool(
      updateTransactionsTool,
      { transactionIds: [T1], counterpartyId: BIZ },
      client,
      authContext([B1, B2]),
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(captured).toHaveLength(0);
  });
});

describe('updateTransactionsTool — result mapping', () => {
  it('reports each transaction as it now stands, with requested vs updated counts', async () => {
    const { client } = mutationClient(
      'updateTransactions',
      success([
        { id: T1, chargeId: C1, isFee: false, counterparty: { id: BIZ, name: 'Vercel Inc.' } },
        { id: T2, chargeId: C1, isFee: null, counterparty: null },
      ]),
    );
    const result = await runTool(
      updateTransactionsTool,
      { transactionIds: [T1, T2, 'missing'], counterpartyId: BIZ },
      client,
    );

    const structured = result.structuredContent as {
      ok: boolean;
      action: string;
      updatedCount: number;
      requestedCount: number;
      updatedFields: string[];
      transactions: Array<Record<string, unknown>>;
    };
    expect(structured.ok).toBe(true);
    expect(structured.action).toBe('update_transactions');
    expect(structured.updatedCount).toBe(2);
    expect(structured.requestedCount).toBe(3);
    expect(structured.updatedFields).toEqual(['counterpartyId']);
    expect(structured.transactions).toEqual([
      { id: T1, chargeId: C1, isFee: false, counterparty: { id: BIZ, name: 'Vercel Inc.' } },
      { id: T2, chargeId: C1, isFee: null, counterparty: null },
    ]);
  });

  it('maps an upstream CommonError to a non-retryable upstream error', async () => {
    const { client, captured } = mutationClient({
      transactionsByIDs: [{ id: T1, chargeId: C2 }],
      updateTransactions: { __typename: 'CommonError', message: 'Charge ID="c" not valid' },
    });
    const result = await runTool(
      updateTransactionsTool,
      { transactionIds: [T1], chargeId: C1 },
      client,
    );

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(false);
    // A refused move deletes nothing.
    expect(callsTo(captured, 'deleteCharge')).toHaveLength(0);
  });
});
