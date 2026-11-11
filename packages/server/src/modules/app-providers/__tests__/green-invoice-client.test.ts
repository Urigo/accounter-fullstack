import { describe, expect, it, vi } from 'vitest';
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

const { GreenInvoiceClientProvider } = await import('../green-invoice-client.js');
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
