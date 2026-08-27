import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type {
  McpBatchUploadDocumentsFromUrlsMutation,
  McpBatchUploadDocumentsMutation,
} from '../gql/index.js';
import type { UploadFile } from '../upstream/graphql-client.js';
import { shapeWriteResult } from './output.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';

/**
 * Write tool: attach documents to an existing charge.
 *
 * The tool has two branches, and which one a call takes decides who moves the
 * bytes:
 *
 * - **`documentUrls`** — the server fetches each URL itself. The model emits a
 *   link, not a payload, so nothing about the file passes through it and there
 *   is no size limit worth stating. This is the branch to prefer for anything
 *   that already lives somewhere fetchable.
 * - **`documents`** — inline base64. Here the *model* is the transport: it has
 *   to reproduce the whole encoded file as tool arguments, which both costs
 *   enormous output budget and risks corrupting the file, since base64 has no
 *   redundancy and a single mis-emitted character destroys it. Hence the small
 *   caps below.
 *
 * Exactly one branch per call; see {@link uploadDocumentsInput}.
 *
 * Two upstream facts shape the rest:
 *
 * 1. `batchUploadDocuments` takes real binary files (`FileScalar` is a web
 *    `File`/`Blob` — the upstream helper calls `.arrayBuffer()` on it, so a
 *    string will not do). This server is a *remote* HTTP service with no access
 *    to the caller's filesystem, so inline documents arrive as base64 and are
 *    decoded here into the GraphQL multipart request upstream. The URL branch
 *    sidesteps this entirely: `batchUploadDocumentsFromUrls` takes plain
 *    strings, so it is an ordinary JSON mutation.
 *
 * 2. `batchUploadDocuments` **creates a new charge when `chargeId` is omitted**.
 *    That is a side effect the model should never trigger by leaving a field
 *    blank, so `chargeId` is required here: this tool attaches to an existing
 *    charge or it fails.
 *
 * `isSensitive` is pinned and deliberately absent from the input schema — see
 * {@link PINNED_IS_SENSITIVE}.
 */

export const UPLOAD_DOCUMENTS_TOOL_NAME = 'accounter_upload_documents';

/**
 * Pinned, not caller-supplied.
 *
 * The upstream name is misleading: `getOcrData` returns early with
 * `documentType: UNPROCESSED` when this is set, so `true` does not so much mark
 * a document sensitive as skip OCR entirely — every document uploaded here would
 * land with no amount, date, counterparty, or serial. Documents ingested through
 * this tool are meant to be read, so both branches pass `false`.
 */
const PINNED_IS_SENSITIVE = false;

/** Max documents per call. */
export const MAX_DOCUMENTS_PER_CALL = 10;

/**
 * Size limits for inline base64.
 *
 * These are small on purpose, and the reason is worth stating plainly: inline
 * base64 makes the *model* the transport. It has to emit the whole encoded file
 * as tool arguments, and base64 tokenizes at roughly 3 characters per token, so
 * a 277 KB PDF costs on the order of 100k output tokens — past a single
 * message's budget before any server-side limit is consulted.
 *
 * Three ceilings therefore apply, and the model's is by far the tightest:
 *
 *  1. the model's per-message output budget — practically a few tens of KB;
 *  2. `MAX_MCP_BODY_BYTES`, the 1 MB cap on the whole JSON-RPC body, which after
 *     base64's 4/3 expansion leaves roughly 700 KB of file;
 *  3. these constants.
 *
 * An earlier revision advertised 5 MB per file, which ceiling (2) made
 * unreachable — the request died as a 413 long before this check ran. The values
 * below sit under (2) with room for the JSON envelope, and
 * `upload-limits.test.ts` asserts that relationship so the two cannot drift
 * apart again. Anything larger belongs on a transport that does not route bytes
 * through the model; {@link OVERSIZE_GUIDANCE} tells the caller which.
 */
export const MAX_DOCUMENT_BYTES = 256 * 1024;
/** Max decoded size of all documents in one call. */
export const MAX_TOTAL_DOCUMENT_BYTES = 512 * 1024;

/**
 * Appended to every over-size error. A tool that merely says "too large" invites
 * the model to shrink the file until it fits — which, for a scanned receipt,
 * means re-rendering a legal document at degraded quality and archiving that
 * instead. Naming the real alternatives is what stops the retry loop.
 */
export const OVERSIZE_GUIDANCE =
  'Do NOT downscale, re-encode, or reduce the quality of the document to fit — the stored file is a ' +
  'financial record and must keep its original fidelity. Use `documentUrls` instead: put the file ' +
  'somewhere fetchable (Google Drive, or any direct download link) and pass the link, so the server ' +
  'fetches the bytes rather than routing them through this conversation. There is no size limit on ' +
  'that path. Failing that, forward the file to the document-ingestion email address.';

/** Render a byte count for humans; every limit here is KB-scale. */
const asKb = (bytes: number) => `${Math.round(bytes / 1024)}KB`;

/**
 * Accepted document MIME types. An allowlist rather than a blocklist: everything
 * here ends up in Cloudinary and an OCR pipeline, so an unexpected type is a
 * failure deep in someone else's system rather than a clear error here.
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
] as const;

const documentInput = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .describe('File name including extension, e.g. `invoice-2026-01.pdf`.'),
  mimeType: z
    .enum(ALLOWED_DOCUMENT_MIME_TYPES)
    .describe('MIME type of the file. Must match the actual content.'),
  contentBase64: z
    .string()
    .min(1)
    .describe(
      'The file content, base64-encoded. A `data:<type>;base64,` prefix is accepted and stripped. ' +
        `Max ${asKb(MAX_DOCUMENT_BYTES)} per file once decoded — this content travels as tool ` +
        'arguments, so a larger file will not fit in a single message however it is encoded.',
    ),
});

const uploadDocumentsInput = z
  .object({
    memberBusinessId: writeTargetBusinessIdInput,
    chargeId: z
      .string()
      .min(1)
      .describe(
        'The EXISTING charge to attach the documents to. Required — this tool never creates a charge. ' +
          'Use accounter_search_charges to find one.',
      ),
    documentUrls: z
      .array(z.url().max(2048))
      .min(1)
      .max(MAX_DOCUMENTS_PER_CALL)
      .optional()
      .describe(
        'PREFERRED. http(s) URLs the SERVER fetches the documents from — the bytes never travel ' +
          'through this conversation, so there is no size limit. Google Drive share links are ' +
          'resolved through the Drive API; any other URL must answer with a PDF or an image ' +
          '(a link that renders a web page is rejected). ' +
          `1-${MAX_DOCUMENTS_PER_CALL} per call. Mutually exclusive with \`documents\`.`,
      ),
    documents: z
      .array(documentInput)
      .min(1)
      .max(MAX_DOCUMENTS_PER_CALL)
      .optional()
      .describe(
        `Inline base64 documents (1-${MAX_DOCUMENTS_PER_CALL} per call). Use ONLY for small content ` +
          'you generated yourself; for an existing file prefer `documentUrls`. Mutually exclusive ' +
          'with `documentUrls`.',
      ),
  })
  // Enforced here rather than as a union so the model gets one clear message
  // instead of a pair of "no variant matched" branches, and so omitting both is
  // named as its own mistake.
  .refine(input => !!input.documentUrls !== !!input.documents, {
    message: 'Provide exactly one of `documentUrls` or `documents` — not both, and not neither.',
    path: ['documentUrls'],
  });
type UploadDocumentsInput = z.infer<typeof uploadDocumentsInput>;

const BATCH_UPLOAD_DOCUMENTS_MUTATION = /* GraphQL */ `
  mutation McpBatchUploadDocuments(
    $documents: [FileScalar!]!
    $chargeId: UUID
    $isSensitive: Boolean
  ) {
    batchUploadDocuments(documents: $documents, chargeId: $chargeId, isSensitive: $isSensitive) {
      __typename
      ... on UploadDocumentSuccessfulResult {
        document {
          id
          documentType
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

/** `data:<mime>;base64,` prefix some clients prepend to encoded content. */
const BATCH_UPLOAD_DOCUMENTS_FROM_URLS_MUTATION = /* GraphQL */ `
  mutation McpBatchUploadDocumentsFromUrls(
    $urls: [String!]!
    $chargeId: UUID
    $isSensitive: Boolean
  ) {
    batchUploadDocumentsFromUrls(urls: $urls, chargeId: $chargeId, isSensitive: $isSensitive) {
      __typename
      ... on UploadDocumentSuccessfulResult {
        document {
          id
          documentType
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

const DATA_URI_PREFIX_RE = /^data:[^;,]*;base64,/i;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Decode one document's base64 payload, or throw a pointed
 * {@link ToolInputError}.
 *
 * `Buffer.from(x, 'base64')` is lenient — it silently skips characters it does
 * not recognize, so a truncated or corrupted payload decodes to a shorter,
 * plausible-looking buffer instead of failing. That would surface as a corrupt
 * file in Cloudinary long after the call reported success, so the encoding is
 * validated strictly first and the size is checked on the decoded bytes.
 */
function decodeDocument(contentBase64: string, index: number): Uint8Array {
  const path = `documents.${index}.contentBase64`;
  // Whitespace (including the newlines in MIME-wrapped base64) is not
  // significant; strip it before validating rather than rejecting on it.
  const stripped = contentBase64.replace(DATA_URI_PREFIX_RE, '').replace(/\s/g, '');
  if (stripped.length === 0) {
    throw new ToolInputError('Document content is empty', [
      { path, message: 'contentBase64 decodes to no content' },
    ]);
  }
  if (stripped.length % 4 !== 0 || !BASE64_RE.test(stripped)) {
    throw new ToolInputError('Document content is not valid base64', [
      { path, message: 'contentBase64 must be a valid base64 string' },
    ]);
  }
  const content = new Uint8Array(Buffer.from(stripped, 'base64'));
  if (content.byteLength === 0) {
    throw new ToolInputError('Document content is empty', [
      { path, message: 'contentBase64 decodes to no content' },
    ]);
  }
  if (content.byteLength > MAX_DOCUMENT_BYTES) {
    throw new ToolInputError(
      `Document is ${asKb(content.byteLength)}, over the ${asKb(MAX_DOCUMENT_BYTES)} per-file limit ` +
        `for inline upload. ${OVERSIZE_GUIDANCE}`,
      [{ path, message: `decoded size is ${content.byteLength} bytes` }],
    );
  }
  return content;
}

/** One entry per input document/URL, in the order it was given. */
type UploadOutcome =
  | {
      label: string | undefined;
      status: 'uploaded';
      documentId: string | null;
      documentType: string | null;
    }
  | { label: string | undefined; status: 'failed'; message: string };

/**
 * Upstream returns a list of a *union*, one entry per input, so a partial
 * failure is expressed per element. Map it positionally rather than collapsing
 * the batch to one status — the model needs to know which files it still has to
 * deal with.
 */
function toOutcomes(
  results: McpBatchUploadDocumentsMutation['batchUploadDocuments'],
  labels: Array<string | undefined>,
): UploadOutcome[] {
  return results.map((result, index) => {
    const label = labels[index];
    if (result.__typename === 'UploadDocumentSuccessfulResult') {
      return {
        label,
        status: 'uploaded' as const,
        documentId: result.document?.id ?? null,
        documentType: result.document?.documentType ?? null,
      };
    }
    return {
      label,
      status: 'failed' as const,
      message: result.__typename === 'CommonError' ? result.message : 'Unknown upload failure',
    };
  });
}

/** The URL branch: the server fetches, so nothing here touches bytes. */
async function uploadFromUrls(
  urls: string[],
  input: UploadDocumentsInput,
  context: ToolExecutionContext,
): Promise<UploadOutcome[]> {
  const data = await context.client.mutate<McpBatchUploadDocumentsFromUrlsMutation>(
    {
      query: BATCH_UPLOAD_DOCUMENTS_FROM_URLS_MUTATION,
      variables: { urls, chargeId: input.chargeId, isSensitive: PINNED_IS_SENSITIVE },
    },
    context.upstream,
    // Upstream fetches each URL, uploads it to Cloudinary and OCRs it before it
    // writes anything — minutes, not the seconds an ordinary call is budgeted.
    { longRunning: true },
  );
  return toOutcomes(data.batchUploadDocumentsFromUrls, urls);
}

/** The inline branch: base64 in, multipart out. */
async function uploadInline(
  documents: NonNullable<UploadDocumentsInput['documents']>,
  input: UploadDocumentsInput,
  context: ToolExecutionContext,
): Promise<UploadOutcome[]> {
  const contents = documents.map((document, index) =>
    decodeDocument(document.contentBase64, index),
  );

  const totalBytes = contents.reduce((sum, content) => sum + content.byteLength, 0);
  if (totalBytes > MAX_TOTAL_DOCUMENT_BYTES) {
    throw new ToolInputError(
      `Documents total ${asKb(totalBytes)}, over the ${asKb(MAX_TOTAL_DOCUMENT_BYTES)} per-call ` +
        `limit for inline upload. Sending fewer documents per call may resolve this; if a single ` +
        `document is itself near the limit, it will not. ${OVERSIZE_GUIDANCE}`,
    );
  }

  const files: UploadFile[] = documents.map((document, index) => ({
    // Matches the `documents` argument name in the mutation above; the
    // placeholder nulls below occupy these positions.
    variablePath: `variables.documents.${index}`,
    filename: document.filename,
    contentType: document.mimeType,
    content: contents[index],
  }));

  const data = await context.client.mutateMultipart<McpBatchUploadDocumentsMutation>(
    {
      query: BATCH_UPLOAD_DOCUMENTS_MUTATION,
      variables: {
        // Per the GraphQL multipart request spec the file variables are null
        // placeholders; `map` (built by the client from `files`) points each
        // form part at its position here.
        documents: documents.map(() => null),
        chargeId: input.chargeId,
        isSensitive: PINNED_IS_SENSITIVE,
      },
    },
    files,
    context.upstream,
    // Same shape of work as the URL branch: Cloudinary + OCR before the insert.
    { longRunning: true },
  );

  return toOutcomes(
    data.batchUploadDocuments,
    documents.map(document => document.filename),
  );
}

async function uploadDocumentsHandler(
  input: UploadDocumentsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  // Exactly one of the two is set — the schema's refinement guarantees it.
  const source = input.documentUrls ? 'urls' : 'inline';
  const outcomes = input.documentUrls
    ? await uploadFromUrls(input.documentUrls, input, context)
    : await uploadInline(input.documents!, input, context);

  // The label means different things per branch, so it is named for what it is
  // rather than reported under a `filename` key holding a URL.
  const results = outcomes.map(({ label, ...rest }) =>
    source === 'urls' ? { url: label, ...rest } : { filename: label, ...rest },
  );

  const uploadedCount = results.filter(result => result.status === 'uploaded').length;
  const failedCount = results.length - uploadedCount;

  return shapeWriteResult({
    action: 'upload_documents',
    outcome: {
      chargeId: input.chargeId,
      source,
      uploadedCount,
      failedCount,
      isSensitive: PINNED_IS_SENSITIVE,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'results', values: results },
    summary:
      failedCount === 0
        ? `Uploaded ${uploadedCount} document(s) to charge ${input.chargeId}.`
        : `Uploaded ${uploadedCount} document(s) to charge ${input.chargeId}; ${failedCount} failed.`,
  });
}

/**
 * Which branch a call took: `urls` (server fetches) or `inline` (base64 through
 * the model). This is the counter the URL branch exists to move — it answers
 * whether the model actually reaches for links, or still falls back to base64
 * and its size ceiling.
 */
export const DOCUMENT_SOURCE_COUNTER = 'document_upload_source';

/**
 * Usage telemetry for one upload.
 *
 * A write result carries no `returnedCount`/`totalCount`/`truncated`, so
 * `listShapeFields` contributes nothing to its usage line — without this hook a
 * completed upload would log *that* it happened and nothing about *what* it
 * did. The counts come from the shaped result rather than the input, because
 * upstream reports success per file and a partially failed batch is the case
 * worth seeing.
 *
 * The same rule as the audit line applies, for the same reason: counts and
 * shape only. Filenames describe the caller's documents and URLs can carry
 * access tokens, so neither reaches the log.
 */
function observe(input: UploadDocumentsInput, result: ToolResult): ToolObservation {
  const source = input.documentUrls ? 'urls' : 'inline';
  const structured = result.structuredContent as
    { uploadedCount?: number; failedCount?: number } | undefined;
  return {
    fields: {
      documentSource: source,
      requestedDocumentCount: (input.documentUrls ?? input.documents ?? []).length,
      uploadedCount: structured?.uploadedCount,
      failedCount: structured?.failedCount,
    },
    counters: [[DOCUMENT_SOURCE_COUNTER, source]],
  };
}

export const uploadDocumentsTool: ToolDefinition<typeof uploadDocumentsInput> = {
  name: UPLOAD_DOCUMENTS_TOOL_NAME,
  description:
    'Attach one or more documents (invoices, receipts, contracts) to an EXISTING charge. This tool ' +
    'never creates a charge: `chargeId` is required and must already exist. ' +
    'Provide EXACTLY ONE of two inputs. ' +
    '(1) `documentUrls` — PREFERRED: http(s) links the server fetches itself, with no size limit, ' +
    'since the bytes never pass through the conversation. Google Drive share links work. If the file ' +
    'is on disk and you have a shell, put it somewhere fetchable first and pass the resulting link. ' +
    '(2) `documents` — inline base64, for small content only ' +
    `(max ${asKb(MAX_DOCUMENT_BYTES)} per file, ${asKb(MAX_TOTAL_DOCUMENT_BYTES)} per call, decoded), ` +
    'because that content travels as tool arguments and both costs enormous output and risks ' +
    'corrupting the file. Never re-encode or downscale a financial document to make it fit — use ' +
    '`documentUrls` instead. ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: uploadDocumentsInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'sensitive',
    mutating: true,
  },
  handler: uploadDocumentsHandler,
  observe,
};
