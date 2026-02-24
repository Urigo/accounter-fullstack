import pg from 'pg';
import { env } from '../environment.js';
import { DBProvider } from '../modules/app-providers/db.provider.js';
import { TenantAwareDBClient } from '../modules/app-providers/tenant-db-client.js';
import { AuthContextV2Provider } from '../modules/auth/providers/auth-context-v2.provider.js';
import { AccounterContext } from '../shared/types/index.js';

const { Pool } = pg;

async function testAuth0Parallel() {
  console.log('🧪 Testing Auth0 authentication in parallel...');

  // Get test JWT from Auth0 test user
  const testJWT = process.env.AUTH0_TEST_JWT;
  if (!testJWT) {
    throw new Error('AUTH0_TEST_JWT environment variable required');
  }

  // Create DB provider
  const pool = new Pool({
    user: env.postgres.user,
    password: env.postgres.password,
    host: env.postgres.host,
    port: Number(env.postgres.port),
    database: env.postgres.db,
    ssl: env.postgres.ssl ? { rejectUnauthorized: false } : false,
    max: 1,
  });

  const dbProvider = new DBProvider(pool);

  // Test JWT verification
  const rawAuth = { authType: 'jwt' as const, token: testJWT };
  // NOTE: Intentional test-only workaround:
  // - AuthContextV2Provider expects a TenantAwareDBClient, which normally enforces RLS.
  // - Here we pass a system-level DBProvider (bypasses RLS) and force-cast it, because
  //   this script is only exercising Auth0 JWT verification / user lookup, not RLS behavior.
  // - No tenant-scoped or RLS-sensitive queries are performed via this instance in this script.
  // - Do NOT copy this pattern into production code; always use a real TenantAwareDBClient there.
  const authProvider = new AuthContextV2Provider(
    rawAuth,
    dbProvider as unknown as TenantAwareDBClient,
    env,
  );

  console.log('🔄 Verifying JWT...');
  const authContext = await authProvider.getAuthContext();

  if (!authContext) {
    console.error('❌ Failed to verify JWT or map to local user');
    await pool.end();
    process.exit(1);
  }

  console.log('✅ Auth0 JWT verified successfully');
  console.log('  User ID:', authContext.user?.userId);
  console.log('  Email:', authContext.user?.email);
  console.log('  Business:', authContext.tenant?.businessId);
  console.log('  Role:', authContext.user?.roleId);

  // Test database query with Auth0 context
  // Minimal mock context for TenantAwareDBClient (it requires dbClientsToDispose array for cleanup)
  const mockContext = {
    dbClientsToDispose: [],
    // Simulation of what Yoga would provide
    initialContext: {},
    env,
    pool,
  } as unknown as AccounterContext;

  const client = new TenantAwareDBClient(dbProvider, authContext, mockContext);

  try {
    console.log('🔄 Executing query with RLS context...');
    const result = await client.query('SELECT COUNT(*) as count FROM accounter_schema.charges');
    console.log('✅ Database query with Auth0 context successful');
    console.log('  Charges count:', result.rows[0].count);
  } catch (error) {
    console.error('❌ Database query failed:', error);
    process.exit(1);
  } finally {
    await client.dispose();
    await pool.end();
  }

  console.log('✅ All parallel tests passed!');
}

testAuth0Parallel().catch(err => {
  console.error(err);
  process.exit(1);
});
