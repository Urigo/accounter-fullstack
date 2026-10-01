import { beforeEach, describe, expect, it } from 'vitest';
import { getMeshSDK } from '../mesh-client.js';

type RecordedRequest = { method: string; url: string; authorization: string | null };

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Stands in for the Green Invoice API, recording what the SDK sends */
function createUpstream(routes: Record<string, () => Response>) {
  const requests: RecordedRequest[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    requests.push({
      method: init.method ?? 'GET',
      url: decodeURIComponent(url),
      authorization: new Headers(init.headers).get('authorization'),
    });
    const route = routes[new URL(url).pathname];
    if (!route) {
      throw new Error(`Unexpected upstream request: ${url}`);
    }
    return route();
  }) as unknown as typeof fetch;
  return { requests, fetchFn };
}

describe('getMeshSDK', () => {
  let upstream: ReturnType<typeof createUpstream>;

  beforeEach(() => {
    upstream = createUpstream({
      [`/api/v1/clients/${CLIENT_ID}`]: () =>
        jsonResponse({ id: CLIENT_ID, name: 'ACME', country: 'IL' }),
      '/api/v1/clients/missing': () => jsonResponse({ errorMessage: 'Not found' }, 404),
      '/api/v1/documents/doc-1/linked': () => jsonResponse({ id: 'doc-2', type: 305, amount: 117 }),
      '/api/v1/expenses/drafts/search': () =>
        jsonResponse({ errorCode: 2404, errorMessage: 'No drafts found' }, 404),
      '/file-upload/v1/url': () =>
        jsonResponse({ url: 'https://upload.example', fields: { key: 'k', 'X-Amz-Date': '1' } }),
      '/open-banking/v2/transactions': () => jsonResponse({ total: 0, results: [] }),
    });
  });

  it('sends the context token and fills path arguments', async () => {
    const sdk = getMeshSDK({ authToken: 'token-a', fetch: upstream.fetchFn });

    const { getClient } = await sdk.getClient_query({ id: CLIENT_ID });

    expect(getClient).toMatchObject({ id: CLIENT_ID, name: 'ACME', country: 'IL' });
    expect(upstream.requests).toEqual([
      {
        method: 'GET',
        url: `https://api.greeninvoice.co.il/api/v1/clients/${CLIENT_ID}`,
        authorization: 'Bearer token-a',
      },
    ]);
  });

  it('keeps each context isolated when SDKs run concurrently', async () => {
    await Promise.all([
      getMeshSDK({ authToken: 'token-a', fetch: upstream.fetchFn }).getClient_query({
        id: CLIENT_ID,
      }),
      getMeshSDK({ authToken: 'token-b', fetch: upstream.fetchFn }).getClient_query({
        id: CLIENT_ID,
      }),
    ]);

    expect(upstream.requests.map(request => request.authorization).sort()).toEqual([
      'Bearer token-a',
      'Bearer token-b',
    ]);
  });

  it('encodes query strings as configured per operation', async () => {
    const sdk = getMeshSDK({ authToken: 'token-a', fetch: upstream.fetchFn });

    await sdk.getFileUploadUrl_query({ context: 'expense', data: { source: 5 } });
    await sdk.getBankTransactions_query({
      valueDate: { from: '2026-01-01', to: '2026-01-31' },
      from: 0,
      size: 5,
    });

    expect(upstream.requests.map(request => request.url)).toEqual([
      'https://apigw.greeninvoice.co.il/file-upload/v1/url?context=expense&data={"source":5}',
      'https://apigw.greeninvoice.co.il/open-banking/v2/transactions?valueDate[from]=2026-01-01&valueDate[to]=2026-01-31&from=0&size=5',
    ]);
  });

  it('keeps the value mangling that consumers rely on', async () => {
    const sdk = getMeshSDK({ authToken: 'token-a', fetch: upstream.fetchFn });

    const { getLinkedDocuments } = await sdk.getLinkedDocuments_query({ id: 'doc-1' });
    const { getFileUploadUrl } = await sdk.getFileUploadUrl_query({
      context: 'expense',
      data: { source: 5 },
    });

    // numeric enum values become `_<number>` names
    expect(getLinkedDocuments?.type).toBe('_305');
    // dashes in field names become underscores (the server reverses this before uploading)
    expect(getFileUploadUrl?.fields).toMatchObject({ key: 'k', X_Amz_Date: '1' });
  });

  it('maps configured status codes to response types and throws on unmapped errors', async () => {
    const sdk = getMeshSDK({ authToken: 'token-a', fetch: upstream.fetchFn });

    const { searchExpenseDrafts } = await sdk.searchExpenseDrafts_query({
      input: { fromDate: '2026-09-27', toDate: '2026-09-27' },
    });
    expect(searchExpenseDrafts).toEqual({ errorCode: 2404, errorMessage: 'No drafts found' });

    await expect(sdk.getClient_query({ id: 'missing' })).rejects.toThrow('Upstream HTTP Error: 404');
  });
});
