import { randomUUID } from 'node:crypto';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import {
  suggestionDataSchema,
  type EmailListenerConfig,
} from '../../financial-entities/helpers/business-suggestion-data-schema.helper.js';
import { IngestReasonCode } from '../contracts.js';
import { withTenantContext } from '../helpers/email-ingestion-tenant-context.helper.js';
import type { IConsumeGrantByJtiQuery, IGetAliasByAliasQuery } from '../types.js';

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

// Inline query type (cf. the ingest provider) so the grant insert does not
// depend on a regenerated pgtyped type when the business_id column is added.
interface IInsertGrantQuery {
  params: {
    jti: string;
    ownerId: string;
    messageId: string;
    rawMessageHash: string;
    action: string;
    expiresAt: Date;
    businessId: string | null;
  };
  result: {
    id: string;
    jti: string;
    owner_id: string;
    action: string;
    expires_at: Date;
    business_id: string | null;
  };
}

const insertIngestGrant = sql<IInsertGrantQuery>`
  INSERT INTO accounter_schema.email_ingestion_grants
    (jti, owner_id, message_id, raw_message_hash, action, expires_at, business_id)
  VALUES ($jti, $ownerId, $messageId, $rawMessageHash, $action, $expiresAt, $businessId)
  RETURNING id, jti, owner_id, action, expires_at, business_id
`;

interface IGetBusinessByEmailForIngestQuery {
  params: { email: string };
  result: { id: string; suggestion_data: unknown };
}

// Resolve the issuing business by a sender email listed in its
// suggestion_data.emails. Mirrors BusinessesProvider.getBusinessByEmail, but
// runs on a tenant-pinned client (the control plane has no auth session), so
// businesses RLS scopes the match to the resolved tenant.
const getBusinessByEmail = sql<IGetBusinessByEmailForIngestQuery>`
  SELECT id, suggestion_data
    FROM accounter_schema.businesses
   WHERE suggestion_data->'emails' ? $email::text
   LIMIT 1
`;

// Inline type (cf. insertIngestGrant) so selecting the business_id column does
// not depend on a regenerated pgtyped type. business_id is read back here and
// bound onto the ValidatedGrant so the ingest step can attribute documents to
// the recognized business without trusting gateway input.
interface IGetGrantByJtiForValidationQuery {
  params: { jti: string };
  result: {
    id: string;
    jti: string;
    owner_id: string;
    message_id: string;
    raw_message_hash: string;
    action: string;
    expires_at: Date;
    consumed_at: Date | null;
    business_id: string | null;
  };
}

const getGrantByJti = sql<IGetGrantByJtiForValidationQuery>`
  SELECT id, jti, owner_id, message_id, raw_message_hash, action, expires_at, consumed_at, business_id
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
  /** Recognized issuing business, bound into the grant for the ingest step. */
  businessId?: string | null;
};

export type BusinessRecognitionResult = {
  /** The recognized issuing business, or null when no business matched. */
  businessId: string | null;
  /** The business's email-processing config (empty when unrecognized). */
  config: EmailListenerConfig;
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
  /** Recognized issuing business bound at control time; null when unrecognized. */
  businessId: string | null;
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
   * The INSERT runs under the tenant's RLS context (see {@link withTenantContext}):
   * the grants table uses FORCE ROW LEVEL SECURITY with a tenant_isolation
   * WITH CHECK policy, so the raw pool cannot bypass it — the owner_id parameter
   * and the pinned business context must agree.
   */
  async issueGrant(input: IssueGrantInput): Promise<IssuedGrant> {
    const jti = randomUUID();
    const decisionId = randomUUID();
    const auditId = randomUUID();

    const { tenantId, messageId, rawMessageHash, expiresAt, businessId } = input;

    const rows = await withTenantContext(this.dbProvider.pool, tenantId, client =>
      insertIngestGrant.run(
        {
          jti,
          ownerId: tenantId,
          messageId,
          rawMessageHash,
          action: 'ingest',
          expiresAt,
          businessId: businessId ?? null,
        },
        client,
      ),
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
   * Recognize the issuing business behind an incoming email and load its
   * email-processing config. Runs on a client pinned to the resolved tenant so
   * the businesses RLS policy scopes the lookup to that tenant; returns a null
   * businessId (and empty config) when no email evidence is available or no
   * business matches, in which case the gateway applies default treatment.
   */
  async recognizeBusiness(
    tenantId: string,
    issuerEmail: string | null,
  ): Promise<BusinessRecognitionResult> {
    if (!issuerEmail) {
      return { businessId: null, config: {} };
    }

    return withTenantContext(this.dbProvider.pool, tenantId, async client => {
      const rows = await getBusinessByEmail.run({ email: issuerEmail }, client);
      if (rows.length === 0) {
        return { businessId: null, config: {} };
      }

      const business = rows[0];
      let config: EmailListenerConfig = {};
      if (business.suggestion_data) {
        const parsed = suggestionDataSchema.safeParse(business.suggestion_data);
        if (parsed.success) {
          if (parsed.data.emailListener) {
            config = parsed.data.emailListener;
          }
        } else {
          console.error(
            `Invalid suggestion_data schema for business [${business.id}]: ${JSON.stringify(parsed.error.issues)}`,
          );
        }
      }

      return { businessId: business.id, config };
    });
  }

  /**
   * Validate a presented grant against the stored record and atomically consume it.
   * Checks: existence, expiry, consumed state, action scope, tenant binding, and message binding.
   * The consume UPDATE (SET consumed_at = NOW() WHERE consumed_at IS NULL) is atomic —
   * if a concurrent request consumed the grant first the UPDATE returns 0 rows and
   * the method returns GRANT_INVALID, preventing double-use.
   * Runs under the claimed tenant's RLS context: the grants table uses FORCE ROW
   * LEVEL SECURITY, so the raw pool cannot read/update it without a pinned
   * business context. Pinning to input.tenantId means a grant owned by another
   * tenant is filtered out by the USING policy and surfaces as GRANT_INVALID;
   * the explicit owner_id check below remains as defense-in-depth.
   */
  async validateAndConsumeGrant(input: ValidateGrantInput): Promise<GrantValidationResult> {
    return withTenantContext(this.dbProvider.pool, input.tenantId, async client => {
      const rows = await getGrantByJti.run({ jti: input.jti }, client);

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
      const consumed = await consumeGrantByJti.run({ jti: input.jti }, client);

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
          businessId: grant.business_id ?? null,
        },
      };
    });
  }
}
