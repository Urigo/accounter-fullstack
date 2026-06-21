import { createHash } from 'node:crypto';

/**
 * Compute a stable, tenant-scoped dedup fingerprint from the tenant ID and the
 * raw message hash. Including tenant_id prevents cross-tenant collisions for
 * messages with identical content delivered to multiple tenants.
 */
export function computeDedupFingerprint(tenantId: string, rawMessageHash: string): string {
  return createHash('sha256').update(`${tenantId}:${rawMessageHash}`).digest('hex');
}
