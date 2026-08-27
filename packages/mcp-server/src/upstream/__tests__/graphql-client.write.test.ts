import { describe, expect, it, vi } from 'vitest';
import {
  BUSINESS_SCOPE_HEADER,
  UpstreamError,
  UpstreamGraphQLClient,
  type UploadFile,
  type UpstreamRequestContext,
} from '../graphql-client.js';

/**
 * The write half of the upstream client. The read half (`query`) is covered in
 * `graphql-client.test.ts`; what is specific here is that the two halves cannot
 * be used for each other's traffic, that a write is never retried, and that the
 * multipart envelope is assembled to spec.
 */

const CONTEXT: UpstreamRequestContext = {
  correlationId: 'corr-1',
  authorization: 'Bearer t',
  businessScope: ['b1'],
};

const MUTATION = /* GraphQL */ `
  mutation McpDoThing($id: UUID!) {
    doThing(id: $id) {
      id
    }
  }
`;

function clientWith(fetchImpl: unknown, maxRetries?: number) {
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    ...(maxRetries === undefined ? {} : { maxRetries }),
    fetchImpl: fetchImpl as typeof fetch,
  });
}

const okFetch = (data: unknown = { doThing: { id: '1' } }) =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data }) }) as unknown as Response);

const file = (overrides: Partial<UploadFile> = {}): UploadFile => ({
  variablePath: 'variables.documents.0',
  filename: 'a.pdf',
  contentType: 'application/pdf',
  content: new TextEncoder().encode('hello'),
  ...overrides,
});

describe('assertSingleMutation (via mutate)', () => {
  it.each([
    ['a query document', 'query McpThing { thing { id } }'],
    ['a subscription', 'subscription McpThing { thing { id } }'],
    [
      'a mutation hidden behind a leading query',
      'query McpRead { thing { id } }\nmutation McpWrite { doThing { id } }',
    ],
    [
      'two mutations in one document',
      'mutation McpA { a { id } }\nmutation McpB { b { id } }',
    ],
    ['a commented-out mutation with a real query', '# mutation McpFake\nquery McpReal { a }'],
  ])('refuses %s', async (_label, document) => {
    const fetchImpl = okFetch();
    await expect(clientWith(fetchImpl).mutate({ query: document }, CONTEXT)).rejects.toThrow(
      UpstreamError,
    );
    // Rejected before any network call — the guard is not a post-hoc check.
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts a single top-level mutation', async () => {
    const fetchImpl = okFetch();
    await expect(
      clientWith(fetchImpl).mutate({ query: MUTATION, variables: { id: '1' } }, CONTEXT),
    ).resolves.toEqual({ doThing: { id: '1' } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('still refuses a mutation on the read path', async () => {
    const fetchImpl = okFetch();
    await expect(clientWith(fetchImpl).query({ query: MUTATION }, CONTEXT)).rejects.toThrow(
      /read-only/,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('mutate — no retries', () => {
  it('does not retry a 5xx, which a read would retry', async () => {
    const fetchImpl = vi.fn(
      async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response,
    );
    const client = clientWith(fetchImpl, 2);

    await expect(client.mutate({ query: MUTATION }, CONTEXT)).rejects.toThrow(UpstreamError);
    // A write may already have applied upstream; re-sending could double-apply.
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Contrast: the same client retries a read failure up to maxRetries.
    fetchImpl.mockClear();
    await expect(client.query({ query: 'query McpX { x }' }, CONTEXT)).rejects.toThrow(
      UpstreamError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not retry a network failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(clientWith(fetchImpl, 2).mutate({ query: MUTATION }, CONTEXT)).rejects.toThrow(
      UpstreamError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('mutateMultipart', () => {
  it('builds an operations/map/parts form to the multipart request spec', async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      captured = init;
      return { ok: true, status: 200, json: async () => ({ data: { ok: true } }) } as unknown as Response;
    });

    await clientWith(fetchImpl).mutateMultipart(
      { query: MUTATION, variables: { documents: [null, null] } },
      [file({ filename: 'a.pdf' }), file({ variablePath: 'variables.documents.1', filename: 'b.png', contentType: 'image/png' })],
      CONTEXT,
    );

    const form = captured!.body as FormData;
    expect(JSON.parse(String(form.get('map')))).toEqual({
      '0': ['variables.documents.0'],
      '1': ['variables.documents.1'],
    });
    const operations = JSON.parse(String(form.get('operations'))) as {
      query: string;
      variables: Record<string, unknown>;
    };
    expect(operations.query).toBe(MUTATION);
    expect(operations.variables.documents).toEqual([null, null]);

    const part0 = form.get('0') as File;
    expect(part0.name).toBe('a.pdf');
    expect(part0.type).toBe('application/pdf');
    expect(new TextDecoder().decode(await part0.arrayBuffer())).toBe('hello');
    expect((form.get('1') as File).type).toBe('image/png');
  });

  it('leaves Content-Type unset so FormData supplies the boundary', async () => {
    let captured: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      captured = init;
      return { ok: true, status: 200, json: async () => ({ data: {} }) } as unknown as Response;
    });

    await clientWith(fetchImpl).mutateMultipart(
      { query: MUTATION, variables: { documents: [null] } },
      [file()],
      CONTEXT,
    );

    const headers = captured!.headers as Record<string, string>;
    expect(Object.keys(headers).map(k => k.toLowerCase())).not.toContain('content-type');
    // The identity/tracing/scope headers still ride along.
    expect(headers.Authorization).toBe('Bearer t');
    expect(headers['X-Correlation-Id']).toBe('corr-1');
    expect(headers[BUSINESS_SCOPE_HEADER]).toBe('b1');
  });

  it('refuses a non-mutation document', async () => {
    const fetchImpl = okFetch();
    await expect(
      clientWith(fetchImpl).mutateMultipart({ query: 'query McpX { x }' }, [file()], CONTEXT),
    ).rejects.toThrow(UpstreamError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('omits the scope header entirely when the scope is empty', async () => {
    // Upstream reads an absent header as "all memberships"; an empty one would
    // mean the opposite, so it must never be sent.
    let captured: RequestInit | undefined;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      captured = init;
      return { ok: true, status: 200, json: async () => ({ data: {} }) } as unknown as Response;
    });

    await clientWith(fetchImpl).mutateMultipart(
      { query: MUTATION, variables: { documents: [null] } },
      [file()],
      { correlationId: 'c', businessScope: [] },
    );

    expect(captured!.headers as Record<string, string>).not.toHaveProperty(BUSINESS_SCOPE_HEADER);
  });

  it('sanitizes a GraphQL-level error rather than leaking it', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ errors: [{ message: 'relation "documents" does not exist' }] }),
        }) as unknown as Response,
    );

    await expect(
      clientWith(fetchImpl).mutateMultipart(
        { query: MUTATION, variables: { documents: [null] } },
        [file()],
        CONTEXT,
      ),
    ).rejects.toThrow(UpstreamError);
  });
});

describe('body construction failures', () => {
  it('leaves no live timer when building the body throws', async () => {
    // Regression guard: the body used to be built after the timeout was armed
    // but outside the try/finally that clears it, so a build failure leaked a
    // pending timer that held the event loop open for the whole budget.
    const fetchImpl = okFetch();
    const client = new UpstreamGraphQLClient({
      endpoint: 'http://localhost:4000/graphql',
      timeoutMs: 60_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(
      client.mutate({ query: MUTATION, variables: { circular } }, CONTEXT),
    ).rejects.toThrow();

    // Nothing was armed at all, so there is nothing left to clear.
    expect(setTimeoutSpy).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it('clears the timer on a successful call', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    await clientWith(okFetch()).mutate({ query: MUTATION, variables: { id: '1' } }, CONTEXT);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});

describe('long-running writes', () => {
  /** A fetch that never answers until its signal aborts. */
  const hangingFetch = () =>
    vi.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise<Response>((_, reject) => {
          init.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );

  it('gives a long-running write the larger budget', async () => {
    // Document ingestion downloads the file, uploads it to Cloudinary and OCRs
    // it before upstream writes anything. On the ordinary budget — sized for a
    // database read — the client gave up mid-upload every time while upstream
    // carried on working, and the caller saw nothing but timeouts.
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const client = new UpstreamGraphQLClient({
      endpoint: 'http://localhost:4000/graphql',
      timeoutMs: 1000,
      longRunningTimeoutMs: 300_000,
      fetchImpl: okFetch() as unknown as typeof fetch,
    });

    await client.mutate({ query: MUTATION, variables: { id: '1' } }, CONTEXT, {
      longRunning: true,
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 300_000);
    setTimeoutSpy.mockRestore();
  });

  it('keeps the ordinary budget for a write that does not ask for more', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const client = new UpstreamGraphQLClient({
      endpoint: 'http://localhost:4000/graphql',
      timeoutMs: 1000,
      longRunningTimeoutMs: 300_000,
      fetchImpl: okFetch() as unknown as typeof fetch,
    });

    await client.mutate({ query: MUTATION, variables: { id: '1' } }, CONTEXT);

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    setTimeoutSpy.mockRestore();
  });

  it('reports a timed-out write as NOT retryable, and says to verify first', async () => {
    // Giving up says nothing about what upstream did with the write. Advertising
    // it as retryable invites the caller to send it again and duplicate whatever
    // did land — the upload that started this was sent five times over.
    const client = new UpstreamGraphQLClient({
      endpoint: 'http://localhost:4000/graphql',
      timeoutMs: 5,
      fetchImpl: hangingFetch() as unknown as typeof fetch,
    });

    const error = await client
      .mutate({ query: MUTATION, variables: { id: '1' } }, CONTEXT)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UpstreamError);
    expect((error as UpstreamError).code).toBe('TIMEOUT_ERROR');
    expect((error as UpstreamError).retryable).toBe(false);
    expect((error as UpstreamError).message).toMatch(/may still be in progress/i);
  });
});
