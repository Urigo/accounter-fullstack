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
const DEEL_BUSINESS_ID = '8d34f668-7233-4ce3-9c9c-82550b0839ff';

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

  /** Answer the ownership check and the UPDATE; everything else returns no rows */
  function mockQueries(answers: { isOwn?: boolean; updatedRows?: unknown[] }) {
    db.query.mockImplementation((async (sql: string) => {
      if (/isOwn/.test(sql)) {
        return { rows: [{ isOwn: answers.isOwn ?? false }], rowCount: 1 };
      }
      if (/^\s*UPDATE/i.test(sql)) {
        const rows = answers.updatedRows ?? [];
        return { rows, rowCount: rows.length };
      }
      return { rows: [], rowCount: 0 };
    }) as unknown as typeof db.query);
  }

  function callsMatching(pattern: RegExp) {
    return (db.query.mock.calls as unknown as Array<[string, unknown[]]>).filter(([sql]) =>
      pattern.test(sql),
    );
  }

  function upsertCalls() {
    return callsMatching(/INSERT INTO accounter_schema\.provider_credentials/);
  }

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

    it('keeps an existing business_id unless a new one is given', async () => {
      mockQueries({ isOwn: true });

      await provider.setCredentials('deel', { apiToken: 'token' });
      const [sql, params] = upsertCalls()[0];
      expect(sql).toMatch(/COALESCE\(EXCLUDED\.business_id, provider_credentials\.business_id\)/);
      expect(params).not.toContain(DEEL_BUSINESS_ID);

      await provider.setCredentials('deel', { apiToken: 'token' }, { businessId: DEEL_BUSINESS_ID });
      expect(upsertCalls()[1][1]).toContain(DEEL_BUSINESS_ID);
    });

    it("refuses a business that doesn't belong to the workspace", async () => {
      mockQueries({ isOwn: false });

      const error = await provider
        .setCredentials('deel', { apiToken: 'token' }, { businessId: DEEL_BUSINESS_ID })
        .catch(e => e);

      expect((error as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
      expect(upsertCalls()).toHaveLength(0);
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
          { provider: 'green_invoice', updated_at: now, business_id: null },
          { provider: 'deel', updated_at: now, business_id: DEEL_BUSINESS_ID },
        ],
        rowCount: 2,
      } as unknown as QueryResultWithRows);

      const statuses = await provider.getProviderStatuses();

      expect(statuses).toHaveLength(2);
      expect(statuses[0]).toEqual({
        provider: 'green_invoice',
        configuredAt: now.toISOString(),
        businessId: null,
      });
      expect(statuses[1]).toEqual({
        provider: 'deel',
        configuredAt: now.toISOString(),
        businessId: DEEL_BUSINESS_ID,
      });
      for (const s of statuses) {
        expect(s).not.toHaveProperty('payload');
      }
    });

    it('reads the statuses once per operation, and again after credentials change', async () => {
      db.query.mockResolvedValue({
        rows: [{ provider: 'deel', updated_at: new Date(), business_id: DEEL_BUSINESS_ID }],
        rowCount: 1,
      } as unknown as QueryResultWithRows);

      await provider.getProviderStatuses();
      await provider.getProviderStatuses();
      expect(db.query).toHaveBeenCalledTimes(1);

      await provider.deleteCredentials('deel');
      await provider.getProviderStatuses();
      expect(db.query).toHaveBeenCalledTimes(3);
    });

    it('does not cache a failed read', async () => {
      db.query.mockRejectedValueOnce(new Error('connection reset'));
      await expect(provider.getProviderStatuses()).rejects.toThrow('connection reset');

      db.query.mockResolvedValue({ rows: [], rowCount: 0 } as unknown as QueryResultWithRows);
      await expect(provider.getProviderStatuses()).resolves.toEqual([]);
    });
  });

  describe('setProviderBusiness', () => {
    it('updates business_id of the connected provider', async () => {
      const updatedAt = new Date();
      mockQueries({ isOwn: true, updatedRows: [{ updated_at: updatedAt }] });

      await expect(provider.setProviderBusiness('deel', DEEL_BUSINESS_ID)).resolves.toBe(
        updatedAt,
      );
      const [sql, params] = callsMatching(/UPDATE/i)[0];
      expect(sql).toMatch(/business_id/i);
      expect(params).toContain(DEEL_BUSINESS_ID);
    });

    it('clears the business with null, without an ownership check', async () => {
      mockQueries({ updatedRows: [{ updated_at: new Date() }] });

      await provider.setProviderBusiness('deel', null);

      expect(callsMatching(/isOwn/)).toHaveLength(0);
      expect(callsMatching(/UPDATE/i)[0][1]).toContain(null);
    });

    it("refuses a business that doesn't belong to the workspace", async () => {
      mockQueries({ isOwn: false });

      const error = await provider.setProviderBusiness('deel', DEEL_BUSINESS_ID).catch(e => e);

      expect((error as GraphQLError).extensions.code).toBe('BAD_USER_INPUT');
      expect(callsMatching(/UPDATE/i)).toHaveLength(0);
    });

    it('throws NOT_FOUND when the provider is not connected', async () => {
      mockQueries({ isOwn: true, updatedRows: [] });

      const error = await provider.setProviderBusiness('deel', DEEL_BUSINESS_ID).catch(e => e);
      expect(error).toBeInstanceOf(GraphQLError);
      expect((error as GraphQLError).extensions.code).toBe('NOT_FOUND');
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
