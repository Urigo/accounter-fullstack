import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connectTestDb } from '../../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../../__tests__/helpers/db-migrations.js';
import type { Environment } from '../../../../shared/types/index.js';
import { DBProvider } from '../../../app-providers/db.provider.js';
import { TenantAwareDBClient } from '../../../app-providers/tenant-db-client.js';
import type { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { ProviderCredentialsProvider } from '../provider-credentials.provider.js';

const TENANT_A = '00000000-0000-0000-0000-0000000c4ed0';
const TENANT_B = '00000000-0000-0000-0000-0000000c4ed1';
const DEEL_BUSINESS_A = '00000000-0000-0000-0000-0000000c4ed2';
const OTHER_DEEL_BUSINESS_A = '00000000-0000-0000-0000-0000000c4ed3';

const env = { credentialsEncryptionKey: 'a'.repeat(64) } as unknown as Environment;

let pool: Pool;

function createProvider(tenantId: string) {
  const authContextProvider = {
    getAuthContext: () =>
      Promise.resolve({
        authType: 'apiKey' as const,
        token: 'test-token',
        tenant: { businessId: tenantId },
        user: {
          userId: 'api-key:test',
          auth0UserId: null,
          email: '',
          roleId: 'admin',
          permissions: [],
          emailVerified: true,
          permissionsVersion: 0,
        },
      }),
  } as unknown as AuthContextProvider;
  const db = new TenantAwareDBClient(new DBProvider(pool), authContextProvider);
  return new ProviderCredentialsProvider(db, env);
}

async function seedBusiness(id: string, ownerId: string | null, name: string) {
  await pool.query(
    `INSERT INTO accounter_schema.financial_entities (id, name, type, owner_id)
     VALUES ($1, $2, 'business', $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, name, ownerId],
  );
  await pool.query(
    `INSERT INTO accounter_schema.businesses (id, owner_id, country)
     VALUES ($1, $2, 'ISR')
     ON CONFLICT (id) DO NOTHING`,
    [id, ownerId ?? id],
  );
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  await seedBusiness(TENANT_A, null, 'provider-business-test-a');
  await seedBusiness(TENANT_B, null, 'provider-business-test-b');
  await seedBusiness(DEEL_BUSINESS_A, TENANT_A, 'Deel');
  await seedBusiness(OTHER_DEEL_BUSINESS_A, TENANT_A, 'Deel (other)');
});

beforeEach(async () => {
  await pool.query('DELETE FROM accounter_schema.provider_credentials WHERE owner_id = ANY($1)', [
    [TENANT_A, TENANT_B],
  ]);
});

afterAll(async () => {
  await pool.query('DELETE FROM accounter_schema.provider_credentials WHERE owner_id = ANY($1)', [
    [TENANT_A, TENANT_B],
  ]);
  for (const id of [OTHER_DEEL_BUSINESS_A, DEEL_BUSINESS_A, TENANT_B, TENANT_A]) {
    await pool.query('DELETE FROM accounter_schema.businesses WHERE id = $1', [id]);
    await pool.query('DELETE FROM accounter_schema.financial_entities WHERE id = $1', [id]);
  }
  // Do NOT close the pool here — it is shared with other concurrently-running suites.
});

describe('provider business id', () => {
  it("round-trips through the tenant's statuses, unseen by other tenants", async () => {
    await createProvider(TENANT_A).setCredentials(
      'deel',
      { apiToken: 'token' },
      { businessId: DEEL_BUSINESS_A },
    );

    await expect(createProvider(TENANT_A).getProviderStatuses()).resolves.toEqual([
      expect.objectContaining({ provider: 'deel', businessId: DEEL_BUSINESS_A }),
    ]);
    await expect(createProvider(TENANT_B).getProviderStatuses()).resolves.toEqual([]);
  });

  it('keeps the business when credentials are saved again without one', async () => {
    const provider = createProvider(TENANT_A);
    await provider.setCredentials('deel', { apiToken: 'token' }, { businessId: DEEL_BUSINESS_A });
    await provider.setCredentials('deel', { apiToken: 'rotated-token' });

    await expect(createProvider(TENANT_A).getDeelCredentials()).resolves.toEqual({
      apiToken: 'rotated-token',
    });
    const [status] = await createProvider(TENANT_A).getProviderStatuses();
    expect(status.businessId).toBe(DEEL_BUSINESS_A);
  });

  it('changes the business of a connected provider, and refuses one not connected', async () => {
    const provider = createProvider(TENANT_A);
    await provider.setCredentials('deel', { apiToken: 'token' }, { businessId: DEEL_BUSINESS_A });

    await provider.setProviderBusiness('deel', OTHER_DEEL_BUSINESS_A);
    const [status] = await provider.getProviderStatuses();
    expect(status.businessId).toBe(OTHER_DEEL_BUSINESS_A);

    await expect(
      createProvider(TENANT_B).setProviderBusiness('deel', DEEL_BUSINESS_A),
    ).rejects.toMatchObject({ extensions: { code: 'NOT_FOUND' } });
  });
});
