import { GraphQLError } from 'graphql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Environment } from '../../../shared/types/index.js';
import type { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import type { ProviderCredentialsProvider } from '../../provider-credentials/providers/provider-credentials.provider.js';

const { createGreenInvoiceSdkMock } = vi.hoisted(() => ({
  createGreenInvoiceSdkMock: vi.fn(() => ({})),
}));

vi.mock('@accounter/green-invoice-graphql', async importOriginal => ({
  ...(await importOriginal<typeof import('@accounter/green-invoice-graphql')>()),
  createGreenInvoiceSdk: createGreenInvoiceSdkMock,
}));

const { GreenInvoiceClientProvider, upstreamErrorDetails } = await import(
  '../green-invoice-client.js'
);
const { GreenInvoiceTokenCacheProvider } = await import('../green-invoice-token-cache.js');

describe('GreenInvoiceClientProvider', () => {
  it('builds the SDK with the token-cache epoch read before the credentials', async () => {
    const tokenCache = new GreenInvoiceTokenCacheProvider();
    const epochBefore = tokenCache.epoch;
    const credentialsProvider = {
      // the credentials are removed or replaced by another operation while they are being read
      getGreenInvoiceCredentials: vi.fn(async () => {
        tokenCache.invalidate('gi-id');
        return { id: 'gi-id', secret: 'gi-secret' };
      }),
    } as unknown as ProviderCredentialsProvider;

    const provider = new GreenInvoiceClientProvider(
      {} as AdminContextProvider,
      {} as Environment,
      credentialsProvider,
      tokenCache,
    );
    await provider.getSDK();

    expect(tokenCache.epoch).toBeGreaterThan(epochBefore);
    expect(createGreenInvoiceSdkMock).toHaveBeenCalledExactlyOnceWith({
      id: 'gi-id',
      secret: 'gi-secret',
      tokenCache,
      epoch: epochBefore,
    });
  });
});

/** What `@graphql-mesh/transport-rest` throws for a non-2xx response. */
function upstreamHttpError(status: number, body: unknown) {
  return new GraphQLError(
    `Upstream HTTP Error: ${status}, Could not invoke operation PUT /clients/{args.id}`,
    {
      extensions: {
        code: 'DOWNSTREAM_SERVICE_ERROR',
        request: { url: 'https://api.greeninvoice.co.il/api/v1/clients/gi-1', method: 'PUT' },
        response: { status, statusText: 'Bad Request', headers: {}, body },
      },
    },
  );
}

describe('upstreamErrorDetails', () => {
  it("reads the status and Green Invoice's own code and message", () => {
    const error = upstreamHttpError(400, { errorCode: 1110, errorMessage: 'Invalid tax id' });

    expect(upstreamErrorDetails(error)).toEqual({
      status: 400,
      upstreamCode: 1110,
      upstreamMessage: 'Invalid tax id',
    });
  });

  it('finds the response inside an AggregateError and through a cause', () => {
    const inner = upstreamHttpError(400, { errorCode: 1110, errorMessage: 'Invalid tax id' });
    const wrapped = new Error('wrapped', { cause: new AggregateError([new Error('other'), inner]) });

    expect(upstreamErrorDetails(wrapped)?.upstreamMessage).toBe('Invalid tax id');
  });

  it('masks client data and caps the upstream message', () => {
    const error = upstreamHttpError(400, {
      errorCode: 1110,
      errorMessage: `Tax id 512345678 already used by client@example.com ${'x'.repeat(300)}`,
    });

    const message = upstreamErrorDetails(error)?.upstreamMessage ?? '';

    expect(message).toMatch(/^Tax id \[number\] already used by \[email\] x+…$/);
    expect(message).not.toContain('512345678');
    expect(message.length).toBeLessThanOrEqual(201);
  });

  it('is null for an error with no upstream response', () => {
    expect(upstreamErrorDetails(new Error('fetch failed'))).toBeNull();
  });
});

describe('GreenInvoiceClientProvider failures', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a failed client update once, with the upstream reason and no response body', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    createGreenInvoiceSdkMock.mockReturnValueOnce({
      updateClient_mutation: vi.fn(async () => {
        throw upstreamHttpError(400, {
          errorCode: 1110,
          errorMessage: 'Invalid tax id',
          echoed: 'client details',
        });
      }),
    } as never);
    const provider = new GreenInvoiceClientProvider(
      {} as AdminContextProvider,
      {} as Environment,
      {
        getGreenInvoiceCredentials: vi.fn(async () => ({ id: 'gi-id', secret: 'gi-secret' })),
      } as unknown as ProviderCredentialsProvider,
      new GreenInvoiceTokenCacheProvider(),
      {
        requestLog: { operationName: 'UpdateClient', requestId: 'req-1' },
      } as unknown as GraphQLModules.GlobalContext,
    );

    await expect(provider.updateClient({ id: 'gi-1', input: { name: 'Client' } })).rejects.toThrow(
      'Green Invoice Update Client error: Invalid tax id',
    );

    const lines = stdout.mock.calls.map(([chunk]) => String(chunk));
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('client details');
    expect(JSON.parse(lines[0])).toMatchObject({
      msg: 'green-invoice-call-failed',
      level: 'error',
      greenInvoiceCall: 'updateClient',
      greenInvoiceClientId: 'gi-1',
      status: 400,
      upstreamCode: 1110,
      upstreamMessage: 'Invalid tax id',
      operationName: 'UpdateClient',
      requestId: 'req-1',
    });
  });
});
