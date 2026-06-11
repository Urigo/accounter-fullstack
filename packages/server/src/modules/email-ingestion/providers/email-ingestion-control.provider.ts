import { randomUUID } from 'node:crypto';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import { IngestReasonCode } from '../contracts.js';
import type {
  IConsumeGrantByJtiQuery,
  IGetAliasByAliasQuery,
  IGetGrantByJtiQuery,
  IInsertIngestGrantQuery,
} from '../types.js';

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

const getGrantByJti = sql<IGetGrantByJtiQuery>`
  SELECT id, jti, owner_id, message_id, raw_message_hash, action, expires_at, consumed_at
    FROM accounter_schema.email_ingestion_grants
   WHERE jti = $jti
   LIMIT 1
`;

const consumeGrantByJti = sql<IConsumeGrantByJtiQuery>`
  UPDATE accounter_schema.email_ingestion_grants
     SET consumed_at = NOW()
   WHERE jti = $jti
     AND consumed_at IS NULL
  RETURNING id
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

export type ValidateGrantInput = {
  jti: string;
  tenantId: string;
  messageId: string;
  rawMessageHash: string;
};

export type ValidatedGrant = {
  jti: string;
  tenantId: string;
  action: string;
  expiresAt: Date;
};

export type GrantValidationResult =
  | { valid: true; grant: ValidatedGrant }
  | {
      valid: false;
      reason: typeof IngestReasonCode.GRANT_INVALID | typeof IngestReasonCode.TENANT_MISMATCH;
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

  /**
   * Validate a presented grant against the stored record and atomically consume it.
   * Checks: existence, expiry, consumed state, action scope, tenant binding, and message binding.
   * The consume UPDATE (SET consumed_at = NOW() WHERE consumed_at IS NULL) is atomic —
   * if a concurrent request consumed the grant first the UPDATE returns 0 rows and
   * the method returns GRANT_INVALID, preventing double-use.
   * Uses raw pool for the same reason as resolveAlias: no tenant session is active yet.
   */
  async validateAndConsumeGrant(input: ValidateGrantInput): Promise<GrantValidationResult> {
    const rows = await getGrantByJti.run({ jti: input.jti }, this.dbProvider.pool);

    if (rows.length === 0) {
      return { valid: false, reason: IngestReasonCode.GRANT_INVALID };
    }

    const grant = rows[0];

    if (grant.consumed_at !== null) {
      return { valid: false, reason: IngestReasonCode.GRANT_INVALID };
    }

    if (grant.expires_at <= new Date()) {
      return { valid: false, reason: IngestReasonCode.GRANT_INVALID };
    }

    if (grant.action !== 'ingest') {
      return { valid: false, reason: IngestReasonCode.GRANT_INVALID };
    }

    if (grant.owner_id !== input.tenantId) {
      return { valid: false, reason: IngestReasonCode.TENANT_MISMATCH };
    }

    if (grant.message_id !== input.messageId) {
      return { valid: false, reason: IngestReasonCode.GRANT_INVALID };
    }

    if (grant.raw_message_hash !== input.rawMessageHash) {
      return { valid: false, reason: IngestReasonCode.GRANT_INVALID };
    }

    // Atomic consume-once: if this returns 0 rows a concurrent request beat us to it.
    const consumed = await consumeGrantByJti.run({ jti: input.jti }, this.dbProvider.pool);

    if (consumed.length === 0) {
      return { valid: false, reason: IngestReasonCode.GRANT_INVALID };
    }

    return {
      valid: true,
      grant: {
        jti: grant.jti,
        tenantId: grant.owner_id,
        action: grant.action,
        expiresAt: grant.expires_at,
      },
    };
  }
}
