import pg from 'pg';
import { env } from '../environment.js';
import { DBProvider } from '../modules/app-providers/db.provider.js';
import { TenantAwareDBClient } from '../modules/app-providers/tenant-db-client.js';
import { AuthContextV2Provider } from '../modules/auth/providers/auth-context-v2.provider.js';

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
  const authProvider = new AuthContextV2Provider(env, rawAuth, dbProvider);

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

  const authContextProvider = {
    getAuthContext: () => Promise.resolve(authContext),
  } as AuthContextV2Provider;

  const client = new TenantAwareDBClient(dbProvider, authContextProvider);

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
