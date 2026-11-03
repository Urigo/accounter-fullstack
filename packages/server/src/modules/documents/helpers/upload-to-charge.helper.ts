import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { degradeChargesAccountantApproval } from '../../accountant-approval/helpers/degrade-charges.helper.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { ChargesProvider } from '../../charges/providers/charges.provider.js';
import { ChargeTagsProvider } from '../../tags/providers/charge-tags.provider.js';
import { TagsProvider } from '../../tags/providers/tags.provider.js';
import { DocumentsProvider } from '../providers/documents.provider.js';
import type { IGetAllDocumentsResult, IInsertDocumentsParams } from '../types.js';
import { getDocumentFromFile, releaseDbConnectionForExternalWork } from './upload.helper.js';

/** Description given to a charge created by an upload that did not name one. */
export const DEFAULT_NEW_UPLOAD_CHARGE_DESCRIPTION = 'New uploaded documents';

/** Mirrors the `NewDocumentsChargeInput` GraphQL input. */
export type NewUploadChargeInput = {
  userDescription?: string | null;
  tagIds?: ReadonlyArray<string> | null;
};

/** One document to ingest: where its bytes come from, and how to name it in a failure. */
export type DocumentSource = {
  /** Prefixes this source's failure message, e.g. the URL or the file name. */
  label: string;
  load: () => Promise<File | Blob>;
};

export type UploadToChargeResult =
  { document: IGetAllDocumentsResult } | { __typename: 'CommonError'; message: string };

type DocumentRow = IInsertDocumentsParams['documents'][number];

/** An error's message, plus its direct cause's — the upload helpers wrap the useful part. */
export function describeUploadError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const cause = error.cause instanceof Error ? error.cause.message : undefined;
  return cause && cause !== error.message ? `${error.message}: ${cause}` : error.message;
}

/**
 * Check where an upload is going before any of its (slow, paid) external work starts: an existing
 * charge or a new one, never both, and a new charge's tags must exist. Returns the de-duplicated
 * tag ids to set on a new charge.
 */
export async function validateUploadTarget(
  injector: Injector,
  { chargeId, newCharge }: { chargeId?: string | null; newCharge?: NewUploadChargeInput | null },
): Promise<string[]> {
  if (chargeId && newCharge) {
    throw new GraphQLError(
      'Provide either chargeId (attach to an existing charge) or newCharge (create one), not both',
    );
  }

  const tagIds = [...new Set(newCharge?.tagIds ?? [])];
  if (tagIds.length === 0) {
    return [];
  }

  const tags = await injector.get(TagsProvider).getTagByIDLoader.loadMany(tagIds);
  const unknown = tagIds.filter((_id, index) => {
    const tag = tags[index];
    return !tag || tag instanceof Error;
  });
  if (unknown.length > 0) {
    throw new GraphQLError(`Unknown tag id(s): ${unknown.join(', ')}`);
  }
  return tagIds;
}

/**
 * Create one charge — with its description and tags — and insert the documents into it, as a
 * single transaction: a failure part way leaves neither an empty charge nor orphaned documents.
 */
async function createChargeWithDocuments(
  injector: Injector,
  {
    newCharge,
    tagIds,
    documents,
  }: { newCharge?: NewUploadChargeInput | null; tagIds: string[]; documents: DocumentRow[] },
) {
  const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
  const userDescription =
    newCharge?.userDescription?.trim() || DEFAULT_NEW_UPLOAD_CHARGE_DESCRIPTION;

  return injector.get(TenantAwareDBClient).transaction(async client => {
    const charge = await injector
      .get(ChargesProvider)
      .generateCharge({ ownerId, userDescription }, client);
    if (!charge?.id) {
      throw new Error('Failed to generate new charge for uploaded documents');
    }

    for (const tagId of tagIds) {
      await injector
        .get(ChargeTagsProvider)
        .insertChargeTag({ chargeId: charge.id, tagId }, client);
    }

    return injector
      .get(DocumentsProvider)
      .insertDocuments(
        { documents: documents.map(document => ({ ...document, chargeId: charge.id })) },
        client,
      );
  });
}

/**
 * Shared body of the batch upload mutations: load and process every source independently, then
 * store the ones that succeeded on the target charge.
 *
 * - Results are positional — one per source, in input order — and one source's failure never sinks
 *   the others; it becomes a `CommonError` naming that source.
 * - With `chargeId`, documents attach to that charge. Without it, ONE new charge is created for
 *   the whole batch, and only after processing, once at least one document made it: a batch that
 *   fails entirely creates nothing.
 */
export async function uploadDocumentsToCharge(
  injector: Injector,
  {
    sources,
    chargeId,
    newCharge,
    isSensitive,
    describeFailure = describeUploadError,
  }: {
    sources: DocumentSource[];
    chargeId?: string | null;
    newCharge?: NewUploadChargeInput | null;
    isSensitive?: boolean | null;
    describeFailure?: (error: unknown) => string;
  },
): Promise<UploadToChargeResult[]> {
  const tagIds = await validateUploadTarget(injector, { chargeId, newCharge });

  // Download, Cloudinary and OCR are minutes of external I/O; nothing needs the connection until
  // the closing INSERT.
  await releaseDbConnectionForExternalWork(injector);

  const settled = await Promise.all(
    sources.map(async ({ label, load }, index) => {
      try {
        const file = await load();
        const document = await getDocumentFromFile(injector, file, chargeId ?? null, isSensitive);
        return { index, document };
      } catch (error) {
        console.error(`Failed processing uploaded document "${label}":`, error);
        return { index, message: describeFailure(error) };
      }
    }),
  );

  const processed = settled.filter(
    (entry): entry is { index: number; document: DocumentRow } => 'document' in entry,
  );

  // The insert is the last step of a job that has already cost a download, an upload and an OCR
  // pass per document, so its failure is reported per position like every other one, rather than
  // as one opaque top-level error.
  let inserted: IGetAllDocumentsResult[] = [];
  let insertError: string | undefined;
  if (processed.length > 0) {
    const documents = processed.map(entry => entry.document);
    try {
      inserted = (
        chargeId
          ? await injector.get(DocumentsProvider).insertDocuments({ documents })
          : await createChargeWithDocuments(injector, { newCharge, tagIds, documents })
      ) as IGetAllDocumentsResult[];
    } catch (error) {
      insertError = `failed storing the processed document: ${describeUploadError(error)}`;
      console.error('Failed storing uploaded documents:', error);
    }
  }

  if (inserted.length > 0) {
    // A new charge cannot be approved yet, so this only ever degrades an existing one; it still
    // runs for both, per the charge-mutation rule.
    await degradeChargesAccountantApproval(injector, [chargeId ?? inserted[0].charge_id]);
  }

  // `insertDocuments` returns rows in the order it was given them, so the Nth inserted row belongs
  // to the Nth successfully processed source.
  const documentByIndex = new Map(
    processed.map((entry, position) => [entry.index, inserted[position]]),
  );

  return sources.map(({ label }, index): UploadToChargeResult => {
    const document = documentByIndex.get(index);
    if (document) {
      return { document };
    }
    const failure = settled[index];
    const reason =
      'message' in failure
        ? failure.message
        : (insertError ?? 'document was processed but could not be stored');
    return { __typename: 'CommonError', message: `${label}: ${reason}` };
  });
}
