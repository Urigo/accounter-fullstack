import { randomUUID } from 'node:crypto';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '../../app-providers/db.provider.js';
import { IngestReasonCode } from '../contracts.js';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type AliasResolutionResult =
  | { found: false; reason: typeof IngestReasonCode.UNKNOWN_ALIAS }
  | { found: true; tenantId: string };

export type IssuedGrant = {
  jti: string;
  tenantId: string;
  messageId: string;
  rawMessageHash: string;
  action: string;
  expiresAt: Date;
  decisionId: string;
  auditId: string;
};

export type IssueGrantInput = {
  tenantId: string;
  messageId: string;
  rawMessageHash: string;
  expiresAt: Date;
  correlationId?: string;
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class EmailIngestionControlProvider {
  constructor(private dbProvider: DBProvider) {}

  /**
   * Resolve a recipient alias to the owning tenant.
   * Bypasses RLS via raw pool: alias lookup is a bootstrap step that runs
   * before any tenant context is known, so TenantAwareDBClient would throw
   * UNAUTHENTICATED. The alias_routing table has FOR SELECT USING (TRUE) to
   * explicitly allow cross-tenant reads at the DB policy level.
   */
  async resolveAlias(alias: string): Promise<AliasResolutionResult> {
    const result = await this.dbProvider.pool.query<{ owner_id: string }>(
      `SELECT owner_id
         FROM accounter_schema.email_ingestion_alias_routing
        WHERE lower(alias) = $1
          AND is_active = TRUE
        LIMIT 1`,
      [alias.toLowerCase()],
    );

    if (result.rows.length === 0) {
      return { found: false, reason: IngestReasonCode.UNKNOWN_ALIAS };
    }

    return { found: true, tenantId: result.rows[0].owner_id };
  }

  /**
   * Issue a short-lived, single-use ingest grant for the given tenant and message.
   * Returns the persisted grant together with decision/audit metadata.
   * Uses raw pool so the INSERT succeeds without an active tenant session;
   * tenant binding is enforced explicitly via the owner_id parameter.
   */
  async issueGrant(input: IssueGrantInput): Promise<IssuedGrant> {
    const jti = randomUUID();
    const decisionId = randomUUID();
    const auditId = randomUUID();

    const { tenantId, messageId, rawMessageHash, expiresAt } = input;

    const result = await this.dbProvider.pool.query<{
      id: string;
      jti: string;
      owner_id: string;
      action: string;
      expires_at: Date;
    }>(
      `INSERT INTO accounter_schema.email_ingestion_grants
         (jti, owner_id, message_id, raw_message_hash, action, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, jti, owner_id, action, expires_at`,
      [jti, tenantId, messageId, rawMessageHash, 'ingest', expiresAt],
    );

    const row = result.rows[0];

    return {
      jti: row.jti,
      tenantId: row.owner_id,
      messageId,
      rawMessageHash,
      action: row.action,
      expiresAt: row.expires_at,
      decisionId,
      auditId,
    };
  }
}
