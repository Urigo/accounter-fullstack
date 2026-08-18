import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import {
  MAX_DOCUMENT_BYTES,
  MAX_TOTAL_DOCUMENT_BYTES,
  uploadDocumentsTool,
} from '../documents-write.js';
import { executeRegisteredTool } from '../execute.js';

/**
 * `accounter_upload_documents` is the first tool that sends binary content
 * upstream, so most of what matters here is *what reaches the wire*: the
 * multipart envelope, the pinned `isSensitive`, and the input guards that must
 * reject a bad payload before any of it is uploaded.
 */

const B1 = 'aa000000-0000-4000-8000-000000000001';
const B2 = 'aa000000-0000-4000-8000-000000000002';
const CHARGE = 'cc000000-0000-4000-8000-000000000001';

function authContext(memberBusinessIds: string[], roleId = 'accountant'): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: [],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(
    principal,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId })),
  );
}

/** The parts of a captured multipart request the assertions care about. */
interface CapturedUpload {
  operations: { query: string; variables: Record<string, unknown> };
  map: Record<string, string[]>;
  parts: Array<{ name: string; filename: string; type: string; bytes: Uint8Array }>;
  headers: Record<string, string>;
}

function uploadClient(responses: unknown[]) {
  const captured: CapturedUpload[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const form = init.body as FormData;
    const parts: CapturedUpload['parts'] = [];
    for (const [name, value] of form.entries()) {
      if (name === 'operations' || name === 'map') continue;
      const file = value as File;
      parts.push({
        name,
        filename: file.name,
        type: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      });
    }
    captured.push({
      operations: JSON.parse(String(form.get('operations'))),
      map: JSON.parse(String(form.get('map'))),
      parts,
      headers: init.headers as Record<string, string>,
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { batchUploadDocuments: responses } }),
    } as unknown as Response;
  });
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, captured };
}

const ok = (id: string, documentType: string | null = 'INVOICE') => ({
  __typename: 'UploadDocumentSuccessfulResult',
  document: { id, documentType },
});

const doc = (overrides: Record<string, unknown> = {}) => ({
  filename: 'invoice.pdf',
  mimeType: 'application/pdf',
  // "hello" — a known payload so the decoded bytes can be asserted exactly.
  contentBase64: 'aGVsbG8=',
  ...overrides,
});

function run(rawArgs: unknown, client: UpstreamGraphQLClient, auth = authContext([B1])) {
  return executeRegisteredTool({
    tool: uploadDocumentsTool,
    rawArgs,
    auth,
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });
}

describe('uploadDocumentsTool — multipart envelope', () => {
  it('sends files as multipart parts with null placeholders and a matching map', async () => {
    const { client, captured } = uploadClient([ok('d1'), ok('d2')]);
    const result = await run(
      {
        chargeId: CHARGE,
        documents: [doc({ filename: 'a.pdf' }), doc({ filename: 'b.png', mimeType: 'image/png' })],
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
    const [call] = captured;

    // Per the GraphQL multipart request spec the file variables are nulls, and
    // `map` points each numbered part at its position.
    expect(call.operations.variables.documents).toEqual([null, null]);
    expect(call.map).toEqual({
      '0': ['variables.documents.0'],
      '1': ['variables.documents.1'],
    });
    expect(call.parts.map(part => [part.name, part.filename, part.type])).toEqual([
      ['0', 'a.pdf', 'application/pdf'],
      ['1', 'b.png', 'image/png'],
    ]);
    // Content survives the base64 round trip byte-for-byte.
    expect(new TextDecoder().decode(call.parts[0].bytes)).toBe('hello');
  });

  it('does not set Content-Type, so FormData supplies the multipart boundary', async () => {
    const { client, captured } = uploadClient([ok('d1')]);
    await run({ chargeId: CHARGE, documents: [doc()] }, client);

    const names = Object.keys(captured[0].headers).map(name => name.toLowerCase());
    expect(names).not.toContain('content-type');
  });

  it('pins isSensitive to true and forwards the chargeId', async () => {
    const { client, captured } = uploadClient([ok('d1')]);
    await run({ chargeId: CHARGE, documents: [doc()] }, client);

    expect(captured[0].operations.variables).toMatchObject({
      chargeId: CHARGE,
      isSensitive: true,
    });
  });

  it('rejects a caller-supplied isSensitive — it is not part of the schema', async () => {
    const { client, captured } = uploadClient([ok('d1')]);
    const result = await run(
      { chargeId: CHARGE, documents: [doc()], isSensitive: false },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });
});

describe('uploadDocumentsTool — input guards', () => {
  it('requires a chargeId, so the tool can never create a charge', async () => {
    const { client, captured } = uploadClient([]);
    const result = await run({ documents: [doc()] }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    // Nothing reached upstream — the omitted chargeId never had a chance to be
    // read as "create a new charge for me".
    expect(captured).toHaveLength(0);
  });

  it.each([
    ['not base64 at all', 'not base64!!'],
    ['a truncated payload Buffer.from would silently accept', 'aGVsbG8'],
  ])('rejects %s before uploading anything', async (_label, contentBase64) => {
    const { client, captured } = uploadClient([]);
    const result = await run({ chargeId: CHARGE, documents: [doc({ contentBase64 })] }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('accepts a data: URI prefix and surrounding whitespace', async () => {
    const { client, captured } = uploadClient([ok('d1')]);
    const result = await run(
      {
        chargeId: CHARGE,
        documents: [doc({ contentBase64: 'data:application/pdf;base64,aGVs\nbG8=' })],
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(new TextDecoder().decode(captured[0].parts[0].bytes)).toBe('hello');
  });

  it('rejects an unlisted MIME type', async () => {
    const { client } = uploadClient([]);
    const result = await run(
      { chargeId: CHARGE, documents: [doc({ mimeType: 'application/x-msdownload' })] },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('rejects a file over the per-file size cap', async () => {
    const { client, captured } = uploadClient([]);
    const oversized = Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 0x41).toString('base64');
    const result = await run(
      { chargeId: CHARGE, documents: [doc({ contentBase64: oversized })] },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(/per-file limit/);
    expect(captured).toHaveLength(0);
  });

  it('rejects a batch over the per-call size cap even when each file fits', async () => {
    const { client, captured } = uploadClient([]);
    // Four 4MB files: each under the 5MB per-file cap, together over the 15MB call cap.
    const chunk = Buffer.alloc(4 * 1024 * 1024, 0x41).toString('base64');
    const result = await run(
      {
        chargeId: CHARGE,
        documents: Array.from({ length: 4 }, (_, i) =>
          doc({ filename: `f${i}.pdf`, contentBase64: chunk }),
        ),
      },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(
      new RegExp(`${MAX_TOTAL_DOCUMENT_BYTES / 1024 / 1024}MB per-call limit`),
    );
    expect(captured).toHaveLength(0);
  });
});

describe('uploadDocumentsTool — result mapping', () => {
  it('reports per-file outcomes positionally when the batch partially fails', async () => {
    const { client } = uploadClient([
      ok('d1'),
      { __typename: 'CommonError', message: 'OCR failed' },
      ok('d3', null),
    ]);
    const result = await run(
      {
        chargeId: CHARGE,
        documents: [
          doc({ filename: 'a.pdf' }),
          doc({ filename: 'b.pdf' }),
          doc({ filename: 'c.pdf' }),
        ],
      },
      client,
    );

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      ok: boolean;
      uploadedCount: number;
      failedCount: number;
      isSensitive: boolean;
      results: Array<Record<string, unknown>>;
    };

    expect(structured.ok).toBe(true);
    expect(structured.uploadedCount).toBe(2);
    expect(structured.failedCount).toBe(1);
    expect(structured.isSensitive).toBe(true);
    // The failure is tied to the file it belongs to, so the model knows which
    // one it still has to deal with.
    expect(structured.results[1]).toMatchObject({
      filename: 'b.pdf',
      status: 'failed',
      message: 'OCR failed',
    });
    expect(structured.results[0]).toMatchObject({
      filename: 'a.pdf',
      status: 'uploaded',
      documentId: 'd1',
    });
    expect(result.content[0].text).toMatch(/1 failed/);
  });
});

describe('uploadDocumentsTool — policy', () => {
  it('refuses an ambiguous write target', async () => {
    const { client, captured } = uploadClient([]);
    const result = await run({ chargeId: CHARGE, documents: [doc()] }, client, authContext([B1, B2]));

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; message: string };
    expect(structured.code).toBe('AUTHORIZATION_ERROR');
    expect(structured.message).toMatch(/exactly one business/);
    expect(captured).toHaveLength(0);
  });

  it('accepts a multi-member caller who names the target business', async () => {
    const { client, captured } = uploadClient([ok('d1')]);
    const result = await run(
      { memberBusinessId: B2, chargeId: CHARGE, documents: [doc()] },
      client,
      authContext([B1, B2]),
    );

    expect(result.isError).toBeUndefined();
    expect(captured[0].headers['x-business-scope']).toBe(B2);
  });

  it('denies a caller holding neither required role', async () => {
    const { client } = uploadClient([]);
    const result = await run(
      { chargeId: CHARGE, documents: [doc()] },
      client,
      authContext([B1], 'viewer'),
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });
});
