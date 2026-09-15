import type { Injector } from 'graphql-modules';
import { DocumentType } from '../../../shared/enums.js';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { isSupportedFileType } from '../../app-providers/anthropic.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import type {
  IFillDocumentFromOcrParams,
  IGetAllDocumentsResult,
  IInsertDocumentsParams,
} from '../types.js';
import { fetchRemoteDocument, RemoteDocumentError } from './fetch-remote-document.helper.js';
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
 * The columns re-OCR may fill, as [query param, OCR param, column name] — the three vocabularies
 * disagree (the OCR side calls them `amount` and `vat`, the query `totalAmount` and `vatAmount`,
 * the table `total_amount` and `vat_amount`), so the mapping is written out once here rather than
 * guessed at each use.
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
  readonly [keyof IFillDocumentFromOcrParams, keyof OcrDocumentParams, keyof IGetAllDocumentsResult]
>;

/**
 * Re-fetch a document's stored file and OCR it again.
 *
 * The bytes are not kept anywhere after ingestion — Anthropic is sent them inline and hands back no
 * handle — so the only route to them is the Cloudinary URL on the row. That makes this a download
 * plus a fresh extraction, not a replay of anything.
 *
 * The write is deliberately additive: a column is filled only where the row is empty, so a value an
 * accountant corrected by hand can never be overwritten by a later model run. The one exception is
 * `type`, replaced only while the document is still UNPROCESSED — the state this whole path exists
 * to get a document out of.
 *
 * That rule is enforced by the UPDATE statement itself rather than by filtering here, because minutes
 * pass between reading the row and writing it back. Deciding from the pre-OCR read would mean a field
 * an accountant filled during the extraction got overwritten by a decision made before they touched
 * it — see `DocumentsProvider.fillDocumentFromOcr`.
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

  // Checked here, before anything expensive, because reads and writes are not scoped alike: the
  // session pins writes to `app.current_business_id` while reads span the whole
  // `app.current_business_scope`, so the all-documents screen can perfectly well list a row this
  // request may not write to. Without this the mismatch would only surface at the closing UPDATE —
  // after a download and a paid OCR call had already been spent on it.
  const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  if (document.owner_id !== ownerId) {
    throw new ReprocessOcrError(
      `Document ID="${documentId}" belongs to another business and cannot be modified by this request`,
    );
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

  const params = buildOcrFillParams(documentId, ocrParams);

  // The model returned nothing usable at all, so there is no point issuing a statement. This is an
  // optimization only — which of these values may actually land is decided in SQL, not here.
  if (!offersAnything(params)) {
    return { document, updatedFields: [] };
  }

  const [updated] = await documentsProvider.fillDocumentFromOcr(params);

  // No row came back: every column the pass could have filled was already filled. The query's WHERE
  // clause exists precisely so this is a no-op rather than an `updated_at` bump and an
  // accountant-approval degrade.
  if (!updated) {
    return { document, updatedFields: [] };
  }

  return { document: updated, updatedFields: changedFields(document, updated) };
}

/**
 * Fetch the document's bytes in a form the OCR model accepts.
 *
 * The two allowlists in play disagree in both directions: `fetchRemoteDocument` passes heic, heif
 * and tiff, which the model rejects, and refuses gif, which the model accepts. So the original can
 * fail either by being fetched and turning out unusable, *or* by never being fetched at all — and
 * both have the same remedy, since Cloudinary derives a `.jpg` alongside every upload and
 * `image_url` points at it. Widening the fetch allowlist would be the wrong fix: it guards every
 * remote-URL ingestion path in the app, not just this caller.
 */
async function fetchOcrableFile(source: string, document: IGetAllDocumentsResult): Promise<File> {
  const derivative = document.image_url;
  let originalProblem: string;

  try {
    const file = await fetchRemoteDocument(source);
    if (isSupportedFileType(file.type.toLowerCase())) {
      return file;
    }
    originalProblem = `is stored as "${file.type}", which cannot be sent to OCR`;
  } catch (e) {
    // Only the fetch layer's own refusals are recoverable by trying another representation; a
    // programming error or an aborted request is not, and must not be reported as an unreadable
    // document.
    if (!(e instanceof RemoteDocumentError)) {
      throw e;
    }
    if (!derivative || derivative === source) {
      throw new ReprocessOcrError(
        `Document ID="${document.id}" could not be read back for OCR: ${e.message}`,
      );
    }
    originalProblem = `could not be read back ("${e.message}")`;
  }

  if (!derivative || derivative === source) {
    throw new ReprocessOcrError(
      `Document ID="${document.id}" ${originalProblem}, and has no image derivative to fall back on`,
    );
  }

  const fallback = await fetchRemoteDocument(derivative).catch((e: unknown) => {
    throw new ReprocessOcrError(
      `Document ID="${document.id}" ${originalProblem}, and its image derivative could not be read either: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  });
  if (!isSupportedFileType(fallback.type.toLowerCase())) {
    throw new ReprocessOcrError(
      `Document ID="${document.id}" has no OCR-compatible representation (original ${originalProblem}, derivative is "${fallback.type}")`,
    );
  }
  return fallback;
}

/**
 * Map the OCR result onto the fill query's parameters.
 *
 * Every value the model produced is passed through as-is. This deliberately does *no*
 * blank-detection: which of them may actually land is decided by the query, against the row as it
 * is at write time rather than as it was minutes earlier when OCR started.
 */
function buildOcrFillParams(
  documentId: string,
  ocrParams: OcrDocumentParams,
): IFillDocumentFromOcrParams {
  const params: IFillDocumentFromOcrParams = {
    documentId,
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
    // UNPROCESSED is the absence of a type, so offering it back would be a no-op the query's WHERE
    // clause would then have to filter out anyway.
    type:
      ocrParams.documentType && ocrParams.documentType !== DocumentType.Unprocessed
        ? ocrParams.documentType
        : null,
  };

  for (const [paramKey, ocrKey] of FILLABLE_FIELDS) {
    const next = ocrParams[ocrKey];
    if (next != null) {
      // Key and value are read off the same tuple, so the assignment is sound even though the loop
      // erases the per-field type relationship.
      (params as Record<string, unknown>)[paramKey] = next;
    }
  }

  return params;
}

/** Whether the pass produced anything at all worth sending to the database. */
function offersAnything(params: IFillDocumentFromOcrParams): boolean {
  return params.type != null || FILLABLE_FIELDS.some(([paramKey]) => params[paramKey] != null);
}

/**
 * Which columns this pass filled, by comparing the row before and after.
 *
 * Read off the returned row rather than from what was offered, because the query is the one that
 * decided: a value can be sent and still not land, if the column was filled in the meantime.
 */
function changedFields(before: IGetAllDocumentsResult, after: IGetAllDocumentsResult): string[] {
  const changed = FILLABLE_FIELDS.filter(
    ([, , column]) => before[column] == null && after[column] != null,
  ).map(([, , column]) => column as string);

  if (before.type !== after.type) {
    changed.push('type');
  }

  return changed;
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
