import { generateText, LanguageModelUsage, ModelMessage, Output } from 'ai';
import { Injectable, Scope } from 'graphql-modules';
import stripIndent from 'strip-indent';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';
import { Currency, DocumentType } from '../../shared/enums.js';
import type { BusinessMatchData, OwnerMatchInfo } from './helpers/business-matcher.helper.js';
import {
  applyForeignCounterpartyVatDefault,
  matchBusiness,
  serializeBusinessCatalog,
} from './helpers/business-matcher.helper.js';

const MODEL_ID = 'claude-sonnet-4-5';

/**
 * TTL for the cached prompt prefix (instructions + business catalog).
 *
 * Anthropic prices a 5-minute cache write at 1.25x base input and a 1-hour write
 * at 2x, against reads at 0.1x — so the catalog pays for itself from the second
 * document in a 5-minute window, or the third in an hour. Document processing
 * here is bursty (an email batch, a user uploading a folder) with gaps well over
 * five minutes between bursts, and a read refreshes the entry's timer for free,
 * so the hour buys reuse across an entire working session for one extra write.
 *
 * Revisit against the logged `cacheReadTokens` / `cacheWriteTokens`: a tenant
 * that never reaches three documents an hour is better off on the default 5m.
 */
const CACHE_TTL = '1h' as const;

// NOTE: schema is kept as simple as possible to stay under Anthropic's constrained-decoding
// grammar complexity budget. Two rules:
//  1. Fields use `.optional()` (not `.nullable().optional()`) — `.nullable()` emits
//     `anyOf: [..., {type:"null"}]` which counts against the budget.
//  2. Enum fields (`type`, `currency`) use `z.string()` with valid values listed in
//     `.describe()` instead of `z.enum()`. Each enum value is a grammar alternative;
//     18 explicit values across 2 fields pushed the schema over the limit. Values are
//     validated against the TypeScript enums after the LLM call.
const documentDataSchema = z.object({
  type: z
    .enum(DocumentType)
    .describe('The type of financial document. Return UNPROCESSED if missing.'),
  issuer: z
    .string()
    .describe(
      'Legal name of the organization that issued the document. Return empty string if missing.',
    ),
  recipient: z
    .string()
    .describe(
      'Legal name and details of the entity to whom the document is addressed. Return empty string if missing.',
    ),
  issuerVatNumber: z
    .string()
    .describe('VAT or business registration number of the issuer. Return empty string if missing.'),
  recipientVatNumber: z
    .string()
    .describe(
      'VAT or business registration number of the recipient. Return empty string if missing.',
    ),
  fullAmount: z
    .number()
    .nullable()
    .describe(
      'Total monetary amount including taxes and all charges. Return NULL (not empty string!) if missing.',
    ),
  currency: z
    .enum(Currency)
    .nullable()
    .describe('ISO 4217 currency code. Return NULL (not empty string!) if missing.'),
  vatAmount: z
    .number()
    .nullable()
    .describe(
      'Value Added Tax amount if separately specified. Return NULL (not empty string!) if missing.',
    ),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe(
      'Document issue date in ISO 8601 format (YYYY-MM-DD). Return NULL (not empty string!) if missing.',
    ),
  referenceCode: z
    .string()
    .describe(
      'Complete document identifier including any separators (e.g., dashes, slashes). Return empty string if missing.',
    ),
  allocationNumber: z
    .string()
    .length(9)
    .nullable()
    .describe(
      'Unique document 9-digit allocation number (מספר הקצאה). Sometimes last 9 digits of a longer number. Return NULL (not empty string!) if no VAT amount, if amount is < 5000 ILS, or if missing.',
    ),
  description: z
    .string()
    .describe('Additional description or remarks. Return empty string if missing.'),
  // Business matching, folded into the extraction schema so one call does both.
  // `.optional()` rather than `.nullable()` on purpose: per rule 1 above it keeps
  // the grammar cheap, and it lets the model omit a side it cannot match without
  // failing schema validation — preserving the property that a failed match
  // degrades the result instead of failing the whole extraction.
  issuerMatch: z
    .string()
    .optional()
    .describe(
      'UUID of the issuer, copied from the KNOWN BUSINESSES catalog. Omit entirely if no confident match. Never guess.',
    ),
  recipientMatch: z
    .string()
    .optional()
    .describe(
      'UUID of the recipient, copied from the KNOWN BUSINESSES catalog. Omit entirely if no confident match. Never guess.',
    ),
});

type DocumentData = z.infer<typeof documentDataSchema>;

export type DocumentDataWithMatches = Omit<
  DocumentData,
  'type' | 'currency' | 'issuerMatch' | 'recipientMatch'
> & {
  type?: DocumentType;
  currency?: Currency;
  suggestedIssuer: string | null;
  suggestedRecipient: string | null;
};

/**
 * The static half of the cached prefix. A module constant, deliberately: anything
 * interpolated in here (a date, a filename, a tenant id) would sit ahead of the
 * catalog in the prefix and invalidate it on every request.
 */
const EXTRACTION_INSTRUCTIONS = stripIndent(`You extract structured data from financial documents.

    Analyze the provided document and extract:
    - Document type
    - Issuer and recipient details (names and VAT/registration numbers)
    - Monetary amounts (total and VAT)
    - Date and reference numbers
    - Allocation number (if VAT exists and applicable)
    - Description or remarks

    Note that some receipts (e.g. by Stripe) carry the invoice details; pay extra attention not to misclassify them as INVOICE_RECEIPT.

    Omit any field whose value is missing or not present on the document; allocation number is optional.`);

const MATCHING_INSTRUCTIONS =
  stripIndent(`Additionally, match the document's issuer and recipient against the KNOWN BUSINESSES catalog below.

    Set \`issuerMatch\` / \`recipientMatch\` to the UUID of the closest matching business, copied verbatim from the catalog. Omit a field entirely when there is no confident match. Do not guess, and never invent a UUID that is not in the catalog.

    KNOWN BUSINESSES (format: UUID|name):`);

const FINANCIAL_DOC_TYPES = new Set<string>([
  DocumentType.Invoice,
  DocumentType.Receipt,
  DocumentType.InvoiceReceipt,
  DocumentType.CreditInvoice,
  DocumentType.Proforma,
]);

const SUPPORTED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
] as const;
type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number];

function isSupportedFileType(value: string): value is SupportedFileType {
  return SUPPORTED_FILE_TYPES.includes(value as SupportedFileType);
}

/**
 * Build the system prompt: static instructions first, then the tenant's business
 * catalog. Ordering is load-bearing. Prompt caching is a prefix match, so content
 * is only reusable if everything ahead of it is byte-identical — stable content
 * has to physically precede volatile content. Instructions never change, the
 * catalog changes only when the tenant's businesses do, and the document (the one
 * genuinely per-request payload) stays out of here entirely, in the user turn
 * behind the cache breakpoint.
 */
function buildSystemPrompt(businesses: BusinessMatchData[]): string {
  if (businesses.length === 0) {
    return EXTRACTION_INSTRUCTIONS;
  }
  return `${EXTRACTION_INSTRUCTIONS}\n\n${MATCHING_INSTRUCTIONS}\n${serializeBusinessCatalog(businesses)}`;
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AnthropicProvider {
  private async fileToBase64(fileOrBlob: File | Blob): Promise<string> {
    const buffer = await fileOrBlob.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  async extractInvoiceDetails(
    fileOrBlob: File | Blob,
    businesses?: BusinessMatchData[],
    owner?: OwnerMatchInfo,
  ): Promise<DocumentDataWithMatches> {
    const fileType = fileOrBlob.type.toLowerCase();
    if (!isSupportedFileType(fileType)) {
      throw new Error('Unsupported file type. Please provide an image or PDF.');
    }

    const fileData = await this.fileToBase64(fileOrBlob);
    const businessList = businesses ?? [];

    const messages: Array<ModelMessage> = [
      {
        role: 'system',
        content: buildSystemPrompt(businessList),
        // The cache breakpoint. Everything up to and including this block — the
        // instructions and the whole business catalog — is written once per tenant
        // and read back at 0.1x on every later document, for as long as the TTL
        // holds. The document itself sits after it and is processed fresh, which
        // is correct: it differs every time and there is nothing to reuse.
        providerOptions: {
          anthropic: { cacheControl: { type: 'ephemeral', ttl: CACHE_TTL } },
        },
      },
      {
        role: 'user',
        content: [{ type: 'file', data: fileData, mediaType: fileType }],
      },
    ];

    const { output, usage } = await generateText({
      model: anthropic(MODEL_ID),
      output: Output.object({ schema: documentDataSchema }),
      messages,
      experimental_telemetry: { isEnabled: true, functionId: 'ocr-extract-invoice' },
    }).catch(err => {
      throw new Error(`Failed to extract document details: ${err.message}`);
    });

    logCacheUsage(usage, businessList.length);

    const draft = output;

    // The deterministic matcher stays primary and the model's suggestion is the
    // fallback, exactly as before the two calls were merged: `matchBusiness` keys
    // off VAT numbers and normalized names, which is more trustworthy than a
    // judgement call. The model only gets consulted for a side it left unresolved.
    let suggestedIssuer = matchBusiness(draft.issuer, draft.issuerVatNumber, businessList);
    let suggestedRecipient = matchBusiness(draft.recipient, draft.recipientVatNumber, businessList);

    // Scoped to financial documents, as the separate match call was: a delivery note
    // or a bank letter has no meaningful issuer/recipient to resolve, and a match
    // accepted there would feed `applyForeignCounterpartyVatDefault` and the
    // counterparty resolution for a document that has no counterparty.
    if (businessList.length > 0 && draft.type != null && FINANCIAL_DOC_TYPES.has(draft.type)) {
      // Validated against the catalog so a hallucinated UUID can never reach the
      // document pipeline as a creditor/debtor.
      const knownId = (id: string | undefined): string | null =>
        id && businessList.some(b => b.id === id) ? id : null;

      suggestedIssuer ??= knownId(draft.issuerMatch);
      suggestedRecipient ??= knownId(draft.recipientMatch);
    }

    const vatAmount = applyForeignCounterpartyVatDefault(
      draft.vatAmount,
      owner,
      suggestedIssuer,
      suggestedRecipient,
      businessList,
    );

    const validatedType = (Object.values(DocumentType) as string[]).includes(draft.type ?? '')
      ? (draft.type as DocumentType)
      : undefined;
    const validatedCurrency = (Object.values(Currency) as string[]).includes(draft.currency ?? '')
      ? (draft.currency as Currency)
      : undefined;

    const { issuerMatch: _issuerMatch, recipientMatch: _recipientMatch, ...rest } = draft;

    return {
      ...rest,
      vatAmount,
      type: validatedType,
      currency: validatedCurrency,
      suggestedIssuer,
      suggestedRecipient,
    };
  }
}

/**
 * Record what the prompt cache actually did.
 *
 * The expensive failure mode of prompt caching is silent: a change to prompt
 * assembly stops the prefix matching, every request quietly pays full price, and
 * nothing errors — the bill is just higher. These counters are the only ground
 * truth that caching is working, so they get logged on every call rather than
 * measured once at setup.
 *
 * Healthy steady state is `cacheReadTokens` covering the catalog on all but the
 * first document of a TTL window. A persistent `cacheReadTokens: 0` with a
 * non-empty catalog means something ahead of the breakpoint is varying per
 * request. Both zero means the prefix never reached the model's 1024-token
 * minimum, which is expected for a small tenant and harmless.
 */
function logCacheUsage(usage: LanguageModelUsage, catalogSize: number): void {
  try {
    console.info(
      JSON.stringify({
        msg: 'anthropic.ocr.usage',
        model: MODEL_ID,
        catalogSize,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
        cacheReadTokens: usage?.inputTokenDetails?.cacheReadTokens,
        cacheWriteTokens: usage?.inputTokenDetails?.cacheWriteTokens,
      }),
    );
  } catch {
    // Observability must never fail an extraction that already succeeded.
  }
}
