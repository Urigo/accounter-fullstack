import { GraphQLError } from 'graphql';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import { QueryResult, QueryResultRow } from 'pg';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { Environment } from '../../../../shared/types/index.js';
import { encryptCredential } from '../../helpers/encryption.js';
import { ProviderCredentialsProvider } from '../provider-credentials.provider.js';

type QueryResultWithRows<T extends QueryResultRow = QueryResultRow> = QueryResult<T> & {
  rowCount: number;
};

const TEST_KEY = 'a'.repeat(64);
const env = { credentialsEncryptionKey: TEST_KEY } as unknown as Environment;

describe('ProviderCredentialsProvider', () => {
  let provider: ProviderCredentialsProvider;
  let db: Mocked<TenantAwareDBClient>;

  beforeEach(() => {
    db = {
      pool: { query: vi.fn() },
      healthCheck: vi.fn(),
      query: vi.fn(),
    } as unknown as Mocked<TenantAwareDBClient>;

    provider = new ProviderCredentialsProvider(db, env);
  });

  describe('setCredentials', () => {
    it('calls db.query once with INSERT and provider_credentials; payload is encrypted', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 0 } as unknown as QueryResultWithRows);

      const validPayload = { id: 'my-id', secret: 'my-secret' };
      await provider.setCredentials('green_invoice', validPayload);

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/INSERT/i);
      expect(sql).toMatch(/provider_credentials/i);
      // The encrypted blob should not equal the plaintext
      expect(params[1]).not.toContain('my-secret');
    });

    it('throws GraphQLError BAD_USER_INPUT and does not call db.query when payload is invalid', async () => {
      await expect(
        provider.setCredentials('green_invoice', { id: '' }),
      ).rejects.toThrow(GraphQLError);

      let thrownError: GraphQLError | undefined;
      try {
        await provider.setCredentials('green_invoice', { id: '' });
      } catch (err) {
        thrownError = err as GraphQLError;
      }

      expect(thrownError?.extensions?.code).toBe('BAD_USER_INPUT');
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('getProviderStatuses', () => {
    it('returns array of { provider, configuredAt } without payload field', async () => {
      const now = new Date();
      db.query.mockResolvedValue({
        rows: [
          { provider: 'green_invoice', updated_at: now },
          { provider: 'deel', updated_at: now },
        ],
        rowCount: 2,
      } as unknown as QueryResultWithRows);

      const statuses = await provider.getProviderStatuses();

      expect(statuses).toHaveLength(2);
      expect(statuses[0]).toEqual({ provider: 'green_invoice', configuredAt: now.toISOString() });
      expect(statuses[1]).toEqual({ provider: 'deel', configuredAt: now.toISOString() });
      for (const s of statuses) {
        expect(s).not.toHaveProperty('payload');
      }
    });
  });

  describe('getGreenInvoiceCredentials', () => {
    it('returns null when no row exists', async () => {
      db.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      } as unknown as QueryResultWithRows);

      const result = await provider.getGreenInvoiceCredentials();
      expect(result).toBeNull();
    });

    it('returns decrypted payload when a valid encrypted row exists', async () => {
      const original = { id: 'gi-id', secret: 'gi-secret' };
      const blob = encryptCredential(JSON.stringify(original), TEST_KEY);
      db.query.mockResolvedValue({
        rows: [{ payload: blob }],
        rowCount: 1,
      } as unknown as QueryResultWithRows);

      const result = await provider.getGreenInvoiceCredentials();
      expect(result).toEqual(original);
    });
  });

  describe('deleteCredentials', () => {
    it('calls db.query with a DELETE statement', async () => {
      db.query.mockResolvedValue({ rows: [], rowCount: 1 } as unknown as QueryResultWithRows);

      await provider.deleteCredentials('deel');

      expect(db.query).toHaveBeenCalledTimes(1);
      const [sql] = db.query.mock.calls[0] as [string, unknown[]];
      expect(sql).toMatch(/DELETE/i);
    });
  });
});
