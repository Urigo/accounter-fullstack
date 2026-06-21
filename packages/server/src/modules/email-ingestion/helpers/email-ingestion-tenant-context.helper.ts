import type { Pool, PoolClient } from 'pg';

/**
 * Run `fn` inside a single transaction whose RLS context is pinned to the given
 * tenant. `set_config(..., true)` is transaction-local (SET LOCAL), so the
 * context is cleared on COMMIT/ROLLBACK and never leaks to the pooled
 * connection's next user.
 *
 * Control-plane and gateway-initiated ingestion present an auth session with an
 * empty businessId, so TenantAwareDBClient (which derives the tenant from the
 * auth session) cannot be used. The authoritative tenant instead comes from the
 * resolved alias / cryptographically-validated grant and is pinned here so the
 * `tenant_isolation` RLS policies (USING / WITH CHECK `owner_id =
 * get_current_business_id()`) on the email_ingestion_* tables are satisfied —
 * these tables use FORCE ROW LEVEL SECURITY, so even the table owner is subject
 * to them and the raw pool cannot bypass the policy.
 */
export async function withTenantContext<T>(
  pool: Pool,
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures (e.g. the connection is already broken).
    }
    throw err;
  } finally {
    client.release();
  }
}
