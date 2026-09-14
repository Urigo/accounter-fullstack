import type { Injector } from 'graphql-modules';
import { DocumentType } from '../../../shared/enums.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { isSupportedFileType } from '../../app-providers/anthropic.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import type {
  IGetAllDocumentsResult,
  IInsertDocumentsParams,
  IUpdateDocumentParams,
} from '../types.js';
import { fetchRemoteDocument } from './fetch-remote-document.helper.js';
import {
  getDocumentFromUrlsAndOcrData,
  getOcrData,
  releaseDbConnectionForExternalWork,
  resolveOwnerSideFromUuids,
} from './upload.helper.js';

type OcrDocumentParams = IInsertDocumentsParams['documents'][number];

/** Raised for the failures a caller can report per-document rather than as a server fault. */
export class ReprocessOcrError extends Error {}

export type ReprocessOcrResult = {
  document: IGetAllDocumentsResult;
  /** Names of the columns this pass actually filled in. Empty means nothing was written. */
  updatedFields: string[];
};

/**
 * The columns re-OCR may fill, as [update param, OCR param, column name] — the three vocabularies
 * disagree (the insert side calls them `amount` and `vat`, the update side `totalAmount` and
 * `vatAmount`, the table `total_amount` and `vat_amount`), so the mapping is written out once here
 * rather than guessed at each use.
 *
 * `type` is absent on purpose: it is never null on a row, so it cannot go through the fill-a-blank
 * rule. `no_vat_amount`, `vat_report_date_override` and `exchange_rate_override` are absent because
 * OCR never produces them.
 */
const FILLABLE_FIELDS = [
  ['serialNumber', 'serialNumber', 'serial_number'],
  ['date', 'date', 'date'],
  ['totalAmount', 'amount', 'total_amount'],
  ['currencyCode', 'currencyCode', 'currency_code'],
  ['vatAmount', 'vat', 'vat_amount'],
  ['allocationNumber', 'allocationNumber', 'allocation_number'],
  ['description', 'description', 'description'],
  ['remarks', 'remarks', 'remarks'],
  ['creditorId', 'creditorId', 'creditor_id'],
  ['debtorId', 'debtorId', 'debtor_id'],
] as const satisfies ReadonlyArray<
  readonly [keyof IUpdateDocumentParams, keyof OcrDocumentParams, keyof IGetAllDocumentsResult]
>;

/**
 * Re-fetch a document's stored file and OCR it again.
 *
 * The bytes are not kept anywhere after ingestion — Anthropic is sent them inline and hands back no
 * handle — so the only route to them is the Cloudinary URL on the row. That makes this a download
 * plus a fresh extraction, not a replay of anything.
 *
 * The write is deliberately additive: a column is filled only where the row is currently empty, so
 * a value an accountant corrected by hand can never be overwritten by a later model run. The one
 * exception is `type`, replaced only while the document is still UNPROCESSED — the state this whole
 * path exists to get a document out of.
 */
export async function reprocessDocumentOcr(
  injector: Injector,
  documentId: string,
): Promise<ReprocessOcrResult> {
  const documentsProvider = injector.get(DocumentsProvider);
  const document = await documentsProvider.getDocumentsByIdLoader.load(documentId);
  if (!document) {
    throw new ReprocessOcrError(`Document ID="${documentId}" not found`);
  }

  const source = document.file_url ?? document.image_url;
  if (!source) {
    throw new ReprocessOcrError(`Document ID="${documentId}" has no stored file to re-process`);
  }

  // The download and the OCR round trip that follow are minutes of external I/O needing nothing
  // from Postgres. Holding a pooled connection across them is what the upload path takes pains to
  // avoid (see the comment on `releaseDbConnectionForExternalWork`); this path has the same shape.
  await releaseDbConnectionForExternalWork(injector);

  const file = await fetchOcrableFile(source, document);

  // `getOcrData` defaults its third argument to "sensitive", which returns UNPROCESSED without
  // calling the model at all. Passing `false` explicitly is what makes this function do anything.
  const ocrData = await getOcrData(injector, file, false);
  resolveOwnerSideFromUuids(ocrData, document.owner_id);

  // The URLs are passed back in unchanged only because the signature wants them; the file is
  // already stored and the returned `file`/`image` fields are discarded below.
  const ocrParams = await getDocumentFromUrlsAndOcrData(
    injector,
    document.file_url ?? '',
    document.image_url ?? '',
    ocrData,
    document.owner_id,
    document.charge_id,
    document.file_hash ? Number(document.file_hash) : undefined,
  );

  const { params, updatedFields } = buildFillOnlyUpdate(documentId, document, ocrParams);

  // Nothing new came back. Skip the UPDATE entirely rather than bumping `updated_at` and dragging
  // the charge's accountant approval back to PENDING for a pass that changed nothing.
  if (updatedFields.length === 0) {
    return { document, updatedFields };
  }

  const [updated] = await documentsProvider.updateDocument(params);
  if (!updated) {
    throw new ReprocessOcrError(`Failed updating document ID="${documentId}" after OCR`);
  }

  return { document: updated, updatedFields };
}

/**
 * Fetch the document's bytes in a form the OCR model accepts.
 *
 * `fetchRemoteDocument`'s allowlist is wider than Anthropic's — it also passes heic, heif and tiff —
 * so a stored original can be perfectly retrievable and still be rejected downstream. Cloudinary
 * derives a `.jpg` alongside every upload and `image_url` points at it, so that derivative is the
 * fallback rather than a failure.
 */
async function fetchOcrableFile(source: string, document: IGetAllDocumentsResult): Promise<File> {
  const file = await fetchRemoteDocument(source);
  if (isSupportedFileType(file.type.toLowerCase())) {
    return file;
  }

  const derivative = document.image_url;
  if (!derivative || derivative === source) {
    throw new ReprocessOcrError(
      `Document ID="${document.id}" is stored as "${file.type}", which cannot be sent to OCR, and has no image derivative to fall back on`,
    );
  }

  const fallback = await fetchRemoteDocument(derivative);
  if (!isSupportedFileType(fallback.type.toLowerCase())) {
    throw new ReprocessOcrError(
      `Document ID="${document.id}" has no OCR-compatible representation (original "${file.type}", derivative "${fallback.type}")`,
    );
  }
  return fallback;
}

/**
 * Turn the OCR result into an update that can only add information.
 *
 * `DocumentsProvider.updateDocument` COALESCEs every column, so a `null` argument means "leave it
 * alone" — exactly the semantics wanted here, and why the filtering is expressed by nulling out the
 * fields the document already has a value for.
 */
function buildFillOnlyUpdate(
  documentId: string,
  document: IGetAllDocumentsResult,
  ocrParams: OcrDocumentParams,
): { params: IUpdateDocumentParams; updatedFields: string[] } {
  const updatedFields: string[] = [];

  const params: IUpdateDocumentParams = {
    documentId,
    // Not derived by OCR, or deliberately preserved: the charge the document already belongs to,
    // the stored file URLs, the manual overrides, and the review flag — `updateDocument`'s own
    // resolver forces `isReviewed: true`, which must not happen behind a re-OCR.
    chargeId: null,
    fileUrl: null,
    imageUrl: null,
    vatReportDateOverride: null,
    exchangeRateOverride: null,
    noVatAmount: null,
    isReviewed: null,
    type: null,
    serialNumber: null,
    date: null,
    totalAmount: null,
    currencyCode: null,
    vatAmount: null,
    allocationNumber: null,
    description: null,
    remarks: null,
    creditorId: null,
    debtorId: null,
  };

  for (const [updateKey, ocrKey, column] of FILLABLE_FIELDS) {
    const next = ocrParams[ocrKey];
    if (document[column] == null && next != null) {
      // Key and value are read off the same tuple, so the assignment is sound even though the loop
      // erases the per-field type relationship.
      (params as Record<string, unknown>)[updateKey] = next;
      updatedFields.push(column);
    }
  }

  // A row's type is never null, so the fill-a-blank rule cannot express "still unclassified".
  // UNPROCESSED is that state, and moving out of it is the point of this path.
  if (
    document.type === DocumentType.Unprocessed &&
    ocrParams.documentType &&
    ocrParams.documentType !== DocumentType.Unprocessed
  ) {
    params.type = ocrParams.documentType;
    updatedFields.push('type');
  }

  return { params, updatedFields };
}

/**
 * Upper bound on a single batch request.
 *
 * Each document costs a download plus an OCR round trip measured in tens of seconds, and there is
 * no job queue in this server to hand the work to — the mutation holds the request open for its
 * whole duration. Twenty at a time is what fits inside a normal proxy idle timeout at the
 * concurrency below; clearing a larger backlog means pressing the button again.
 */
export const MAX_REPROCESS_OCR_BATCH = 20;

/** Parallel OCR passes per batch. Kept low: each one is an upstream API call billed per document. */
const REPROCESS_OCR_CONCURRENCY = 3;

export type ReprocessDocumentOcrGraphqlResult =
  ReprocessOcrResult | { __typename: 'CommonError'; message: string };

/**
 * Re-process a list of documents and report one result per input id, in order.
 *
 * One document's failure must not sink the rest — a backlog being cleared will always contain rows
 * that cannot be recovered (no stored file, an unreadable scan) — so each is settled independently
 * and its outcome carried back at the index it came from, the way `batchUploadDocumentsFromUrls`
 * already reports per-URL failures.
 */
export async function reprocessDocumentsOcr(
  injector: Injector,
  documentIds: readonly string[],
): Promise<ReprocessDocumentOcrGraphqlResult[]> {
  const results = new Array<ReprocessDocumentOcrGraphqlResult>(documentIds.length);
  const changedChargeIds = new Set<string>();

  let cursor = 0;
  const worker = async (): Promise<void> => {
    // Safe without a lock: the read and the increment are not separated by an await, so no other
    // worker can interleave between them.
    while (cursor < documentIds.length) {
      const index = cursor++;
      const documentId = documentIds[index]!;
      try {
        const outcome = await reprocessDocumentOcr(injector, documentId);
        results[index] = outcome;
        if (outcome.updatedFields.length && outcome.document.charge_id) {
          changedChargeIds.add(outcome.document.charge_id);
        }
      } catch (e) {
        const message =
          e instanceof ReprocessOcrError
            ? e.message
            : `Failed re-processing OCR for document ID="${documentId}": ${
                e instanceof Error ? e.message : String(e)
              }`;
        // Passed as a separate argument rather than interpolated, so the log keeps the stack and
        // any nested `cause` — the OCR failures this path exists to recover from are exactly the
        // ones that got swallowed silently elsewhere.
        console.error(`Failed re-processing OCR for document ID="${documentId}":`, e);
        results[index] = { __typename: 'CommonError', message };
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(REPROCESS_OCR_CONCURRENCY, documentIds.length) }, worker),
  );

  // Only the charges whose documents actually gained information are re-flagged; a pass that found
  // nothing new must not drag an approved charge back to PENDING.
  if (changedChargeIds.size) {
    await degradeChargesAccountantApproval(injector, [...changedChargeIds]);
  }

  return results;
}
