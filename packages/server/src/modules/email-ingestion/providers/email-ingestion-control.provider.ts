import { randomUUID } from 'node:crypto';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import { IngestReasonCode } from '../contracts.js';
import type { IGetAliasByAliasQuery, IInsertIngestGrantQuery } from '../types.js';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const getAliasByAlias = sql<IGetAliasByAliasQuery>`
  SELECT owner_id
    FROM accounter_schema.email_ingestion_alias_routing
   WHERE lower(alias) = $alias
     AND is_active = TRUE
   LIMIT 1
`;

const insertIngestGrant = sql<IInsertIngestGrantQuery>`
  INSERT INTO accounter_schema.email_ingestion_grants
    (jti, owner_id, message_id, raw_message_hash, action, expires_at)
  VALUES ($jti, $ownerId, $messageId, $rawMessageHash, $action, $expiresAt)
  RETURNING id, jti, owner_id, action, expires_at
`;

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
    const rows = await getAliasByAlias.run({ alias: alias.toLowerCase() }, this.dbProvider.pool);

    if (rows.length === 0) {
      return { found: false, reason: IngestReasonCode.UNKNOWN_ALIAS };
    }

    return { found: true, tenantId: rows[0].owner_id };
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

    const rows = await insertIngestGrant.run(
      { jti, ownerId: tenantId, messageId, rawMessageHash, action: 'ingest', expiresAt },
      this.dbProvider.pool,
    );

    const row = rows[0];

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
