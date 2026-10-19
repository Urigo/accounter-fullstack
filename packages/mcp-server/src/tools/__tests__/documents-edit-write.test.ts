import { describe, expect, it } from 'vitest';
import { deleteDocumentTool, updateDocumentTool } from '../documents-edit-write.js';
import { EMPTY_UUID } from '../transactions-write.js';
import {
  authContext,
  B1,
  B2,
  BIZ,
  C1,
  C2,
  callsTo,
  D1,
  mutationClient,
  rootFields,
  runTool,
} from './review-write-harness.js';

const updated = (overrides: Record<string, unknown> = {}) => ({
  __typename: 'UpdateDocumentSuccessfulResult',
  deletedChargeId: null,
  document: {
    id: D1,
    documentType: 'RECEIPT',
    charge: { id: C1 },
    serialNumber: '2540-7247',
    date: '2026-10-18',
    amount: { raw: 60, currency: 'USD' },
    vat: null,
    creditor: { id: BIZ, name: 'Vercel Inc.' },
    debtor: null,
  },
  ...overrides,
});

const emptyMeta = { transactionsCount: 0, documentsCount: 0, miscExpensesCount: 0 };

describe('updateDocumentTool — request', () => {
  it('sends only the requested fields, converting amounts to the upstream shape', async () => {
    const { client, captured } = mutationClient('updateDocument', updated());
    const result = await runTool(
      updateDocumentTool,
      {
        documentId: D1,
        creditorId: BIZ,
        documentType: 'RECEIPT',
        date: '2026-10-18',
        amount: { value: 60, currency: 'USD' },
        vat: 9.2,
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
    expect(captured[0].query).toMatch(/^\s*mutation\b/);
    expect(captured[0].variables).toEqual({
      documentId: D1,
      fields: {
        creditorId: BIZ,
        documentType: 'RECEIPT',
        date: '2026-10-18',
        amount: { raw: 60, currency: 'USD' },
        // Upstream takes the document currency from `amount` only; the one on
        // `vat` just satisfies the input type.
        vat: { raw: 9.2, currency: 'USD' },
      },
    });
  });

  it('takes vat as a bare number — a currency on it would be ignored upstream', async () => {
    const { client, captured } = mutationClient('updateDocument', updated());
    const result = await runTool(
      updateDocumentTool,
      { documentId: D1, vat: { value: 17, currency: 'USD' } },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('forwards the resolved business scope', async () => {
    const { client, captured } = mutationClient('updateDocument', updated());
    await runTool(updateDocumentTool, { documentId: D1, serialNumber: '1' }, client);

    expect(captured[0].headers['x-business-scope']).toBe(B1);
  });
});

describe('updateDocumentTool — moving between charges', () => {
  it('moves onto a real charge, then deletes the former charge the move left empty', async () => {
    const { client, captured } = mutationClient({
      documentsByIds: [{ id: D1, charge: { id: C2 } }],
      updateDocument: updated(),
      chargesByIDs: [{ id: C2, metadata: emptyMeta }],
      deleteCharge: true,
    });
    const result = await runTool(updateDocumentTool, { documentId: D1, chargeId: C1 }, client);

    expect(result.isError).toBeUndefined();
    const order = rootFields(captured);
    expect(order).toEqual(['documentsByIds', 'updateDocument', 'chargesByIDs', 'deleteCharge']);
    expect(callsTo(captured, 'deleteCharge')[0].variables).toEqual({ chargeId: C2 });

    const structured = result.structuredContent as {
      deletedChargeId: string | null;
      cleanup: { deletedChargeIds: string[]; keptChargeIds: string[] };
    };
    // `deletedChargeId` is upstream's unlink-path report; a move onto a real
    // charge never sets it — the cleanup pass is what deleted C2.
    expect(structured.deletedChargeId).toBeNull();
    expect(structured.cleanup.deletedChargeIds).toEqual([C2]);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringMatching(/Deleted 1 former charge\(s\) left empty: .*C2|cc000000/),
    });
  });

  it('keeps a former charge that still holds a transaction', async () => {
    const { client, captured } = mutationClient({
      documentsByIds: [{ id: D1, charge: { id: C2 } }],
      updateDocument: updated(),
      chargesByIDs: [
        { id: C2, metadata: { transactionsCount: 1, documentsCount: 0, miscExpensesCount: 0 } },
      ],
      deleteCharge: true,
    });
    const result = await runTool(updateDocumentTool, { documentId: D1, chargeId: C1 }, client);

    expect(callsTo(captured, 'deleteCharge')).toHaveLength(0);
    const structured = result.structuredContent as { cleanup: { keptChargeIds: string[] } };
    expect(structured.cleanup.keptChargeIds).toEqual([C2]);
  });

  it('leaves the unlink path to upstream and relays its deletedChargeId', async () => {
    const { client, captured } = mutationClient(
      'updateDocument',
      updated({ deletedChargeId: C2, document: { id: D1, documentType: 'RECEIPT', charge: { id: 'new' } } }),
    );
    const result = await runTool(updateDocumentTool, { documentId: D1, chargeId: EMPTY_UUID }, client);

    expect(captured).toHaveLength(1);
    const structured = result.structuredContent as {
      deletedChargeId: string | null;
      cleanup: { deletedChargeIds: string[] };
    };
    expect(structured.deletedChargeId).toBe(C2);
    expect(structured.cleanup.deletedChargeIds).toEqual([]);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringMatching(/former charge .* deleted/),
    });
  });

  it('skips the cleanup when deleteEmptiedCharges is false', async () => {
    const { client, captured } = mutationClient('updateDocument', updated());
    await runTool(
      updateDocumentTool,
      { documentId: D1, chargeId: C1, deleteEmptiedCharges: false },
      client,
    );

    expect(captured).toHaveLength(1);
  });
});

describe('updateDocumentTool — guards', () => {
  it('rejects a call that changes nothing, without a round trip', async () => {
    const { client, captured } = mutationClient('updateDocument', updated());
    const result = await runTool(updateDocumentTool, { documentId: D1 }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; message: string };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/No document changes/);
    expect(captured).toHaveLength(0);
  });

  it.each(['18/10/2026', '2026-02-31'])('rejects the date %s at validation', async date => {
    // The second is well-formed but not a real day; `Date.parse` would roll it
    // over to March 3rd, so the shared calendar check has to run here.
    const { client, captured } = mutationClient('updateDocument', updated());
    const result = await runTool(updateDocumentTool, { documentId: D1, date }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = mutationClient('updateDocument', updated());
    const result = await runTool(
      updateDocumentTool,
      { documentId: D1, chargeId: C1 },
      client,
      authContext([B1, B2]),
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(captured).toHaveLength(0);
  });
});

describe('updateDocumentTool — result mapping', () => {
  it('echoes the document as it now stands', async () => {
    const { client } = mutationClient('updateDocument', updated());
    const result = await runTool(updateDocumentTool, { documentId: D1, creditorId: BIZ }, client);

    const structured = result.structuredContent as {
      ok: boolean;
      action: string;
      documentId: string;
      updatedFields: string[];
      documents: Array<Record<string, unknown>>;
    };
    expect(structured.ok).toBe(true);
    expect(structured.action).toBe('update_document');
    expect(structured.documentId).toBe(D1);
    expect(structured.updatedFields).toEqual(['creditorId']);
    expect(structured.documents).toEqual([
      {
        id: D1,
        documentType: 'RECEIPT',
        chargeId: C1,
        serialNumber: '2540-7247',
        date: '2026-10-18',
        amount: { value: 60, currency: 'USD' },
        vat: null,
        creditor: { id: BIZ, name: 'Vercel Inc.' },
        debtor: null,
      },
    ]);
  });

  it('tolerates a non-financial document echo (no amount, no parties)', async () => {
    const { client } = mutationClient(
      'updateDocument',
      updated({ document: { id: D1, documentType: 'OTHER', charge: { id: C1 } } }),
    );
    const result = await runTool(updateDocumentTool, { documentId: D1, description: 'x' }, client);

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as { documents: Array<Record<string, unknown>> };
    expect(structured.documents[0]).toMatchObject({
      id: D1,
      documentType: 'OTHER',
      chargeId: C1,
      amount: null,
      creditor: null,
    });
  });

  it('maps an upstream CommonError to a non-retryable upstream error', async () => {
    const { client, captured } = mutationClient({
      documentsByIds: [{ id: D1, charge: { id: C2 } }],
      updateDocument: { __typename: 'CommonError', message: 'Document not found' },
    });
    const result = await runTool(updateDocumentTool, { documentId: D1, chargeId: C1 }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(false);
    expect(callsTo(captured, 'deleteCharge')).toHaveLength(0);
  });
});

describe('deleteDocumentTool', () => {
  it('sends the document id and reports the charge it came off', async () => {
    const { client, captured } = mutationClient('deleteDocument', {
      success: true,
      chargeId: C1,
      deletedChargeId: null,
    });
    const result = await runTool(deleteDocumentTool, { documentId: D1 }, client);

    expect(result.isError).toBeUndefined();
    expect(captured[0].variables).toEqual({ documentId: D1 });
    expect(captured[0].headers['x-business-scope']).toBe(B1);
    const structured = result.structuredContent as {
      action: string;
      documentId: string;
      chargeId: string | null;
      deletedChargeId: string | null;
      documents: Array<Record<string, unknown>>;
    };
    expect(structured.action).toBe('delete_document');
    expect(structured.documentId).toBe(D1);
    expect(structured.chargeId).toBe(C1);
    expect(structured.deletedChargeId).toBeNull();
    expect(structured.documents).toEqual([{ id: D1, deleted: true, chargeId: C1 }]);
  });

  it('says so when the emptied charge was deleted with the document', async () => {
    const { client } = mutationClient('deleteDocument', {
      success: true,
      chargeId: C1,
      deletedChargeId: C1,
    });
    const result = await runTool(deleteDocumentTool, { documentId: D1 }, client);

    expect((result.structuredContent as { deletedChargeId: string }).deletedChargeId).toBe(C1);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringMatching(/charge .* deleted too/),
    });
  });

  it('surfaces an unsuccessful deletion as a non-retryable upstream error', async () => {
    const { client } = mutationClient('deleteDocument', {
      success: false,
      chargeId: null,
      deletedChargeId: null,
    });
    const result = await runTool(deleteDocumentTool, { documentId: D1 }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(false);
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = mutationClient('deleteDocument', { success: true });
    const result = await runTool(
      deleteDocumentTool,
      { documentId: D1 },
      client,
      authContext([B1, B2]),
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
    expect(captured).toHaveLength(0);
  });
});
