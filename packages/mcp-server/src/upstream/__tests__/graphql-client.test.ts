import { describe, expect, it, vi } from 'vitest';
import {
  createReadOperation,
  UpstreamError,
  UpstreamGraphQLClient,
} from '../graphql-client.js';

const ENDPOINT = 'http://localhost:4000/graphql';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function client(fetchImpl: typeof fetch, maxRetries = 2) {
  return new UpstreamGraphQLClient({ endpoint: ENDPOINT, timeoutMs: 1000, maxRetries, fetchImpl });
}

const ctx = { correlationId: 'corr-1', authorization: 'Bearer tok' };

describe('UpstreamGraphQLClient.query — success & headers', () => {
  it('returns data and propagates correlation id + Authorization', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { charges: [{ id: '1' }] } }));
    const result = await client(fetchImpl as unknown as typeof fetch).query<{
      charges: Array<{ id: string }>;
    }>({ query: 'query Q { charges { id } }' }, ctx);

    expect(result).toEqual({ charges: [{ id: '1' }] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(ENDPOINT);
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['X-Correlation-Id']).toBe('corr-1');
    expect(headers.Authorization).toBe('Bearer tok');
  });

  it('omits Authorization when the context has no token', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { ok: true } }));
    await client(fetchImpl as unknown as typeof fetch).query(
      { query: 'query { ok }' },
      { correlationId: 'c' },
    );
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect('Authorization' in headers).toBe(false);
  });
});

describe('UpstreamGraphQLClient.query — read-only guard', () => {
  it('refuses mutations without calling fetch', async () => {
    const fetchImpl = vi.fn();
    await expect(
      client(fetchImpl as unknown as typeof fetch).query(
        { query: '  mutation M { deleteCharge }' },
        ctx,
      ),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR', retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses subscriptions', async () => {
    const fetchImpl = vi.fn();
    await expect(
      client(fetchImpl as unknown as typeof fetch).query({ query: 'subscription S { x }' }, ctx),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe('UpstreamGraphQLClient.query — timeout & retries', () => {
  it('maps an aborted request to a retryable TIMEOUT_ERROR', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const fetchImpl = vi.fn(async () => {
      throw abortErr;
    });
    await expect(
      client(fetchImpl as unknown as typeof fetch, 0).query({ query: 'query { x }' }, ctx),
    ).rejects.toMatchObject({ code: 'TIMEOUT_ERROR', retryable: true });
  });

  it('retries a 503 up to maxRetries then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: 1 } }));
    const result = await client(fetchImpl as unknown as typeof fetch, 2).query(
      { query: 'query { ok }' },
      ctx,
    );
    expect(result).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 400 (validation/client error)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 400));
    await expect(
      client(fetchImpl as unknown as typeof fetch).query({ query: 'query { x }' }, ctx),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR', retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 401 (auth error)', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 401));
    await expect(
      client(fetchImpl as unknown as typeof fetch).query({ query: 'query { x }' }, ctx),
    ).rejects.toMatchObject({ retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after exhausting retries on persistent 5xx', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 500));
    await expect(
      client(fetchImpl as unknown as typeof fetch, 2).query({ query: 'query { x }' }, ctx),
    ).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

describe('UpstreamGraphQLClient.query — GraphQL errors', () => {
  it('sanitizes GraphQL errors and does not retry them', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ errors: [{ message: 'Charge not found' }, { message: 'Access denied' }] }),
    );
    await expect(
      client(fetchImpl as unknown as typeof fetch).query({ query: 'query { x }' }, ctx),
    ).rejects.toMatchObject({ code: 'UPSTREAM_ERROR', retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws when the response has no data', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    await expect(
      client(fetchImpl as unknown as typeof fetch).query({ query: 'query { x }' }, ctx),
    ).rejects.toMatchObject({ message: 'Upstream returned no data' });
  });
});

describe('createReadOperation', () => {
  it('runs a typed read operation and maps the data', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: { tags: [{ name: 'food' }] } }));
    const listTags = createReadOperation<
      { tags: Array<{ name: string }> },
      Record<string, never>,
      string[]
    >('query Tags { tags { name } }', data => data.tags.map(t => t.name));

    const names = await listTags(client(fetchImpl as unknown as typeof fetch), {}, ctx);
    expect(names).toEqual(['food']);
  });
});
