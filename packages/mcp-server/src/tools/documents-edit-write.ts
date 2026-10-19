import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type { McpDeleteDocumentMutation, McpUpdateDocumentMutation } from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import { shapeWriteResult, writeResultDescription } from './output.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';

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
 */

export const UPDATE_DOCUMENT_TOOL_NAME = 'accounter_update_document';
export const DELETE_DOCUMENT_TOOL_NAME = 'accounter_delete_document';

/** Mirrors the upstream `DocumentType` enum. */
export const DOCUMENT_TYPES = [
  'INVOICE',
  'RECEIPT',
  'INVOICE_RECEIPT',
  'CREDIT_INVOICE',
  'PROFORMA',
  'OTHER',
  'UNPROCESSED',
] as const;

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const amountInput = z
  .object({
    value: z.number().describe('The amount; positive for the document’s face value.'),
    currency: z.enum(CURRENCIES),
  })
  .optional();

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
        'transaction it documents. If the former charge is left empty it is deleted and reported ' +
        'as `deletedChargeId`.',
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
  documentType: z
    .enum(DOCUMENT_TYPES)
    .optional()
    .describe(
      'Reclassify the document, e.g. an OTHER the extractor missed that is really a RECEIPT.',
    ),
  serialNumber: z.string().max(100).optional().describe('The document’s own number.'),
  date: z
    .string()
    .regex(DATE_RE, 'YYYY-MM-DD')
    .optional()
    .describe('The document date, YYYY-MM-DD.'),
  amount: amountInput.describe('Replace the document total.'),
  vat: amountInput.describe('Replace the VAT amount on the document.'),
  description: z.string().max(1000).optional().describe('Replace the document description.'),
});
type UpdateDocumentInput = z.infer<typeof updateDocumentInput>;

const deleteDocumentInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  documentId: z.string().min(1).describe('The document to delete.'),
});
type DeleteDocumentInput = z.infer<typeof deleteDocumentInput>;

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
    fields.vat = { raw: input.vat.value, currency: input.vat.currency };
  }
  return fields;
}

async function updateDocumentHandler(
  input: UpdateDocumentInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const fields = documentFieldsOf(input);
  if (Object.keys(fields).length === 0) {
    throw new ToolInputError('No document changes requested', [
      {
        path: 'documentId',
        message:
          'provide at least one of chargeId, creditorId, debtorId, documentType, serialNumber, date, amount, vat or description',
      },
    ]);
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

  return shapeWriteResult({
    action: 'update_document',
    outcome: {
      documentId: input.documentId,
      updatedFields: Object.keys(fields),
      deletedChargeId: result.deletedChargeId ?? null,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'documents', values: echo ? [echo] : [] },
    summary:
      `Updated ${Object.keys(fields).join(', ')} on document ${input.documentId}.` +
      (result.deletedChargeId
        ? ` Its former charge ${result.deletedChargeId} was left empty and deleted.`
        : ''),
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
  const structured = result.structuredContent as { deletedChargeId?: string | null } | undefined;
  return {
    fields: {
      updatedFieldCount: Object.keys(documentFieldsOf(input)).length,
      movesCharge: input.chargeId !== undefined,
      deletedFormerCharge: !!structured?.deletedChargeId,
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
    'to the charge holding the card or bank row it documents (an emptied former charge is deleted ' +
    'and reported as `deletedChargeId`), and `creditorId` / `debtorId` to correct the businesses ' +
    'the extractor read off it — which is also what sets the charge’s counterparty on the ' +
    'document side. `documentType`, `serialNumber`, `date`, `amount`, `vat` and `description` ' +
    'fix extracted values. Only the fields you pass change. The echo under `documents` is the ' +
    'document as it now stands, alongside `documentId`, `updatedFields` and `deletedChargeId`. ' +
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
