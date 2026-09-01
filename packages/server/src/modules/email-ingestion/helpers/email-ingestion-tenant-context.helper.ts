import type { Pool, PoolClient } from 'pg';

/**
 * Error codes/messages that mean the connection itself died, as opposed to the
 * query being rejected. `pg` surfaces a dead socket as a plain `Error` whose
 * message is `Connection terminated unexpectedly`, and the underlying socket
 * failures as Node `code`s.
 *
 * `err.code` carries either a Node errno (socket-level) or a Postgres SQLSTATE
 * (server-reported), so both are checked.
 */
const CONNECTION_ERROR_CODES = new Set([
  // Node errno codes — the socket failed underneath us.
  'ECONNRESET',
  'EPIPE',
  'ETIMEDOUT',
  'ECONNREFUSED',
  // SQLSTATE class 08 — connection_exception. Reached when the server reports the
  // failure rather than the socket simply dying.
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '08P01', // protocol_violation
  // SQLSTATE class 57 — the server terminated the connection on purpose. 57P01
  // ("terminating connection due to administrator command") is literally the
  // database killing an idle session, which is the case this whole helper exists
  // for.
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
]);

/**
 * SQLSTATE 08007 (transaction_resolution_unknown) is in the connection-exception
 * class but must NEVER be retried: it means the connection dropped while the
 * transaction was being resolved, so it may well have committed. Same hazard as
 * a failure during COMMIT, and handled the same way — excluded here, so the
 * caller rethrows instead of replaying the work.
 */
const TRANSACTION_RESOLUTION_UNKNOWN = '08007';
const CONNECTION_ERROR_MESSAGES = [
  'connection terminated',
  'connection ended unexpectedly',
  'server closed the connection unexpectedly',
  'client has encountered a connection error',
  'read econnreset',
];

/**
 * A connection-level failure that happened while COMMIT was in flight, so the
 * transaction's outcome is unknown and it must never be replayed. Carried as its
 * own type rather than as message text, since the original message (which the
 * substring check above would still match) is preserved in it.
 */
export class UnknownCommitOutcomeError extends Error {
  override name = 'UnknownCommitOutcomeError';
}

/**
 * True when the failure is the connection dying rather than the statement being
 * rejected. A statement error (constraint violation, syntax, RLS) must never be
 * retried; a dead socket can be, because nothing it carried was committed.
 */
export function isConnectionLevelError(err: unknown): boolean {
  if (err instanceof UnknownCommitOutcomeError) return false;
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  if (code === TRANSACTION_RESOLUTION_UNKNOWN) return false;
  if (code && CONNECTION_ERROR_CODES.has(code)) return true;
  const message = err.message.toLowerCase();
  return CONNECTION_ERROR_MESSAGES.some(fragment => message.includes(fragment));
}

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
 *
 * A connection handed out dead — killed by the database or an intermediary while
 * it sat idle in the pool — is retried once on a fresh connection. That failure
 * mode is invisible until checkout and cost five inbound emails in #4344: the
 * first request after a quiet period threw, the gateway saw a non-retryable
 * GraphQL error, and the message was dropped with no durable record. The retry
 * is safe because a connection-level failure guarantees the transaction was
 * never committed, and it is deliberately narrow: only a dead connection, only
 * before COMMIT is issued (once COMMIT is in flight the outcome is unknown, so
 * it is never retried), and only once.
 */
export async function withTenantContext<T>(
  pool: Pool,
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  try {
    return await runInTenantTransaction(pool, tenantId, fn);
  } catch (err) {
    if (!isConnectionLevelError(err)) throw err;
    process.stderr.write(
      `[db] Retrying tenant transaction on a fresh connection after a connection-level failure: ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
    return runInTenantTransaction(pool, tenantId, fn);
  }
}

async function runInTenantTransaction<T>(
  pool: Pool,
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  let committing = false;
  let brokenConnection: Error | undefined;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_business_id', $1, true)", [tenantId]);
    const result = await fn(client);
    committing = true;
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // Hand a broken connection to release() so the pool destroys it instead of
    // returning it for the next caller to trip over.
    if (isConnectionLevelError(err)) brokenConnection = err as Error;
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback failures (e.g. the connection is already broken).
    }
    // A failure while COMMIT is in flight leaves the outcome unknown — the
    // transaction may well have committed — so it must never be retried.
    // Re-typing it is what makes the caller rethrow instead of replaying.
    if (committing && isConnectionLevelError(err)) {
      throw new UnknownCommitOutcomeError(
        `Tenant transaction failed while committing; outcome unknown: ${
          err instanceof Error ? err.message : String(err)
        }`,
        { cause: err },
      );
    }
    throw err;
  } finally {
    client.release(brokenConnection);
  }
}
