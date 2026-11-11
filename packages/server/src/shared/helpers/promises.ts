/**
 * `Promise.all`, except that it does not settle until **every** input has.
 *
 * `Promise.all` rejects as soon as one input rejects, while the others keep
 * running. Inside a GraphQL resolver that is a resource leak: the request
 * returns, `dbCleanupPlugin` disposes the request's TenantAwareDBClient, and the
 * still-running siblings then fail with "TenantAwareDBClient is already
 * disposed" — or, if they construct a new client, outlive their request on the
 * database (#4871). Use this for any fan-out whose branches touch the database.
 *
 * Resolves with the values in input order, or rejects with the first rejection
 * in input order once everything has settled.
 */
export async function allSettledOrThrow<T extends readonly unknown[] | []>(
  values: T,
): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }>;
export async function allSettledOrThrow<T>(
  values: Iterable<T | PromiseLike<T>>,
): Promise<Awaited<T>[]>;
export async function allSettledOrThrow(values: Iterable<unknown>): Promise<unknown[]> {
  const settled = await Promise.allSettled(values);
  const results: unknown[] = [];
  for (const outcome of settled) {
    if (outcome.status === 'rejected') {
      throw outcome.reason;
    }
    results.push(outcome.value);
  }
  return results;
}
