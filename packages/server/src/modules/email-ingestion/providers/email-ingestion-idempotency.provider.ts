import { createHash } from 'node:crypto';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { IngestOutcome } from '../contracts.js';
import type {
  IGetDedupRecordQuery,
  IGetIdempotencyRecordQuery,
  IInsertDedupRecordQuery,
  IInsertIdempotencyRecordQuery,
} from '../types.js';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const getIdempotencyRecord = sql<IGetIdempotencyRecordQuery>`
  SELECT id, idempotency_key, owner_id, outcome, ingest_id, audit_id, created_at
    FROM accounter_schema.email_ingestion_idempotency_keys
   WHERE idempotency_key = $idempotencyKey
     AND owner_id = $ownerId
   LIMIT 1
`;

const insertIdempotencyRecord = sql<IInsertIdempotencyRecordQuery>`
  INSERT INTO accounter_schema.email_ingestion_idempotency_keys
    (idempotency_key, owner_id, outcome, ingest_id, audit_id)
  VALUES ($idempotencyKey, $ownerId, $outcome, $ingestId, $auditId)
  ON CONFLICT (idempotency_key, owner_id) DO NOTHING
  RETURNING id, idempotency_key, owner_id, outcome, ingest_id, audit_id, created_at
`;

const getDedupRecord = sql<IGetDedupRecordQuery>`
  SELECT id, owner_id, fingerprint, outcome, ingest_id, correlation_id, created_at
    FROM accounter_schema.email_ingestion_dedup_fingerprints
   WHERE owner_id = $ownerId
     AND fingerprint = $fingerprint
   LIMIT 1
`;

const insertDedupRecord = sql<IInsertDedupRecordQuery>`
  INSERT INTO accounter_schema.email_ingestion_dedup_fingerprints
    (owner_id, fingerprint, outcome, ingest_id, correlation_id)
  VALUES ($ownerId, $fingerprint, $outcome, $ingestId, $correlationId)
  ON CONFLICT (owner_id, fingerprint) DO NOTHING
  RETURNING id, owner_id, fingerprint, outcome, ingest_id, correlation_id, created_at
`;

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type IdempotencyRecord = {
  id: string;
  idempotencyKey: string;
  tenantId: string;
  outcome: IngestOutcome;
  ingestId: string | null;
  auditId: string;
  createdAt: Date;
};

export type PersistIdempotencyInput = {
  idempotencyKey: string;
  tenantId: string;
  outcome: IngestOutcome;
  ingestId?: string;
  auditId: string;
};

export type DedupRecord = {
  id: string;
  tenantId: string;
  fingerprint: string;
  outcome: IngestOutcome;
  ingestId: string | null;
  correlationId: string | null;
  createdAt: Date;
};

export type PersistDedupInput = {
  tenantId: string;
  fingerprint: string;
  outcome: IngestOutcome;
  ingestId?: string;
  correlationId?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute a stable, tenant-scoped dedup fingerprint from the tenant ID and
 * the raw message hash. Including tenant_id prevents cross-tenant collisions
 * for messages with identical content delivered to multiple tenants.
 */
export function computeDedupFingerprint(tenantId: string, rawMessageHash: string): string {
  return createHash('sha256').update(`${tenantId}:${rawMessageHash}`).digest('hex');
}

function rowToIdempotencyRecord(row: {
  id: string;
  idempotency_key: string;
  owner_id: string;
  outcome: string;
  ingest_id: string | null;
  audit_id: string;
  created_at: Date;
}): IdempotencyRecord {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    tenantId: row.owner_id,
    outcome: row.outcome as IngestOutcome,
    ingestId: row.ingest_id,
    auditId: row.audit_id,
    createdAt: row.created_at,
  };
}

function rowToDedupRecord(row: {
  id: string;
  owner_id: string;
  fingerprint: string;
  outcome: string;
  ingest_id: string | null;
  correlation_id: string | null;
  created_at: Date;
}): DedupRecord {
  return {
    id: row.id,
    tenantId: row.owner_id,
    fingerprint: row.fingerprint,
    outcome: row.outcome as IngestOutcome,
    ingestId: row.ingest_id,
    correlationId: row.correlation_id,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Data-plane provider for ingest idempotency and dedup.
 *
 * S13.6 boundary: these are tenant-bound reads/writes that run AFTER tenant
 * identity is established, so they go through TenantAwareDBClient at
 * Scope.Operation. This sets the RLS session variables, and the
 * `tenant_isolation` policies on `email_ingestion_idempotency_keys` and
 * `email_ingestion_dedup_fingerprints` enforce owner_id = current_business_id
 * (defense-in-depth alongside the explicit owner_id filters below). A
 * cross-tenant write violates WITH CHECK and is rejected by the database.
 *
 * Control-plane/pre-tenant operations (alias resolution, grant issuance and
 * validation) live in EmailIngestionControlProvider, which uses the raw pool
 * because no tenant-aware session can exist yet.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class EmailIngestionIdempotencyProvider {
  constructor(private db: TenantAwareDBClient) {}

  /**
   * Look up a prior outcome by idempotency key + tenant.
   * Returns null when the key is new (never processed for this tenant).
   */
  async checkIdempotencyKey(
    idempotencyKey: string,
    tenantId: string,
  ): Promise<IdempotencyRecord | null> {
    const rows = await getIdempotencyRecord.run({ idempotencyKey, ownerId: tenantId }, this.db);
    return rows.length > 0 ? rowToIdempotencyRecord(rows[0]) : null;
  }

  /**
   * Persist an idempotency record after completing an ingest operation.
   * Uses ON CONFLICT DO NOTHING so concurrent requests cannot double-insert.
   * If the INSERT races and another request wins, falls back to a SELECT to
   * return the already-stored record.
   */
  async persistIdempotencyKey(input: PersistIdempotencyInput): Promise<IdempotencyRecord> {
    const rows = await insertIdempotencyRecord.run(
      {
        idempotencyKey: input.idempotencyKey,
        ownerId: input.tenantId,
        outcome: input.outcome,
        ingestId: input.ingestId ?? null,
        auditId: input.auditId,
      },
      this.db,
    );

    if (rows.length > 0) {
      return rowToIdempotencyRecord(rows[0]);
    }

    // Conflict: another concurrent request inserted first — fetch the stored record.
    const existing = await getIdempotencyRecord.run(
      { idempotencyKey: input.idempotencyKey, ownerId: input.tenantId },
      this.db,
    );
    if (!existing[0]) {
      throw new Error(
        `Failed to retrieve existing idempotency record after conflict for key: ${input.idempotencyKey}`,
      );
    }
    return rowToIdempotencyRecord(existing[0]);
  }

  /**
   * Look up a prior outcome by tenant-scoped dedup fingerprint.
   * Returns null when the fingerprint is new for this tenant.
   */
  async checkDedupFingerprint(fingerprint: string, tenantId: string): Promise<DedupRecord | null> {
    const rows = await getDedupRecord.run({ ownerId: tenantId, fingerprint }, this.db);
    return rows.length > 0 ? rowToDedupRecord(rows[0]) : null;
  }

  /**
   * Persist a dedup fingerprint after completing an ingest operation.
   * ON CONFLICT DO NOTHING ensures idempotent inserts; falls back to SELECT on race.
   */
  async persistDedupFingerprint(input: PersistDedupInput): Promise<DedupRecord> {
    const rows = await insertDedupRecord.run(
      {
        ownerId: input.tenantId,
        fingerprint: input.fingerprint,
        outcome: input.outcome,
        ingestId: input.ingestId ?? null,
        correlationId: input.correlationId ?? null,
      },
      this.db,
    );

    if (rows.length > 0) {
      return rowToDedupRecord(rows[0]);
    }

    // Conflict: fetch the existing record inserted by a concurrent request.
    const existing = await getDedupRecord.run(
      { ownerId: input.tenantId, fingerprint: input.fingerprint },
      this.db,
    );
    if (!existing[0]) {
      throw new Error(
        `Failed to retrieve existing dedup record after conflict for fingerprint: ${input.fingerprint}`,
      );
    }
    return rowToDedupRecord(existing[0]);
  }
}
