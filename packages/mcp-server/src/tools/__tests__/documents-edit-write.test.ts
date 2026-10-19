import { describe, expect, it } from 'vitest';
import { deleteDocumentTool, updateDocumentTool } from '../documents-edit-write.js';
import {
  authContext,
  B1,
  B2,
  BIZ,
  C1,
  C2,
  D1,
  mutationClient,
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
    creditor: { id: BIZ, name: 'Vercel Inc.' },
    debtor: null,
  },
  ...overrides,
});

describe('updateDocumentTool — request', () => {
  it('sends only the requested fields, converting amounts to the upstream shape', async () => {
    const { client, captured } = mutationClient('updateDocument', updated());
    const result = await runTool(
      updateDocumentTool,
      {
        documentId: D1,
        chargeId: C1,
        creditorId: BIZ,
        documentType: 'RECEIPT',
        amount: { value: 60, currency: 'USD' },
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
    expect(captured[0].query).toMatch(/^\s*mutation\b/);
    expect(captured[0].variables).toEqual({
      documentId: D1,
      fields: {
        chargeId: C1,
        creditorId: BIZ,
        documentType: 'RECEIPT',
        amount: { raw: 60, currency: 'USD' },
      },
    });
  });

  it('forwards the resolved business scope', async () => {
    const { client, captured } = mutationClient('updateDocument', updated());
    await runTool(updateDocumentTool, { documentId: D1, chargeId: C1 }, client);

    expect(captured[0].headers['x-business-scope']).toBe(B1);
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

  it('rejects a malformed date at validation', async () => {
    const { client, captured } = mutationClient('updateDocument', updated());
    const result = await runTool(
      updateDocumentTool,
      { documentId: D1, date: '18/10/2026' },
      client,
    );

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
  it('echoes the document and reports a deleted former charge', async () => {
    const { client } = mutationClient('updateDocument', updated({ deletedChargeId: C2 }));
    const result = await runTool(updateDocumentTool, { documentId: D1, chargeId: C1 }, client);

    const structured = result.structuredContent as {
      ok: boolean;
      action: string;
      documentId: string;
      updatedFields: string[];
      deletedChargeId: string | null;
      documents: Array<Record<string, unknown>>;
    };
    expect(structured.ok).toBe(true);
    expect(structured.action).toBe('update_document');
    expect(structured.documentId).toBe(D1);
    expect(structured.updatedFields).toEqual(['chargeId']);
    expect(structured.deletedChargeId).toBe(C2);
    expect(structured.documents).toEqual([
      {
        id: D1,
        documentType: 'RECEIPT',
        chargeId: C1,
        serialNumber: '2540-7247',
        date: '2026-10-18',
        amount: { value: 60, currency: 'USD' },
        creditor: { id: BIZ, name: 'Vercel Inc.' },
        debtor: null,
      },
    ]);
    expect(result.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringMatching(/former charge .* deleted/),
    });
  });

  it('tolerates a non-financial document echo (no amount, no parties)', async () => {
    const { client } = mutationClient(
      'updateDocument',
      updated({ document: { id: D1, documentType: 'OTHER', charge: { id: C1 } } }),
    );
    const result = await runTool(updateDocumentTool, { documentId: D1, chargeId: C1 }, client);

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
    const { client } = mutationClient('updateDocument', {
      __typename: 'CommonError',
      message: 'Document not found',
    });
    const result = await runTool(updateDocumentTool, { documentId: D1, chargeId: C1 }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; retryable: boolean };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.retryable).toBe(false);
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
