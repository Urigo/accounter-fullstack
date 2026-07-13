import { randomUUID } from 'node:crypto';
import { Injectable, Scope, type Injector } from 'graphql-modules';
import type { PoolClient } from 'pg';
import { sql } from '@pgtyped/runtime';
import { DocumentType } from '../../../shared/enums.js';
import { hashStringToInt } from '../../../shared/helpers/index.js';
import { CloudinaryProvider } from '../../app-providers/cloudinary.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import {
  getDocumentFromUrlsAndOcrData,
  getOcrData,
  type OcrData,
} from '../../documents/helpers/upload.helper.js';
import type { IInsertDocumentsParams } from '../../documents/types.js';
import { IngestOutcome, IngestReasonCode } from '../contracts.js';
import { computeDedupFingerprint } from '../helpers/email-ingestion-dedup.helper.js';
import { withTenantContext } from '../helpers/email-ingestion-tenant-context.helper.js';
import type {
  ICheckDedupFingerprintForIngestQuery,
  ICheckDocumentByHashForIngestQuery,
  ICheckIdempotencyKeyForIngestQuery,
  IInsertDedupFingerprintForIngestQuery,
  IInsertIdempotencyKeyForIngestQuery,
  IInsertIngestChargeQuery,
  IInsertIngestDocumentFullQuery,
  IInsertQuarantineForIngestQuery,
} from '../types.js';
import { EmailIngestionControlProvider } from './email-ingestion-control.provider.js';

/** A single OCR'd document, ready to insert (cf. DocumentsProvider.insertDocuments columns). */
type PreparedDocument = IInsertDocumentsParams['documents'][number];

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
      /** Present only for self-issued skips (SELF_ISSUED); absent for content re-deliveries. */
      reasonCode?: string;
    }
  | { outcome: typeof IngestOutcome.QUARANTINED; auditId: string; reasonCode: string }
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

    // 1. Validate and atomically consume the grant (control-plane, pre-tenant).
    const grantResult = await this.controlProvider.validateAndConsumeGrant({
      jti: grantJti,
      tenantId,
      messageId,
      rawMessageHash,
    });

    if (!grantResult.valid) {
      return { outcome: IngestOutcome.REJECTED, reasonCode: grantResult.reason };
    }

    const corrId = correlationId ?? randomUUID();
    const fingerprint = computeDedupFingerprint(tenantId, rawMessageHash);

    // Self-issued short-circuit: when the recognized issuing business is the
    // tenant's own business, the email is a confirmation of an invoice the
    // tenant issued itself (e.g. via Morning/greeninvoice). That document was
    // already inserted at creation time, so ingesting it would duplicate it —
    // skip before any upload/OCR/insert. Reported as DUPLICATE (the document
    // already exists) with a SELF_ISSUED reason. Persist the idempotency key +
    // dedup fingerprint (as the QUARANTINE path does) so a gateway retry
    // short-circuits at the early idempotency check instead of failing grant
    // validation against the already-consumed grant.
    if (grantResult.grant.businessId === tenantId) {
      const auditId = randomUUID();
      await withTenantContext(this.dbProvider.pool, tenantId, client =>
        this.persistIdempotencyAndDedup({
          idempotencyKey,
          tenantId,
          fingerprint,
          outcome: IngestOutcome.DUPLICATE,
          ingestId: null,
          auditId,
          correlationId: corrId,
          client,
        }),
      );

      return {
        outcome: IngestOutcome.DUPLICATE,
        existingIngestId: null,
        auditId,
        reasonCode: IngestReasonCode.SELF_ISSUED,
      };
    }

    // Prepare documents (hash dedup read + Cloudinary upload + OCR) BEFORE the
    // write transaction, so the network I/O never holds a pooled connection / open
    // transaction. The dedup short-circuits re-deliveries (their documents already
    // exist) so they don't re-upload or re-OCR.
    const preparedDocuments = await this.prepareDocuments(tenantId, extractedDocuments, {
      injector,
      businessId: grantResult.grant.businessId,
      messageId,
    });

    // 2–5. All tenant-bound work runs under the grant tenant's RLS context.
    return withTenantContext(this.dbProvider.pool, tenantId, async client => {
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
        await insertQuarantineForIngest.run(
          {
            reasonCode: IngestReasonCode.NO_DOCUMENTS,
            tenantCandidate: tenantId,
            messageId,
            rawMessageHash,
            correlationId: corrId,
          },
          client,
        );

        const auditId = randomUUID();
        await this.persistIdempotencyAndDedup({
          idempotencyKey,
          tenantId,
          fingerprint,
          outcome: IngestOutcome.QUARANTINED,
          ingestId: null,
          auditId,
          correlationId: corrId,
          client,
        });

        return {
          outcome: IngestOutcome.QUARANTINED,
          auditId,
          reasonCode: IngestReasonCode.NO_DOCUMENTS,
        };
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
    // no network I/O held in a long-lived transaction).
    const newCandidates = await withTenantContext(this.dbProvider.pool, tenantId, async client => {
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
      return fresh;
    });

    // Upload + OCR the new documents in parallel, outside any transaction.
    return Promise.all(
      newCandidates.map(async ({ doc, fileHash }) => {
        const file = new File([Buffer.from(doc.content, 'base64')], doc.filename ?? 'document', {
          type: doc.mimeType,
        });
        const dataUri = `data:${doc.mimeType};base64,${doc.content}`;
        const [{ fileUrl, imageUrl }, ocrData] = await Promise.all([
          this.cloudinaryProvider.uploadInvoiceToCloudinary(dataUri),
          // isSensitive=false → run OCR (Anthropic), as the legacy path does.
          getOcrData(injector, file, false).catch((): OcrData => ({
            documentType: DocumentType.Unprocessed,
          })),
        ]);
        // The recognized issuing business is the counterparty (null when none).
        if (businessId) {
          ocrData.counterpartyId = businessId;
        }
        const params = getDocumentFromUrlsAndOcrData(
          fileUrl,
          imageUrl,
          ocrData,
          tenantId,
          null,
          fileHash,
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
