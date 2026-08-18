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

  it('pins isSensitive to false and forwards the chargeId', async () => {
    const { client, captured } = uploadClient([ok('d1')]);
    await run({ chargeId: CHARGE, documents: [doc()] }, client);

    expect(captured[0].operations.variables).toMatchObject({
      chargeId: CHARGE,
      isSensitive: false,
    });
  });

  it('rejects a caller-supplied isSensitive — it is not part of the schema', async () => {
    const { client, captured } = uploadClient([ok('d1')]);
    const result = await run(
      { chargeId: CHARGE, documents: [doc()], isSensitive: true },
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
    // Three 200KB files: each comfortably under the per-file cap, together over
    // the per-call one — so this exercises the total check, not the per-file one.
    const each = 200 * 1024;
    expect(each).toBeLessThan(MAX_DOCUMENT_BYTES);
    expect(each * 3).toBeGreaterThan(MAX_TOTAL_DOCUMENT_BYTES);
    const chunk = Buffer.alloc(each, 0x41).toString('base64');
    const result = await run(
      {
        chargeId: CHARGE,
        documents: Array.from({ length: 3 }, (_, i) =>
          doc({ filename: `f${i}.pdf`, contentBase64: chunk }),
        ),
      },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { message: string }).message).toMatch(/per-call/);
    expect(captured).toHaveLength(0);
  });

  it('tells an over-size caller what to do instead of shrinking the file', async () => {
    // The failure mode this guards against is not a wrong error code — it is the
    // model "helpfully" re-rendering a tax receipt at lower quality until it
    // fits, and archiving the degraded copy as the financial record.
    const { client } = uploadClient([]);
    const oversized = Buffer.alloc(MAX_DOCUMENT_BYTES + 1, 0x41).toString('base64');
    const result = await run(
      { chargeId: CHARGE, documents: [doc({ contentBase64: oversized })] },
      client,
    );

    const message = (result.structuredContent as { message: string }).message;
    expect(message).toMatch(/Do NOT downscale, re-encode, or reduce the quality/);
    expect(message).toMatch(/Google Drive/);
    expect(message).toMatch(/email/);
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
    expect(structured.isSensitive).toBe(false);
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

/**
 * The URL branch is the one that makes the tool usable for real files: the
 * server fetches the bytes, so nothing about the document passes through the
 * model and none of the inline size caps apply. What matters here is that the
 * two branches stay mutually exclusive and that the URL branch takes the plain
 * JSON mutation rather than the multipart one.
 */
describe('uploadDocumentsTool — documentUrls', () => {
  interface CapturedJson {
    query: string;
    variables: Record<string, unknown>;
    headers: Record<string, string>;
  }

  function urlClient(responses: unknown[]) {
    const captured: CapturedJson[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      captured.push({
        query: body.query,
        variables: body.variables,
        headers: init.headers as Record<string, string>,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { batchUploadDocumentsFromUrls: responses } }),
      } as unknown as Response;
    });
    const client = new UpstreamGraphQLClient({
      endpoint: 'http://localhost:4000/graphql',
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    return { client, captured };
  }

  const DRIVE_URL = 'https://drive.google.com/file/d/abc123/view';

  it('sends the URLs as a plain JSON mutation, not multipart', async () => {
    const { client, captured } = urlClient([ok('d1')]);
    const result = await run({ chargeId: CHARGE, documentUrls: [DRIVE_URL] }, client);

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
    expect(captured[0].query).toContain('batchUploadDocumentsFromUrls');
    expect(captured[0].variables).toMatchObject({
      urls: [DRIVE_URL],
      chargeId: CHARGE,
      isSensitive: false,
    });
    expect(captured[0].headers['content-type'] ?? captured[0].headers['Content-Type']).toContain(
      'application/json',
    );
  });

  it('reports each URL positionally, so a partial failure names the URL that failed', async () => {
    const { client } = urlClient([
      ok('d1'),
      { __typename: 'CommonError', message: 'https://example.com/b.pdf: HTTP 404' },
    ]);
    const result = await run(
      { chargeId: CHARGE, documentUrls: [DRIVE_URL, 'https://example.com/b.pdf'] },
      client,
    );

    const structured = result.structuredContent as {
      source: string;
      uploadedCount: number;
      failedCount: number;
      results: Array<Record<string, unknown>>;
    };
    expect(structured.source).toBe('urls');
    expect(structured.uploadedCount).toBe(1);
    expect(structured.failedCount).toBe(1);
    // Labelled `url`, not `filename` — the caller never supplied a filename here.
    expect(structured.results[0]).toMatchObject({ url: DRIVE_URL, status: 'uploaded' });
    expect(structured.results[1]).toMatchObject({
      url: 'https://example.com/b.pdf',
      status: 'failed',
    });
  });

  it('applies no size limit to the URL branch', async () => {
    // A URL list far past what any inline payload could carry is still fine:
    // the bytes are the server's problem, not the model's.
    const { client, captured } = urlClient([ok('d1')]);
    const long = `https://example.com/${'a'.repeat(1900)}.pdf`;
    const result = await run({ chargeId: CHARGE, documentUrls: [long] }, client);

    expect(result.isError).toBeUndefined();
    expect(captured[0].variables.urls).toEqual([long]);
  });

  it('rejects a call carrying both documentUrls and documents', async () => {
    const { client, captured } = urlClient([]);
    const result = await run(
      { chargeId: CHARGE, documentUrls: [DRIVE_URL], documents: [doc()] },
      client,
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('rejects a call carrying neither', async () => {
    const { client, captured } = urlClient([]);
    const result = await run({ chargeId: CHARGE }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('rejects a non-URL string', async () => {
    const { client, captured } = urlClient([]);
    const result = await run({ chargeId: CHARGE, documentUrls: ['/tmp/invoice.pdf'] }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
    expect(captured).toHaveLength(0);
  });

  it('audits the call without logging the URLs, which can carry access tokens', async () => {
    const { client } = urlClient([ok('d1')]);
    const lines: string[] = [];
    const write = vi.spyOn(console, 'log').mockImplementation(line => void lines.push(String(line)));
    try {
      await run(
        { chargeId: CHARGE, documentUrls: ['https://example.com/secret?token=hunter2'] },
        client,
      );
    } finally {
      write.mockRestore();
    }

    const audit = lines.find(line => line.includes('"audit":true'));
    expect(audit).toBeDefined();
    expect(audit).toContain('"documentUrlsCount":1');
    expect(audit).not.toContain('hunter2');
  });
});
