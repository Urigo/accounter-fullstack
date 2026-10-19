import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type {
  McpDeleteDocumentMutation,
  McpDocumentChargeQuery,
  McpUpdateDocumentMutation,
} from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import { deleteEmptiedCharges, describeCleanup, type CleanupResult } from './charge-cleanup.js';
import { parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { DOCUMENT_TYPES } from './document-details.js';
import { shapeWriteResult, writeResultDescription } from './output.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';
import { EMPTY_UUID } from './transactions-write.js';

/**
 * Write tools on an existing document: edit its extracted fields or move it to
 * another charge (`accounter_update_document`), or remove it
 * (`accounter_delete_document`).
 *
 * `accounter_upload_documents` (documents-write.ts) is the *create* side; this
 * module is what a review needs after OCR has already landed a document
 * somewhere: fix a creditor the extractor got wrong, move a receipt onto the
 * charge with the card row, or delete a stray attachment that was never a
 * document at all.
 *
 * Upstream `updateDocument` deletes an emptied former charge only on the
 * EMPTY_UUID unlink path (reported as `deletedChargeId`). Moving a document
 * onto a REAL charge leaves its former charge behind, so after such a move the
 * tool deletes that charge if it is now empty (see charge-cleanup.ts) and
 * reports it under `cleanup`.
 */

export const UPDATE_DOCUMENT_TOOL_NAME = 'accounter_update_document';
export const DELETE_DOCUMENT_TOOL_NAME = 'accounter_delete_document';

/** Mirrors the upstream `Currency` enum. */
export const CURRENCIES = [
  'ILS',
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'SEK',
  'CAD',
  'AUD',
  'ETH',
  'GRT',
  'USDC',
] as const;

const calendarDate = TIMELESS_DATE.refine(value => parseCalendarDate(value) !== null, {
  message: 'must be a real calendar date',
});

const updateDocumentInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  documentId: z
    .string()
    .min(1)
    .describe(
      'The document to edit. Use accounter_get_charges (includeDocuments) or accounter_get_documents to find it.',
    ),
  chargeId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Move the document onto this charge — typically the one holding the bank or card ' +
        'transaction it documents. If the former charge is left empty it is deleted afterwards ' +
        'and listed under `cleanup.deletedChargeIds` (turn that off with ' +
        `\`deleteEmptiedCharges: false\`). Pass the all-zero UUID (${EMPTY_UUID}) to unlink the ` +
        'document into a new charge of its own; upstream then deletes the former charge itself ' +
        'when the document was all it held, reported as `deletedChargeId`.',
    ),
  creditorId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Business that issued the document (the vendor on an expense invoice, your own business on ' +
        'an invoice you issued). Resolve with accounter_list_businesses or create with ' +
        'accounter_create_business.',
    ),
  debtorId: z
    .string()
    .min(1)
    .optional()
    .describe('Business the document is addressed to (your own business on an expense invoice).'),
  // The vocabulary is the one `accounter_get_documents` filters by, so a type
  // upstream adds reaches both tools at once.
  documentType: z
    .enum(DOCUMENT_TYPES)
    .optional()
    .describe(
      'Reclassify the document, e.g. an OTHER the extractor missed that is really a RECEIPT.',
    ),
  serialNumber: z.string().max(100).optional().describe('The document’s own number.'),
  date: calendarDate.optional().describe('The document date, YYYY-MM-DD.'),
  amount: z
    .object({
      value: z.number().describe('The amount; positive for the document’s face value.'),
      currency: z.enum(CURRENCIES),
    })
    .optional()
    .describe('Replace the document total. Its currency is the document’s currency.'),
  // Upstream stores one currency per document and takes it from `amount` only;
  // a currency on `vat` would be silently ignored, so the tool does not take one.
  vat: z
    .number()
    .optional()
    .describe(
      'Replace the VAT amount on the document, in the document’s own currency (set or change ' +
        'that currency through `amount`).',
    ),
  description: z.string().max(1000).optional().describe('Replace the document description.'),
  deleteEmptiedCharges: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'When moving onto a real charge, delete the former charge if it ends up with no ' +
        'transactions, documents or misc expenses (default true).',
    ),
});
type UpdateDocumentInput = z.infer<typeof updateDocumentInput>;

const deleteDocumentInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  documentId: z.string().min(1).describe('The document to delete.'),
});
type DeleteDocumentInput = z.infer<typeof deleteDocumentInput>;

const DOCUMENT_CHARGE_QUERY = /* GraphQL */ `
  query McpDocumentCharge($documentIds: [UUID!]!) {
    documentsByIds(documentIds: $documentIds) {
      id
      charge {
        id
      }
    }
  }
`;

const UPDATE_DOCUMENT_MUTATION = /* GraphQL */ `
  mutation McpUpdateDocument($documentId: UUID!, $fields: UpdateDocumentFieldsInput!) {
    updateDocument(documentId: $documentId, fields: $fields) {
      __typename
      ... on UpdateDocumentSuccessfulResult {
        deletedChargeId
        document {
          id
          documentType
          charge {
            id
          }
          ... on FinancialDocument {
            serialNumber
            date
            amount {
              raw
              currency
            }
            vat {
              raw
              currency
            }
            creditor {
              id
              name
            }
            debtor {
              id
              name
            }
          }
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

const DELETE_DOCUMENT_MUTATION = /* GraphQL */ `
  mutation McpDeleteDocument($documentId: UUID!) {
    deleteDocument(documentId: $documentId) {
      success
      chargeId
      deletedChargeId
    }
  }
`;

function documentFieldsOf(input: UpdateDocumentInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (input.chargeId !== undefined) fields.chargeId = input.chargeId;
  if (input.creditorId !== undefined) fields.creditorId = input.creditorId;
  if (input.debtorId !== undefined) fields.debtorId = input.debtorId;
  if (input.documentType !== undefined) fields.documentType = input.documentType;
  if (input.serialNumber !== undefined) fields.serialNumber = input.serialNumber;
  if (input.date !== undefined) fields.date = input.date;
  if (input.description !== undefined) fields.description = input.description;
  if (input.amount !== undefined) {
    fields.amount = { raw: input.amount.value, currency: input.amount.currency };
  }
  if (input.vat !== undefined) {
    // `UpdateDocumentFieldsInput.vat` is a FinancialAmountInput, so a currency
    // has to travel; upstream ignores it (the document's currency comes from
    // `amount`), so it is the amount's currency when given, else a placeholder.
    fields.vat = { raw: input.vat, currency: input.amount?.currency ?? 'ILS' };
  }
  return fields;
}

const SETTABLE_FIELDS =
  'chargeId, creditorId, debtorId, documentType, serialNumber, date, amount, vat or description';

async function updateDocumentHandler(
  input: UpdateDocumentInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const fields = documentFieldsOf(input);
  if (Object.keys(fields).length === 0) {
    throw new ToolInputError('No document changes requested', [
      { path: 'documentId', message: `provide at least one of ${SETTABLE_FIELDS}` },
    ]);
  }

  const movingToRealCharge =
    input.chargeId !== undefined && input.chargeId !== EMPTY_UUID && input.deleteEmptiedCharges;
  let formerChargeId: string | null = null;
  if (movingToRealCharge) {
    const before = await context.client.query<McpDocumentChargeQuery>(
      { query: DOCUMENT_CHARGE_QUERY, variables: { documentIds: [input.documentId] } },
      context.upstream,
    );
    formerChargeId = before.documentsByIds[0]?.charge?.id ?? null;
  }

  const data = await context.client.mutate<McpUpdateDocumentMutation>(
    { query: UPDATE_DOCUMENT_MUTATION, variables: { documentId: input.documentId, fields } },
    context.upstream,
  );

  const result = data.updateDocument;
  if (result.__typename !== 'UpdateDocumentSuccessfulResult') {
    throw new UpstreamError(
      'UPSTREAM_ERROR',
      result.__typename === 'CommonError' ? result.message : 'Document update failed',
      false,
    );
  }

  const document = result.document;
  const echo = document
    ? {
        id: document.id,
        documentType: document.documentType ?? null,
        chargeId: document.charge?.id ?? null,
        serialNumber: 'serialNumber' in document ? (document.serialNumber ?? null) : null,
        date: 'date' in document ? (document.date ?? null) : null,
        amount:
          'amount' in document && document.amount
            ? { value: document.amount.raw, currency: document.amount.currency }
            : null,
        vat: 'vat' in document && document.vat ? document.vat.raw : null,
        creditor:
          'creditor' in document && document.creditor
            ? { id: document.creditor.id, name: document.creditor.name }
            : null,
        debtor:
          'debtor' in document && document.debtor
            ? { id: document.debtor.id, name: document.debtor.name }
            : null,
      }
    : null;

  const cleanup: CleanupResult =
    movingToRealCharge && formerChargeId
      ? await deleteEmptiedCharges([formerChargeId], input.chargeId ?? null, context)
      : { deletedChargeIds: [], keptChargeIds: [], failures: [] };

  return shapeWriteResult({
    action: 'update_document',
    outcome: {
      documentId: input.documentId,
      updatedFields: Object.keys(fields),
      deletedChargeId: result.deletedChargeId ?? null,
      cleanup,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'documents', values: echo ? [echo] : [] },
    summary:
      `Updated ${Object.keys(fields).join(', ')} on document ${input.documentId}.` +
      (result.deletedChargeId
        ? ` Its former charge ${result.deletedChargeId} was left empty and deleted.`
        : '') +
      describeCleanup(cleanup),
  });
}

async function deleteDocumentHandler(
  input: DeleteDocumentInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const data = await context.client.mutate<McpDeleteDocumentMutation>(
    { query: DELETE_DOCUMENT_MUTATION, variables: { documentId: input.documentId } },
    context.upstream,
  );

  const result = data.deleteDocument;
  if (!result.success) {
    throw new UpstreamError('UPSTREAM_ERROR', 'Document deletion failed', false);
  }

  return shapeWriteResult({
    action: 'delete_document',
    outcome: {
      documentId: input.documentId,
      chargeId: result.chargeId ?? null,
      deletedChargeId: result.deletedChargeId ?? null,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: {
      key: 'documents',
      values: [{ id: input.documentId, deleted: true, chargeId: result.chargeId ?? null }],
    },
    summary:
      `Deleted document ${input.documentId}.` +
      (result.deletedChargeId
        ? ` Its charge ${result.deletedChargeId} was left empty and deleted too.`
        : ''),
  });
}

function observeUpdate(input: UpdateDocumentInput, result: ToolResult): ToolObservation {
  const structured = result.structuredContent as
    { deletedChargeId?: string | null; cleanup?: CleanupResult } | undefined;
  return {
    fields: {
      updatedFieldCount: Object.keys(documentFieldsOf(input)).length,
      movesCharge: input.chargeId !== undefined,
      deletedFormerCharge:
        !!structured?.deletedChargeId || (structured?.cleanup?.deletedChargeIds.length ?? 0) > 0,
    },
  };
}

function observeDelete(_input: DeleteDocumentInput, result: ToolResult): ToolObservation {
  const structured = result.structuredContent as { deletedChargeId?: string | null } | undefined;
  return { fields: { deletedFormerCharge: !!structured?.deletedChargeId } };
}

export const updateDocumentTool: ToolDefinition<typeof updateDocumentInput> = {
  name: UPDATE_DOCUMENT_TOOL_NAME,
  description:
    'Edit an existing document or move it to another charge: set `chargeId` to attach a receipt ' +
    'to the charge holding the card or bank row it documents — the former charge is then ' +
    'deleted if the move left it empty (under `cleanup.deletedChargeIds`; kept and listed under ' +
    '`cleanup.keptChargeIds` otherwise). `creditorId` / `debtorId` correct the businesses the ' +
    'extractor read off it, which is also what sets the charge’s counterparty on the document ' +
    'side. `documentType`, `serialNumber`, `date`, `amount`, `vat` (a number in the document’s ' +
    'currency) and `description` fix extracted values. Only the fields you pass change. The echo ' +
    'under `documents` is the document as it now stands, alongside `documentId`, `updatedFields`, ' +
    '`deletedChargeId` (set only on an all-zero-UUID unlink) and `cleanup`. ' +
    writeResultDescription('documents') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: updateDocumentInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: updateDocumentHandler,
  observe: observeUpdate,
};

export const deleteDocumentTool: ToolDefinition<typeof deleteDocumentInput> = {
  name: DELETE_DOCUMENT_TOOL_NAME,
  description:
    'Delete one document for good — an attachment that is not a financial document, a ' +
    'duplicate, or something the email ingestion mis-filed. Its charge stays unless the document ' +
    'was the only thing in it, in which case the charge is deleted too and reported as ' +
    '`deletedChargeId`. Not reversible: confirm the document with `accounter_get_documents` ' +
    'first, and prefer `accounter_update_document` when the document is real but in the wrong ' +
    'place. The echo under `documents` names the deleted id, alongside `documentId`, `chargeId` ' +
    'and `deletedChargeId`. ' +
    writeResultDescription('documents') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: deleteDocumentInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: deleteDocumentHandler,
  observe: observeDelete,
};
