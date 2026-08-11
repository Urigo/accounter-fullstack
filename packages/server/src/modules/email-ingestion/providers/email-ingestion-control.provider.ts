import { randomUUID } from 'node:crypto';
import { Injectable, Scope } from 'graphql-modules';
import type { PoolClient } from 'pg';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import {
  suggestionDataSchema,
  type EmailListenerConfig,
} from '../../financial-entities/helpers/business-suggestion-data-schema.helper.js';
import { IngestReasonCode } from '../contracts.js';
import {
  EmailKind,
  GLOBAL_INVOICE_PLATFORM_SENDERS,
  normalizeEmail,
  type EmailClassification,
  type TenantMailContext,
} from '../helpers/email-ingestion-classify.helper.js';
import { withTenantContext } from '../helpers/email-ingestion-tenant-context.helper.js';
import type {
  IConsumeGrantByJtiQuery,
  IGetActiveAliasesForTenantQuery,
  IGetAliasByAliasQuery,
  IGetBusinessByEmailForIngestQuery,
  IGetGrantByJtiForValidationQuery,
  IGetTenantOwnBusinessForIngestQuery,
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
    (jti, owner_id, message_id, raw_message_hash, action, expires_at, business_id, classification)
  VALUES ($jti, $ownerId, $messageId, $rawMessageHash, $action, $expiresAt, $businessId, $classification)
  RETURNING id, jti, owner_id, action, expires_at, business_id, classification
`;

// Resolve the issuing business by a sender email listed in its
// suggestion_data.emails. Mirrors BusinessesProvider.getBusinessByEmail, but
// runs on a tenant-pinned client (the control plane has no auth session), so
// businesses RLS scopes the match to the resolved tenant. The match is
// case-insensitive (email addresses are case-insensitive in practice and
// neither the stored value nor the sender evidence is normalized upstream).
// A stored candidate may be a wildcard pattern (e.g. `*@cloudflare.com`) for
// suppliers that send from a unique address per invoice: `*` is translated to a
// LIKE wildcard while the LIKE metacharacters `%` and `_` in the stored value
// are escaped, so a literal candidate still matches exactly (see
// email-pattern.helper.ts for the equivalent in-process matcher). `#` is used as
// the LIKE ESCAPE character (and is itself escaped as `##`) instead of the
// default backslash, so the query text carries no backslashes: pgtyped emits the
// template verbatim, and a doubled backslash would otherwise reach Postgres as a
// two-character escape string ("invalid escape string").
// The jsonb_typeof guard keeps jsonb_array_elements_text from throwing on a
// malformed/legacy record whose `emails` is not a JSON array (a missing key or
// non-array value simply yields no rows instead of a runtime error).
const getBusinessByEmailForIngest = sql<IGetBusinessByEmailForIngestQuery>`
  SELECT id, suggestion_data
    FROM accounter_schema.businesses
   WHERE EXISTS (
     SELECT 1
       FROM jsonb_array_elements_text(
         CASE WHEN jsonb_typeof(suggestion_data->'emails') = 'array'
              THEN suggestion_data->'emails'
              ELSE '[]'::jsonb
         END
       ) AS candidate
      WHERE lower($email) LIKE
        replace(replace(replace(replace(lower(candidate), '#', '##'), '%', '#%'), '_', '#_'), '*', '%')
        ESCAPE '#'
   )
   LIMIT 1
`;

// The tenant's own inbound addresses. Scoped by an explicit owner_id filter because
// the alias_routing table's select policy is USING (TRUE) — alias resolution has to
// work before any tenant context exists — so RLS does not constrain this read.
const getActiveAliasesForTenant = sql<IGetActiveAliasesForTenantQuery>`
  SELECT alias
    FROM accounter_schema.email_ingestion_alias_routing
   WHERE owner_id = $ownerId
     AND is_active = TRUE
`;

// The tenant's *own* business row — deliberately `b.id = $tenantId` and not
// `b.owner_id = $tenantId`: the latter returns every business in the workspace,
// including every counterparty, whose addresses must stay eligible for issuer
// recognition. Supplies the tenant's own names and its emailIngestion config.
const getTenantOwnBusinessForIngest = sql<IGetTenantOwnBusinessForIngestQuery>`
  SELECT fe.name, b.hebrew_name, b.suggestion_data
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      ON fe.id = b.id
   WHERE b.id = $tenantId
   LIMIT 1
`;

const getGrantByJtiForValidation = sql<IGetGrantByJtiForValidationQuery>`
  SELECT id, jti, owner_id, message_id, raw_message_hash, action, expires_at, consumed_at, business_id, classification
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
  /** How the email was classified, bound into the grant for the ingest step. */
  classification?: EmailKind | null;
};

export type BusinessRecognitionResult = {
  /** The recognized issuing business, or null when no business matched. */
  businessId: string | null;
  /** The business's email-processing config (empty when unrecognized). */
  config: EmailListenerConfig;
};

/**
 * Parse a matched business's `suggestion_data.emailListener` config, tolerating
 * a missing or malformed blob (returns an empty config and logs on schema
 * mismatch — recognition still succeeds, treatment just falls back to defaults).
 */
function parseEmailListenerConfig(business: {
  id: string;
  suggestion_data: unknown;
}): EmailListenerConfig {
  if (!business.suggestion_data) {
    return {};
  }
  const parsed = suggestionDataSchema.safeParse(business.suggestion_data);
  if (!parsed.success) {
    console.error(
      `Invalid suggestion_data schema for business [${business.id}]: ${JSON.stringify(parsed.error.issues)}`,
    );
    return {};
  }
  return parsed.data.emailListener ?? {};
}

/**
 * How long a tenant's mail context is reused. Control runs once per inbound email
 * against a 3 s gateway timeout, and the underlying data (aliases, the tenant's own
 * business row) changes on human timescales — so a short cache keeps a DB round-trip
 * off the hot path without making config edits feel stuck.
 */
const MAIL_CONTEXT_TTL_MS = 60_000;

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
  /** Classification bound at control time; null on grants issued before it existed. */
  classification: EmailKind | null;
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
  /** Per-tenant mail context, see {@link MAIL_CONTEXT_TTL_MS}. */
  private mailContextCache = new Map<string, { context: TenantMailContext; expiresAt: number }>();

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

    const { tenantId, messageId, rawMessageHash, expiresAt, businessId, classification } = input;

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
          classification: classification ?? null,
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

    return withTenantContext(this.dbProvider.pool, tenantId, client =>
      this.lookupBusinessByEmails(client, [issuerEmail]),
    );
  }

  /**
   * Recognize the issuing business from a {@link classifyEmail} result, trying each
   * candidate address in priority order until one matches. This is the path the
   * resolver uses: the classifier has already removed the tenant's own addresses,
   * its mailing-list addresses and the forwarder, so **manually forwarded** mail
   * resolves to the real issuer rather than to the tenant itself. Runs every lookup
   * inside a single tenant-pinned transaction.
   */
  async recognizeBusinessFromClassification(
    tenantId: string,
    classification: EmailClassification,
  ): Promise<BusinessRecognitionResult> {
    if (classification.issuerCandidates.length === 0) {
      return { businessId: null, config: {} };
    }

    return withTenantContext(this.dbProvider.pool, tenantId, client =>
      this.lookupBusinessByEmails(client, classification.issuerCandidates),
    );
  }

  /**
   * Assemble the tenant-scoped facts {@link classifyEmail} needs. Cached briefly —
   * see {@link MAIL_CONTEXT_TTL_MS}.
   *
   * "Own addresses" are deliberately narrow: the tenant's active ingest aliases plus
   * the emails registered on its **own** business row. Every other business in the
   * workspace shares `owner_id` with the tenant but is a *counterparty* — treating
   * their addresses as the tenant's would exclude every supplier from recognition.
   * Colleagues who are not registered anywhere are covered by `ownDomains` config.
   */
  async loadTenantMailContext(tenantId: string): Promise<TenantMailContext> {
    const cached = this.mailContextCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.context;
    }

    const context = await withTenantContext(this.dbProvider.pool, tenantId, async client => {
      const [aliasRows, ownRows] = await Promise.all([
        getActiveAliasesForTenant.run({ ownerId: tenantId }, client),
        getTenantOwnBusinessForIngest.run({ tenantId }, client),
      ]);

      const own = ownRows[0];
      const suggestionData = own?.suggestion_data
        ? suggestionDataSchema.safeParse(own.suggestion_data).data
        : undefined;
      const config = suggestionData?.emailIngestion ?? {};

      const ownAddresses = new Set<string>();
      for (const raw of [...aliasRows.map(row => row.alias), ...(suggestionData?.emails ?? [])]) {
        // Wildcard patterns (`*@vendor.com`) are meaningful to the business lookup
        // but not as literal own-addresses; ownDomains is the lever for a whole domain.
        const email = normalizeEmail(raw);
        if (email) {
          ownAddresses.add(email);
        }
      }

      return {
        ownAddresses,
        ownDomains: new Set((config.ownDomains ?? []).map(domain => domain.trim().toLowerCase())),
        ownNames: [own?.name, own?.hebrew_name].filter((name): name is string => !!name),
        invoicePlatformSenders: new Set(
          [...GLOBAL_INVOICE_PLATFORM_SENDERS, ...(config.extraPlatformSenders ?? [])]
            .map(sender => normalizeEmail(sender))
            .filter((sender): sender is string => sender !== undefined),
        ),
      } satisfies TenantMailContext;
    });

    this.mailContextCache.set(tenantId, { context, expiresAt: Date.now() + MAIL_CONTEXT_TTL_MS });
    return context;
  }

  /** Return the first business whose suggestion_data.emails matches a candidate. */
  private async lookupBusinessByEmails(
    client: PoolClient,
    emails: readonly string[],
  ): Promise<BusinessRecognitionResult> {
    for (const email of emails) {
      const rows = await getBusinessByEmailForIngest.run({ email }, client);
      if (rows.length > 0) {
        return { businessId: rows[0].id, config: parseEmailListenerConfig(rows[0]) };
      }
    }
    return { businessId: null, config: {} };
  }

  /**
   * Validate a presented grant against the stored record **without** consuming it.
   * Runs all the binding checks (existence, expiry, consumed state, action scope,
   * tenant binding, message/hash binding) so callers can resolve the bound
   * business and reject an obviously-invalid grant up front — before doing the
   * fallible, non-transactional document preparation (Cloudinary upload / OCR).
   * The grant is consumed later, atomically with the durable outcome write, via
   * {@link validateAndConsumeGrant} passing the write transaction's client. This
   * separation is what lets the ingest flow decide the grant's fate based on the
   * outcome: an expected preparation failure (e.g. a Cloudinary upload error) is
   * turned into an UPLOAD_FAILED quarantine that consumes the grant atomically
   * with its own recorded write, while an unexpected error throws with the grant
   * still unconsumed, so a gateway retry can succeed instead of hitting an
   * already-consumed grant with nothing recorded.
   */
  async validateGrant(input: ValidateGrantInput): Promise<GrantValidationResult> {
    return withTenantContext(this.dbProvider.pool, input.tenantId, client =>
      this.checkGrant(input, client, false),
    );
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
   *
   * Pass `client` to run inside an existing tenant-pinned transaction so the
   * consume commits atomically with the outcome write (the ingest flow does
   * this); omit it to run in a standalone transaction.
   */
  async validateAndConsumeGrant(
    input: ValidateGrantInput,
    client?: PoolClient,
  ): Promise<GrantValidationResult> {
    if (client) {
      return this.checkGrant(input, client, true);
    }
    return withTenantContext(this.dbProvider.pool, input.tenantId, c =>
      this.checkGrant(input, c, true),
    );
  }

  /**
   * Shared grant-binding checks, optionally followed by the atomic consume.
   * The caller supplies a tenant-pinned `client` (RLS is enforced by the caller's
   * transaction context).
   */
  private async checkGrant(
    input: ValidateGrantInput,
    client: PoolClient,
    consume: boolean,
  ): Promise<GrantValidationResult> {
    const rows = await getGrantByJtiForValidation.run({ jti: input.jti }, client);

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

    if (consume) {
      // Atomic consume-once: if this returns 0 rows a concurrent request beat us to it.
      const consumed = await consumeGrantByJti.run({ jti: input.jti }, client);

      if (consumed.length === 0) {
        return { valid: false, reason: IngestReasonCode.GRANT_INVALID };
      }
    }

    return {
      valid: true,
      grant: {
        jti: grant.jti,
        tenantId: grant.owner_id,
        action: grant.action,
        expiresAt: grant.expires_at,
        businessId: grant.business_id ?? null,
        classification: toEmailKind(grant.classification),
      },
    };
  }
}

/**
 * Narrow the grant's stored classification to {@link EmailKind}. Returns null for a
 * grant issued before the column existed (or one carrying an unrecognized value), so
 * ingest falls back to its previous behavior rather than trusting a bad string.
 */
function toEmailKind(value: string | null | undefined): EmailKind | null {
  const kinds: readonly string[] = Object.values(EmailKind);
  return value && kinds.includes(value) ? (value as EmailKind) : null;
}
