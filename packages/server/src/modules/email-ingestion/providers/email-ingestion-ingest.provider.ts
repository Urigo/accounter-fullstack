import { randomUUID } from 'node:crypto';
import { Injectable, Scope, type Injector } from 'graphql-modules';
import type { PoolClient } from 'pg';
import { sql } from '@pgtyped/runtime';
import { DocumentType } from '../../../shared/enums.js';
import { hashStringToInt } from '../../../shared/helpers/index.js';
import { CloudinaryProvider } from '../../app-providers/cloudinary.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  BusinessMatchData,
  OwnerMatchInfo,
} from '../../app-providers/helpers/business-matcher.helper.js';
import {
  getDocumentFromUrlsAndOcrData,
  getOcrData,
  resolveOwnerSideFromUuids,
  type OcrData,
} from '../../documents/helpers/upload.helper.js';
import type { IInsertDocumentsParams } from '../../documents/types.js';
import { suggestionDataSchema } from '../../financial-entities/helpers/business-suggestion-data-schema.helper.js';
import { IngestOutcome, IngestReasonCode } from '../contracts.js';
import { EmailKind } from '../helpers/email-ingestion-classify.helper.js';
import { computeDedupFingerprint } from '../helpers/email-ingestion-dedup.helper.js';
import { withTenantContext } from '../helpers/email-ingestion-tenant-context.helper.js';
import type {
  ICheckDedupFingerprintForIngestQuery,
  ICheckDocumentByHashForIngestQuery,
  ICheckIdempotencyKeyForIngestQuery,
  IGetBusinessesForIngestMatchingQuery,
  IGetOwnerLocalityForIngestQuery,
  IInsertDedupFingerprintForIngestQuery,
  IInsertIdempotencyKeyForIngestQuery,
  IInsertIngestChargeQuery,
  IInsertIngestDocumentFullQuery,
  IInsertQuarantineForIngestQuery,
} from '../types.js';
import { EmailIngestionControlProvider } from './email-ingestion-control.provider.js';

/** A single OCR'd document, ready to insert (cf. DocumentsProvider.insertDocuments columns). */
type PreparedDocument = IInsertDocumentsParams['documents'][number];

/**
 * Thrown by {@link EmailIngestionIngestProvider.prepareDocuments} when a document
 * cannot be uploaded/prepared (e.g. the Cloudinary upload fails). Distinguishes an
 * expected, recoverable preparation failure — which the ingest flow turns into an
 * `UPLOAD_FAILED` quarantine (recorded, reprocessable) — from a truly unexpected
 * error, which is rethrown as-is. The original cause is carried on `.cause`.
 */
export class DocumentPreparationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options as ErrorOptions | undefined);
    this.name = 'DocumentPreparationError';
  }
}

// ---------------------------------------------------------------------------
// SQL queries
// ---------------------------------------------------------------------------

const checkIdempotencyKeyForIngest = sql<ICheckIdempotencyKeyForIngestQuery>`
  SELECT id, idempotency_key, owner_id, outcome, ingest_id, audit_id, created_at
    FROM accounter_schema.email_ingestion_idempotency_keys
   WHERE idempotency_key = $idempotencyKey
     AND owner_id = $ownerId
   LIMIT 1
`;

const insertIdempotencyKeyForIngest = sql<IInsertIdempotencyKeyForIngestQuery>`
  INSERT INTO accounter_schema.email_ingestion_idempotency_keys
    (idempotency_key, owner_id, outcome, ingest_id, audit_id)
  VALUES ($idempotencyKey, $ownerId, $outcome, $ingestId, $auditId)
  ON CONFLICT (idempotency_key, owner_id) DO NOTHING
  RETURNING id, idempotency_key, owner_id, outcome, ingest_id, audit_id, created_at
`;

const checkDedupFingerprintForIngest = sql<ICheckDedupFingerprintForIngestQuery>`
  SELECT id, owner_id, fingerprint, outcome, ingest_id, correlation_id, created_at
    FROM accounter_schema.email_ingestion_dedup_fingerprints
   WHERE owner_id = $ownerId
     AND fingerprint = $fingerprint
   LIMIT 1
`;

const insertDedupFingerprintForIngest = sql<IInsertDedupFingerprintForIngestQuery>`
  INSERT INTO accounter_schema.email_ingestion_dedup_fingerprints
    (owner_id, fingerprint, outcome, ingest_id, correlation_id)
  VALUES ($ownerId, $fingerprint, $outcome, $ingestId, $correlationId)
  ON CONFLICT (owner_id, fingerprint) DO NOTHING
  RETURNING id, owner_id, fingerprint, outcome, ingest_id, correlation_id, created_at
`;

const insertQuarantineForIngest = sql<IInsertQuarantineForIngestQuery>`
  INSERT INTO accounter_schema.email_ingestion_quarantine
    (reason_code, tenant_candidate, message_id, raw_message_hash, correlation_id)
  VALUES ($reasonCode, $tenantCandidate, $messageId, $rawMessageHash, $correlationId)
  RETURNING id
`;

// The tenant's businesses, feeding the OCR business matcher. `OR b.id = $ownerId`
// includes the tenant's own row, which is what lets resolveOwnerSideFromUuids
// recognize an owner-side match. Read here on a tenant-pinned client rather than via
// BusinessesProvider, whose TenantAwareDBClient throws "Missing businessId in
// AuthContext" in this control-plane context; the explicit owner filter is defense in
// depth on top of RLS.
const getBusinessesForIngestMatching = sql<IGetBusinessesForIngestMatchingQuery>`
  SELECT b.id, fe.name, b.hebrew_name, b.vat_number, b.suggestion_data, b.country
    FROM accounter_schema.businesses b
    INNER JOIN accounter_schema.financial_entities fe
      ON fe.id = b.id
   WHERE b.owner_id = $ownerId
      OR b.id = $ownerId
`;

// The tenant's locality, for the foreign-counterparty VAT-0 fallback. Read here for
// the same reason as above (AdminContextProvider is auth-coupled).
const getOwnerLocalityForIngest = sql<IGetOwnerLocalityForIngestQuery>`
  SELECT locality
    FROM accounter_schema.user_context
   WHERE owner_id = $ownerId
   LIMIT 1
`;

const checkDocumentByHashForIngest = sql<ICheckDocumentByHashForIngestQuery>`
  SELECT id
    FROM accounter_schema.documents
   WHERE owner_id = $ownerId
     AND file_hash = $fileHash
   LIMIT 1
`;

const insertIngestCharge = sql<IInsertIngestChargeQuery>`
  INSERT INTO accounter_schema.charges
    (owner_id, type, accountant_status, user_description, tax_category_id, optional_vat, documents_optional_flag, is_property)
  VALUES ($ownerId, NULL, $accountantStatus, $userDescription, NULL, FALSE, FALSE, FALSE)
  RETURNING id
`;

const insertIngestDocumentFull = sql<IInsertIngestDocumentFullQuery>`
  INSERT INTO accounter_schema.documents
    (owner_id, charge_id, type, file_url, image_url, file_hash, serial_number, date,
     total_amount, currency_code, vat_amount, vat_report_date_override, no_vat_amount,
     allocation_number, exchange_rate_override, description, remarks, creditor_id, debtor_id)
  VALUES ($ownerId, $chargeId, $documentType, $fileUrl, $imageUrl, $fileHash, $serialNumber, $date,
     $amount, $currencyCode, $vat, $vatReportDateOverride, $noVatAmount,
     $allocationNumber, $exchangeRateOverride, $description, $remarks, $creditorId, $debtorId)
  RETURNING id
`;

// ---------------------------------------------------------------------------
// Public input / output types
// ---------------------------------------------------------------------------

export type IngestInput = {
  grantJti: string;
  idempotencyKey: string;
  tenantId: string;
  messageId: string;
  rawMessageHash: string;
  correlationId?: string;
  /** Email subject header, used to build a human-readable charge description. */
  subject?: string;
  /** Sender (From header) address, used in the charge description. */
  sender?: string;
  /** ISO-8601 timestamp the message was received, used in the charge description. */
  receivedAt?: string;
  extractedDocuments: Array<{
    hash: string;
    sizeBytes: number;
    mimeType: string;
    filename?: string | null;
    /** Base64-encoded document bytes (inline transport); omitted = metadata only. */
    content?: string | null;
  }>;
};

/**
 * Build the human-readable charge description for an ingested email, mirroring
 * the legacy gmail-listener phrasing:
 * `Email documents: <subject> (from: <sender>, <date>)`.
 *
 * The v2 gateway pipeline can omit any of subject/sender/receivedAt (parse
 * failures, missing headers), so each part degrades gracefully: a missing
 * subject falls back to the message id, and the parenthetical sender/date
 * details are dropped when neither is available.
 */
function buildEmailChargeDescription(args: {
  messageId: string;
  subject?: string;
  sender?: string;
  receivedAt?: string;
}): string {
  const subject = args.subject?.trim() || args.messageId;
  const sender = args.sender?.trim();

  // Format in UTC (not the server-local `toDateString()`) so the same email
  // yields the same description across dev/CI/prod. Mirrors the legacy
  // `toDateString()` shape, e.g. "Wed Jun 24 2026".
  const receivedDate = args.receivedAt ? new Date(args.receivedAt) : null;
  const dateStr =
    receivedDate && !Number.isNaN(receivedDate.getTime())
      ? receivedDate
          .toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          })
          .replace(/,/g, '')
      : null;

  const details = [sender ? `from: ${sender}` : null, dateStr].filter(Boolean).join(', ');

  return details ? `Email documents: ${subject} (${details})` : `Email documents: ${subject}`;
}

export type IngestResult =
  | { outcome: typeof IngestOutcome.INSERTED; ingestId: string; auditId: string }
  | {
      outcome: typeof IngestOutcome.DUPLICATE;
      existingIngestId: string | null;
      auditId: string;
    }
  | {
      outcome: typeof IngestOutcome.QUARANTINED | typeof IngestOutcome.IGNORED;
      auditId: string;
      reasonCode: string;
    }
  | { outcome: typeof IngestOutcome.REJECTED; reasonCode: string };

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Orchestrates the v2 ingest flow for gateway-initiated ingestion.
 *
 * The caller presents a gateway_control_plane auth token with an empty
 * businessId, so TenantAwareDBClient (which derives the tenant from the auth
 * session) cannot be used here — the authoritative tenant comes from the
 * single-use, cryptographically-validated grant instead. To still get RLS as a
 * second defense layer, all tenant-bound reads/writes run inside one
 * transaction whose `app.current_business_id` is pinned to the grant tenant
 * (see {@link withTenantContext}); the `tenant_isolation` WITH CHECK policies
 * on the idempotency/dedup/quarantine tables then enforce
 * `owner_id = tenantId` on top of the explicit owner_id filters in each query.
 *
 * Flow: grant validation → idempotency check → dedup check → quarantine or insert.
 */
@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class EmailIngestionIngestProvider {
  constructor(
    private dbProvider: DBProvider,
    private controlProvider: EmailIngestionControlProvider,
    private cloudinaryProvider: CloudinaryProvider,
  ) {}

  async performIngest(input: IngestInput, injector: Injector): Promise<IngestResult> {
    const {
      grantJti,
      idempotencyKey,
      tenantId,
      messageId,
      rawMessageHash,
      correlationId,
      subject,
      sender,
      receivedAt,
      extractedDocuments,
    } = input;

    // 0. Early idempotency short-circuit: if a prior ingest for this key already
    //    committed, return DUPLICATE before consuming the grant. Prevents gateway
    //    retries (after a client-side timeout) from burning the grant and getting
    //    GRANT_INVALID when the first attempt actually succeeded.
    const earlyIdem = await withTenantContext(this.dbProvider.pool, tenantId, async client =>
      checkIdempotencyKeyForIngest.run({ idempotencyKey, ownerId: tenantId }, client),
    );
    if (earlyIdem.length > 0) {
      const r = earlyIdem[0];
      return {
        outcome: IngestOutcome.DUPLICATE,
        existingIngestId: r.ingest_id,
        auditId: r.audit_id ?? '',
      };
    }

    // 1. Validate the grant WITHOUT consuming it yet. Consuming here (in its own
    //    committed transaction) and only later doing the fallible, non-transactional
    //    document prep (Cloudinary upload / OCR) is what previously stranded emails:
    //    a prep failure left the grant burned with nothing recorded — no document,
    //    no quarantine, no idempotency row — and every retry then hit an
    //    already-consumed grant (GRANT_INVALID → REJECTED). Instead, validate now to
    //    resolve the bound business, run prep while the grant is still intact, and
    //    consume the grant atomically inside the write transaction below.
    const grantResult = await this.controlProvider.validateGrant({
      jti: grantJti,
      tenantId,
      messageId,
      rawMessageHash,
    });

    if (!grantResult.valid) {
      return { outcome: IngestOutcome.REJECTED, reasonCode: grantResult.reason };
    }

    const businessId = grantResult.grant.businessId;
    const corrId = correlationId ?? randomUUID();
    const fingerprint = computeDedupFingerprint(tenantId, rawMessageHash);

    // Self-issued short-circuit: a copy of a document the tenant issued itself (e.g.
    // via Morning/greeninvoice), whose document already exists from creation — so we
    // must not re-insert it. Skip before any upload/OCR/insert.
    //
    // The signal is the classification bound at control time, not `businessId ===
    // tenantId`. That older inference conflated genuine self-issued mail with a real
    // supplier invoice forwarded in by a colleague, whose every recoverable address
    // belonged to the tenant and so matched the tenant's own business; those were
    // wrongly withheld. Grants issued before the column existed carry no
    // classification, so the old comparison stays as the fallback.
    //
    // Recorded as IGNORED rather than QUARANTINED: the audit row keeps the decision
    // visible and reprocessable, but routine self-issued mail is not an operational
    // failure and must not fill the triage queue. Consume the grant and persist the
    // audit row + idempotency key + dedup fingerprint in one transaction so a gateway
    // retry short-circuits at the early idempotency check.
    const selfIssued =
      grantResult.grant.classification === EmailKind.SELF_ISSUED ||
      (grantResult.grant.classification === null && businessId === tenantId);

    if (selfIssued) {
      return withTenantContext(this.dbProvider.pool, tenantId, async client => {
        const consumed = await this.controlProvider.validateAndConsumeGrant(
          { jti: grantJti, tenantId, messageId, rawMessageHash },
          client,
        );
        if (!consumed.valid) {
          return { outcome: IngestOutcome.REJECTED, reasonCode: consumed.reason };
        }

        return this.recordNonInsert(client, {
          outcome: IngestOutcome.IGNORED,
          reasonCode: IngestReasonCode.SELF_ISSUED,
          tenantId,
          messageId,
          rawMessageHash,
          idempotencyKey,
          fingerprint,
          correlationId: corrId,
        });
      });
    }

    // Prepare documents (hash dedup read + Cloudinary upload + OCR) BEFORE the
    // write transaction — and, critically, before the grant is consumed — so the
    // network I/O never holds a pooled connection / open transaction, and the grant
    // is still unconsumed when prep runs. That lets the catch below choose the
    // grant's fate: an expected DocumentPreparationError becomes an UPLOAD_FAILED
    // quarantine (grant consumed atomically with that recorded write), while any
    // other error rethrows with the grant unconsumed, leaving the email retryable.
    // The dedup short-circuits re-deliveries (their documents already exist) so
    // they don't re-upload or re-OCR.
    let preparedDocuments: PreparedDocument[];
    try {
      preparedDocuments = await this.prepareDocuments(tenantId, extractedDocuments, {
        injector,
        businessId,
        messageId,
      });
    } catch (err) {
      if (!(err instanceof DocumentPreparationError)) {
        // Unexpected (e.g. a DB error during the dedup read). Leave the grant
        // unconsumed and let it surface — nothing is recorded, and a retry can run.
        throw err;
      }
      // Expected, recoverable failure: a document couldn't be uploaded/prepared
      // (e.g. Cloudinary was down). Consume the grant and QUARANTINE the email in a
      // single transaction so the failure is recorded and reprocessable via the
      // quarantine workflow, instead of throwing raw and leaving the accepted email
      // with no durable trace.
      console.error(
        `email ingest: document preparation failed (correlationId: ${corrId}, messageId: ${messageId}):`,
        err.cause ?? err,
      );
      return withTenantContext(this.dbProvider.pool, tenantId, async client => {
        const consumed = await this.controlProvider.validateAndConsumeGrant(
          { jti: grantJti, tenantId, messageId, rawMessageHash },
          client,
        );
        if (!consumed.valid) {
          return { outcome: IngestOutcome.REJECTED, reasonCode: consumed.reason };
        }
        return this.recordNonInsert(client, {
          outcome: IngestOutcome.QUARANTINED,
          reasonCode: IngestReasonCode.UPLOAD_FAILED,
          tenantId,
          messageId,
          rawMessageHash,
          idempotencyKey,
          fingerprint,
          correlationId: corrId,
        });
      });
    }

    // 2–5. All tenant-bound work runs under the grant tenant's RLS context, in a
    // single transaction: consume the grant, then check idempotency/dedup and
    // quarantine-or-insert — so consumption commits atomically with the outcome.
    return withTenantContext(this.dbProvider.pool, tenantId, async client => {
      // Atomically consume the grant as the first write of this transaction. If it
      // was consumed concurrently (or lapsed during prep) this rolls the whole
      // transaction back with nothing written — and, unlike before, no document
      // upload was wasted on a grant that couldn't be honored.
      const consumed = await this.controlProvider.validateAndConsumeGrant(
        { jti: grantJti, tenantId, messageId, rawMessageHash },
        client,
      );
      if (!consumed.valid) {
        return { outcome: IngestOutcome.REJECTED, reasonCode: consumed.reason };
      }

      // 2. Idempotency check — return prior outcome if this key was already processed.
      const idemRows = await checkIdempotencyKeyForIngest.run(
        { idempotencyKey, ownerId: tenantId },
        client,
      );
      if (idemRows.length > 0) {
        const r = idemRows[0];
        return {
          outcome: IngestOutcome.DUPLICATE,
          existingIngestId: r.ingest_id,
          auditId: r.audit_id,
        };
      }

      // 3. Dedup fingerprint check — detect identical content re-delivery.
      const dedupRows = await checkDedupFingerprintForIngest.run(
        { ownerId: tenantId, fingerprint },
        client,
      );
      if (dedupRows.length > 0) {
        const r = dedupRows[0];
        return {
          outcome: IngestOutcome.DUPLICATE,
          existingIngestId: r.ingest_id,
          auditId: randomUUID(),
        };
      }

      // 4. Quarantine if no documents were extracted.
      if (extractedDocuments.length === 0) {
        return this.recordNonInsert(client, {
          outcome: IngestOutcome.QUARANTINED,
          reasonCode: IngestReasonCode.NO_DOCUMENTS,
          tenantId,
          messageId,
          rawMessageHash,
          idempotencyKey,
          fingerprint,
          correlationId: corrId,
        });
      }

      // 5. Happy path: insert the prepared documents (charge + documents) under
      // the recognized business bound in the grant — no network I/O here, the
      // bytes were already uploaded outside this transaction — then record the
      // ingest. The created charge id doubles as the ingest id; with nothing new
      // to persist (metadata-only, or all duplicates) a synthetic id is used.
      const chargeId =
        preparedDocuments.length > 0
          ? await this.insertPreparedDocuments(client, {
              tenantId,
              messageId,
              subject,
              sender,
              receivedAt,
              preparedDocuments,
            })
          : null;

      const ingestId = chargeId ?? randomUUID();
      const auditId = randomUUID();

      const idemResult = await this.persistIdempotencyAndDedup({
        idempotencyKey,
        tenantId,
        fingerprint,
        outcome: IngestOutcome.INSERTED,
        ingestId,
        auditId,
        correlationId: corrId,
        client,
      });

      return {
        outcome: IngestOutcome.INSERTED,
        ingestId: idemResult.ingestId ?? ingestId,
        auditId: idemResult.auditId,
      };
    });
  }

  /**
   * Prepare documents for persistence WITHOUT holding the write transaction open:
   * dedup new documents by hash (a short read), then upload to Cloudinary and OCR
   * (Anthropic) in parallel, outside any transaction. This mirrors the legacy
   * `getDocumentFromFile` path (Cloudinary upload + `getOcrData` + `figureOutSides`)
   * so v2 produces the same classified documents as `insertEmailDocuments`, but
   * owned by the grant tenant (the auth-coupled providers cannot run in the gateway
   * control-plane context).
   *
   * The hash matches the legacy `hashStringToInt(file.text())` scheme so the dedup
   * is consistent across both paths; re-deliveries short-circuit here and never
   * re-upload or re-OCR. Metadata-only entries (no inline bytes) yield an empty
   * result. OCR failure is non-fatal — the document falls back to UNPROCESSED
   * rather than failing the whole ingest.
   */
  private async prepareDocuments(
    tenantId: string,
    documents: IngestInput['extractedDocuments'],
    opts: { injector: Injector; businessId: string | null; messageId: string },
  ): Promise<PreparedDocument[]> {
    const { injector, businessId, messageId } = opts;

    type DocWithContent = (typeof documents)[number] & { content: string };
    const withContent = documents.filter(
      (doc): doc is DocWithContent => typeof doc.content === 'string' && doc.content.length > 0,
    );
    if (withContent.length === 0) {
      return [];
    }

    const candidates = withContent.map(doc => ({
      doc,
      fileHash: hashStringToInt(Buffer.from(doc.content, 'base64').toString('utf8')),
    }));

    // Find the documents new to this tenant under its RLS context (a short read,
    // no network I/O held in a long-lived transaction). In the same tenant-pinned
    // read, resolve the inputs the document pipeline would otherwise fetch through
    // the auth-coupled Businesses/AdminContext providers, whose TenantAwareDBClient
    // throws "Missing businessId in AuthContext" in this control-plane context:
    //   - the tenant's businesses + its locality, feeding the OCR business matcher
    //     (`matchBusiness` / the LLM match fallback). Without these the matcher gets
    //     an empty list and every `suggestedIssuer`/`suggestedRecipient` is null, so
    //     documents from senders not keyed in `suggestion_data.emails` were inserted
    //     with no creditor/debtor even when the issuer name was extracted perfectly.
    //   - the tenant's locality for the foreign-counterparty VAT-0 fallback (the
    //     counterparty's country is read off the businesses list below, once the
    //     final counterparty is known).
    // These use the raw client directly (no pgtyped) so the control-plane read stays
    // self-contained; RLS is pinned to the tenant, and the explicit owner_id filter
    // is defense-in-depth.
    const { newCandidates, businesses, owner } = await withTenantContext(
      this.dbProvider.pool,
      tenantId,
      async client => {
        const fresh: typeof candidates = [];
        for (const candidate of candidates) {
          const existing = await checkDocumentByHashForIngest.run(
            { ownerId: tenantId, fileHash: candidate.fileHash.toString() },
            client,
          );
          if (existing.length === 0) {
            fresh.push(candidate);
          }
        }

        if (fresh.length === 0) {
          return { newCandidates: fresh, businesses: [], owner: undefined };
        }

        const [businessRows, localityRows] = await Promise.all([
          getBusinessesForIngestMatching.run({ ownerId: tenantId }, client),
          getOwnerLocalityForIngest.run({ ownerId: tenantId }, client),
        ]);

        // Mirror `fetchBusinessesForMatching` in upload.helper.ts.
        const matchData: BusinessMatchData[] = businessRows.map(b => ({
          id: b.id,
          name: b.name ?? null,
          hebrew_name: b.hebrew_name ?? null,
          vat_number: b.vat_number ?? null,
          suggestion_data: suggestionDataSchema.safeParse(b.suggestion_data).data ?? null,
          locality: b.country ?? null,
        }));

        return {
          newCandidates: fresh,
          businesses: matchData,
          owner: {
            id: tenantId,
            locality: localityRows[0]?.locality ?? null,
          } satisfies OwnerMatchInfo,
        };
      },
    );

    // Upload + OCR the new documents in parallel, outside any transaction. A
    // failure here — the Cloudinary upload or the params build; OCR itself is
    // caught above and degrades to UNPROCESSED — is wrapped in
    // DocumentPreparationError so the caller QUARANTINEs the email (recorded,
    // reprocessable) instead of letting it throw raw and strand an accepted email
    // with no durable record.
    try {
      return await Promise.all(
        newCandidates.map(async ({ doc, fileHash }) => {
          const file = new File([Buffer.from(doc.content, 'base64')], doc.filename ?? 'document', {
            type: doc.mimeType,
          });
          const dataUri = `data:${doc.mimeType};base64,${doc.content}`;
          const [{ fileUrl, imageUrl }, ocrData] = await Promise.all([
            this.cloudinaryProvider.uploadInvoiceToCloudinary(dataUri),
            // isSensitive=false → run OCR (Anthropic), as the legacy path does.
            // The pre-resolved businesses/owner enable the OCR business matcher in
            // this control-plane context (see the read block above).
            getOcrData(injector, file, false, { businesses, owner }).catch((): OcrData => ({
              documentType: DocumentType.Unprocessed,
            })),
          ]);
          // The business recognized at control time from the sender address is the
          // counterparty. It stays authoritative: resolveOwnerSideFromUuids fills
          // `counterpartyId` only when unset (`??=`), so the OCR name/VAT match acts
          // as the fallback for mail that arrives via an aggregator/forwarder whose
          // address is not keyed in any business's `suggestion_data.emails`. The OCR
          // match is still consulted for `isOwnerIssuer`, which orients the sides.
          if (businessId) {
            ocrData.counterpartyId = businessId;
          }
          resolveOwnerSideFromUuids(ocrData, tenantId);
          if (businessId) {
            const ocrCounterparty = [ocrData.suggestedIssuer, ocrData.suggestedRecipient].find(
              id => id != null && id !== tenantId,
            );
            if (ocrCounterparty && ocrCounterparty !== businessId) {
              console.warn(
                `email ingest: counterparty disagreement (messageId: ${messageId}): grant business ${businessId} kept over OCR match ${ocrCounterparty}`,
              );
            }
          }
          const params = await getDocumentFromUrlsAndOcrData(
            injector,
            fileUrl,
            imageUrl,
            ocrData,
            tenantId,
            null,
            fileHash,
            // Pre-resolved above (raw pool, tenant RLS) so the fallback never calls
            // the auth-coupled providers in this control-plane context. The
            // counterparty country is taken off the loaded businesses list against
            // the *final* counterparty — which may have come from the OCR match, not
            // just the grant.
            {
              counterpartyCountry:
                businesses.find(b => b.id === ocrData.counterpartyId)?.locality ?? null,
              adminLocality: owner?.locality ?? null,
            },
          );
          // Mirror the legacy `insertEmailDocuments` resolver, which overrides the
          // OCR-derived remarks with an email identifier. (There it is the email
          // description; the v2 ingest payload carries only the message id.) All
          // other OCR fields — amount, currency, date, serial — are persisted as-is.
          params.remarks = [params.remarks, `email-ingestion: ${messageId}`]
            .filter(Boolean)
            .join('; ');
          return params;
        }),
      );
    } catch (err) {
      throw new DocumentPreparationError('Failed to prepare email documents for ingest', {
        cause: err,
      });
    }
  }

  /**
   * Record a non-insert outcome inside the caller's tenant-pinned write transaction:
   * insert the audit row and persist the idempotency key + dedup fingerprint (so a
   * re-delivery short-circuits) under a single audit id.
   *
   * The row always lands in the quarantine table — it is the module's durable record
   * of "an email arrived and was not inserted", and the reprocessing workflow reads
   * from it. `outcome` is what distinguishes a failure needing triage (QUARANTINED:
   * NO_DOCUMENTS, UPLOAD_FAILED) from a deliberate skip (IGNORED: SELF_ISSUED).
   */
  private async recordNonInsert(
    client: PoolClient,
    args: {
      outcome: typeof IngestOutcome.QUARANTINED | typeof IngestOutcome.IGNORED;
      reasonCode: IngestReasonCode;
      tenantId: string;
      messageId: string;
      rawMessageHash: string;
      idempotencyKey: string;
      fingerprint: string;
      correlationId: string;
    },
  ): Promise<IngestResult> {
    const {
      outcome,
      reasonCode,
      tenantId,
      messageId,
      rawMessageHash,
      idempotencyKey,
      fingerprint,
      correlationId,
    } = args;

    await insertQuarantineForIngest.run(
      { reasonCode, tenantCandidate: tenantId, messageId, rawMessageHash, correlationId },
      client,
    );

    const auditId = randomUUID();
    await this.persistIdempotencyAndDedup({
      idempotencyKey,
      tenantId,
      fingerprint,
      outcome,
      ingestId: null,
      auditId,
      correlationId,
      client,
    });

    return { outcome, auditId, reasonCode };
  }

  /**
   * Insert already-prepared (uploaded + OCR'd) documents under one charge, owned
   * by the grant tenant. Runs entirely inside the caller's transaction with no
   * network I/O. Returns the created charge id.
   */
  private async insertPreparedDocuments(
    client: PoolClient,
    args: {
      tenantId: string;
      messageId: string;
      subject?: string;
      sender?: string;
      receivedAt?: string;
      preparedDocuments: PreparedDocument[];
    },
  ): Promise<string> {
    const { tenantId, messageId, subject, sender, receivedAt, preparedDocuments } = args;

    const [charge] = await insertIngestCharge.run(
      {
        ownerId: tenantId,
        userDescription: buildEmailChargeDescription({ messageId, subject, sender, receivedAt }),
        accountantStatus: 'UNAPPROVED',
      },
      client,
    );
    const chargeId = charge.id;

    for (const doc of preparedDocuments) {
      await insertIngestDocumentFull.run(
        {
          ownerId: tenantId,
          chargeId,
          documentType: doc.documentType,
          fileUrl: doc.file ?? null,
          imageUrl: doc.image ?? null,
          fileHash: doc.fileHash ?? null,
          serialNumber: doc.serialNumber ?? null,
          date: doc.date ?? null,
          amount: doc.amount ?? null,
          currencyCode: doc.currencyCode ?? null,
          vat: doc.vat ?? null,
          vatReportDateOverride: doc.vatReportDateOverride ?? null,
          noVatAmount: doc.noVatAmount ?? null,
          allocationNumber: doc.allocationNumber ?? null,
          exchangeRateOverride: doc.exchangeRateOverride ?? null,
          description: doc.description ?? null,
          remarks: doc.remarks ?? null,
          creditorId: doc.creditorId ?? null,
          debtorId: doc.debtorId ?? null,
        },
        client,
      );
    }

    return chargeId;
  }

  private async persistIdempotencyAndDedup(args: {
    idempotencyKey: string;
    tenantId: string;
    fingerprint: string;
    outcome: IngestOutcome;
    ingestId: string | null;
    auditId: string;
    correlationId: string;
    client: PoolClient;
  }): Promise<{ ingestId: string | null; auditId: string }> {
    const {
      idempotencyKey,
      tenantId,
      fingerprint,
      outcome,
      ingestId,
      auditId,
      correlationId,
      client,
    } = args;

    const idemRows = await insertIdempotencyKeyForIngest.run(
      { idempotencyKey, ownerId: tenantId, outcome, ingestId, auditId },
      client,
    );

    await insertDedupFingerprintForIngest.run(
      { ownerId: tenantId, fingerprint, outcome, ingestId, correlationId },
      client,
    );

    if (idemRows.length > 0) {
      return { ingestId: idemRows[0].ingest_id, auditId: idemRows[0].audit_id };
    }

    // Conflict: a concurrent request inserted the idempotency record first.
    // Fetch the stored record so we return the IDs that were actually persisted.
    const existing = await insertIdempotencyKeyForIngest.run(
      { idempotencyKey, ownerId: tenantId },
      client,
    );
    if (existing.length > 0) {
      return { ingestId: existing[0].ingest_id, auditId: existing[0].audit_id };
    }
    return { ingestId, auditId };
  }
}
