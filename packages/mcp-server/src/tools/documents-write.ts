import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type { McpBatchUploadDocumentsMutation } from '../gql/index.js';
import type { UploadFile } from '../upstream/graphql-client.js';
import { shapeWriteResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';

/**
 * Write tool: attach documents to an existing charge.
 *
 * Two upstream facts shape this tool:
 *
 * 1. `batchUploadDocuments` takes real binary files (`FileScalar` is a web
 *    `File`/`Blob` — the upstream helper calls `.arrayBuffer()` on it, so a
 *    string will not do). This server is a *remote* HTTP service with no access
 *    to the caller's filesystem, so documents arrive as inline base64 and are
 *    decoded here into the GraphQL multipart request upstream.
 *
 * 2. `batchUploadDocuments` **creates a new charge when `chargeId` is omitted**.
 *    That is a side effect the model should never trigger by leaving a field
 *    blank, so `chargeId` is required here: this tool attaches to an existing
 *    charge or it fails.
 *
 * `isSensitive` is pinned to `true` and deliberately absent from the input
 * schema — it is a property of this ingestion path, not a choice to delegate.
 */

export const UPLOAD_DOCUMENTS_TOOL_NAME = 'accounter_upload_documents';

/** Max documents per call. */
export const MAX_DOCUMENTS_PER_CALL = 10;
/** Max decoded size of one document. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
/** Max decoded size of all documents in one call. */
export const MAX_TOTAL_DOCUMENT_BYTES = 15 * 1024 * 1024;

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
        `Max ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB per file once decoded.`,
    ),
});

const uploadDocumentsInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  chargeId: z
    .string()
    .min(1)
    .describe(
      'The EXISTING charge to attach the documents to. Required — this tool never creates a charge. ' +
        'Use accounter_search_charges to find one.',
    ),
  documents: z
    .array(documentInput)
    .min(1)
    .max(MAX_DOCUMENTS_PER_CALL)
    .describe(`The documents to upload (1-${MAX_DOCUMENTS_PER_CALL} per call).`),
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
      `Document exceeds the ${MAX_DOCUMENT_BYTES / 1024 / 1024}MB per-file limit`,
      [{ path, message: `decoded size is ${content.byteLength} bytes` }],
    );
  }
  return content;
}

async function uploadDocumentsHandler(
  input: UploadDocumentsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const contents = input.documents.map((document, index) =>
    decodeDocument(document.contentBase64, index),
  );

  const totalBytes = contents.reduce((sum, content) => sum + content.byteLength, 0);
  if (totalBytes > MAX_TOTAL_DOCUMENT_BYTES) {
    throw new ToolInputError(
      `Documents total ${totalBytes} bytes, over the ${
        MAX_TOTAL_DOCUMENT_BYTES / 1024 / 1024
      }MB per-call limit. Split them across several calls.`,
    );
  }

  const files: UploadFile[] = input.documents.map((document, index) => ({
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
        documents: input.documents.map(() => null),
        chargeId: input.chargeId,
        // Pinned, not caller-supplied: every document ingested through this tool
        // is treated as sensitive.
        isSensitive: true,
      },
    },
    files,
    context.upstream,
  );

  // Upstream returns a list of a *union*, one entry per file, so a partial
  // failure is expressed per element. Report each outcome positionally rather
  // than collapsing the batch to one status — the model needs to know which
  // files it still has to deal with.
  const results = data.batchUploadDocuments.map((result, index) => {
    const filename = input.documents[index]?.filename;
    if (result.__typename === 'UploadDocumentSuccessfulResult') {
      return {
        filename,
        status: 'uploaded' as const,
        documentId: result.document?.id ?? null,
        documentType: result.document?.documentType ?? null,
      };
    }
    return {
      filename,
      status: 'failed' as const,
      message: result.__typename === 'CommonError' ? result.message : 'Unknown upload failure',
    };
  });

  const uploadedCount = results.filter(result => result.status === 'uploaded').length;
  const failedCount = results.length - uploadedCount;

  return shapeWriteResult({
    action: 'upload_documents',
    outcome: {
      chargeId: input.chargeId,
      uploadedCount,
      failedCount,
      isSensitive: true,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'results', values: results },
    summary:
      failedCount === 0
        ? `Uploaded ${uploadedCount} document(s) to charge ${input.chargeId}.`
        : `Uploaded ${uploadedCount} document(s) to charge ${input.chargeId}; ${failedCount} failed.`,
  });
}

export const uploadDocumentsTool: ToolDefinition<typeof uploadDocumentsInput> = {
  name: UPLOAD_DOCUMENTS_TOOL_NAME,
  description:
    'Attach one or more documents (invoices, receipts, contracts) to an EXISTING charge. Documents are ' +
    'passed as base64-encoded content and are always stored as sensitive. This tool never creates a ' +
    'charge: `chargeId` is required and must already exist. ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: uploadDocumentsInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'sensitive',
    mutating: true,
  },
  handler: uploadDocumentsHandler,
};
