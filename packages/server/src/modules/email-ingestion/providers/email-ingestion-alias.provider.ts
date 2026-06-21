import { Injectable, Scope } from 'graphql-modules';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';

// Postgres unique_violation — raised by the partial-unique index that allows at
// most one active alias per (case-insensitive) address.
const PG_UNIQUE_VIOLATION = '23505';

export type AliasRow = {
  id: string;
  alias: string;
  owner_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
};

export type AliasMutationResult =
  | { success: true; alias: AliasRow }
  | { success: false; message: string };

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}

/**
 * Manages alias→owner routing rows for v2 email ingestion.
 *
 * Writes go through TenantAwareDBClient so the `tenant_isolation_write` RLS
 * policy (`owner_id = get_current_business_id()`) is enforced as defense in
 * depth on top of the resolver's membership check. The request must therefore
 * be scoped to the target business (X-Business-Scope) — the same convention as
 * every other tenant write in the app.
 *
 * Reads use an explicit `owner_id` scope filter because the table's
 * `alias_resolution_select` policy is `USING (TRUE)` (alias resolution must work
 * before a tenant context exists), so RLS does not constrain SELECTs here.
 */
@Injectable({ scope: Scope.Operation })
export class EmailIngestionAliasProvider {
  constructor(private db: TenantAwareDBClient) {}

  async createAlias(alias: string, ownerId: string): Promise<AliasMutationResult> {
    try {
      const { rows } = await this.db.query<AliasRow>(
        `INSERT INTO accounter_schema.email_ingestion_alias_routing (alias, owner_id)
         VALUES ($1, $2)
         RETURNING id, alias, owner_id, is_active, created_at, updated_at`,
        [alias, ownerId],
      );
      return { success: true, alias: rows[0] };
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Generic message: the conflicting active alias may belong to another
        // tenant (the global unique index spans tenants); do not leak ownership.
        return { success: false, message: `Alias "${alias}" is already in use` };
      }
      throw err;
    }
  }

  async setAliasActive(id: string, isActive: boolean): Promise<AliasMutationResult> {
    try {
      const { rows } = await this.db.query<AliasRow>(
        `UPDATE accounter_schema.email_ingestion_alias_routing
            SET is_active = $2
          WHERE id = $1
          RETURNING id, alias, owner_id, is_active, created_at, updated_at`,
        [id, isActive],
      );
      if (rows.length === 0) {
        return { success: false, message: 'Alias not found or not authorized' };
      }
      return { success: true, alias: rows[0] };
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { success: false, message: 'An active alias already exists for this address' };
      }
      throw err;
    }
  }

  async listAliases(ownerIds: readonly string[]): Promise<AliasRow[]> {
    if (ownerIds.length === 0) {
      return [];
    }
    const { rows } = await this.db.query<AliasRow>(
      `SELECT id, alias, owner_id, is_active, created_at, updated_at
         FROM accounter_schema.email_ingestion_alias_routing
        WHERE owner_id = ANY($1::uuid[])
        ORDER BY alias ASC`,
      [ownerIds],
    );
    return rows;
  }
}
