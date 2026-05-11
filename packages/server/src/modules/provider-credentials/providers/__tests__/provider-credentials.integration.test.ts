import { describe, expect, it, vi, type Mocked } from 'vitest';
import { encryptCredential } from '../../helpers/encryption.js';
import { ProviderCredentialsProvider } from '../provider-credentials.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { Environment } from '../../../../shared/types/index.js';

const TEST_KEY = 'a'.repeat(64);
const env = { credentialsEncryptionKey: TEST_KEY } as unknown as Environment;

function createProvider() {
  const query = vi.fn();

  const db = { query } as unknown as Mocked<TenantAwareDBClient>;

  return {
    provider: new ProviderCredentialsProvider(db, env),
    query,
  };
}

describe('ProviderCredentialsProvider integration', () => {
  it('write + read round-trip: encrypts on set, decrypts on get', async () => {
    const { provider, query } = createProvider();

    const original = { id: 'gi-id', secret: 'gi-secret' };

    // setCredentials writes to DB
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await provider.setCredentials('green_invoice', original);

    // Capture the encrypted blob that was stored
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    const encryptedBlob = params[1] as string;

    // getGreenInvoiceCredentials reads from DB — return the encrypted blob
    query.mockResolvedValueOnce({ rows: [{ payload: encryptedBlob }], rowCount: 1 });
    const result = await provider.getGreenInvoiceCredentials();

    expect(result).toEqual(original);
  });

  it('tenant isolation: concurrent providers return only their own data', async () => {
    const blobA = encryptCredential(JSON.stringify({ id: 'a-id', secret: 'a-secret' }), TEST_KEY);
    const blobB = encryptCredential(JSON.stringify({ id: 'b-id', secret: 'b-secret' }), TEST_KEY);

    const { provider: providerA, query: queryA } = createProvider();
    const { provider: providerB, query: queryB } = createProvider();

    queryA.mockResolvedValueOnce({ rows: [{ payload: blobA }], rowCount: 1 });
    queryB.mockResolvedValueOnce({ rows: [{ payload: blobB }], rowCount: 1 });

    const [resultA, resultB] = await Promise.all([
      providerA.getGreenInvoiceCredentials(),
      providerB.getGreenInvoiceCredentials(),
    ]);

    expect(resultA).toEqual({ id: 'a-id', secret: 'a-secret' });
    expect(resultB).toEqual({ id: 'b-id', secret: 'b-secret' });
  });

  it('delete followed by get returns null', async () => {
    const { provider, query } = createProvider();

    // deleteCredentials
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await provider.deleteCredentials('green_invoice');

    // getGreenInvoiceCredentials — no row after delete
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await provider.getGreenInvoiceCredentials();

    expect(result).toBeNull();
  });

  it('getProviderStatuses: maps rows to provider + configuredAt ISO string', async () => {
    const { provider, query } = createProvider();
    const now = new Date('2026-01-15T10:30:00.000Z');

    query.mockResolvedValueOnce({
      rows: [{ provider: 'green_invoice', updated_at: now }],
      rowCount: 1,
    });

    const statuses = await provider.getProviderStatuses();

    expect(statuses).toEqual([{ provider: 'green_invoice', configuredAt: now.toISOString() }]);
  });

  it('setCredentials with invalid payload throws BAD_USER_INPUT without calling db', async () => {
    const { provider, query } = createProvider();

    await expect(provider.setCredentials('green_invoice', { id: '' })).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    });

    expect(query).not.toHaveBeenCalled();
  });
});
