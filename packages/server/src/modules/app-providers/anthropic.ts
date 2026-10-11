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
import type { CacheGateOutcome } from './helpers/prompt-cache-gate.helper.js';
import { PromptCacheGate } from './helpers/prompt-cache-gate.helper.js';

const MODEL_ID = 'claude-sonnet-5';

/**
 * TTL for the cached match prefix (match instructions + business catalog).
 *
 * The default 5 minutes, not the hour, because arrival is bursty rather than
 * steady. Measured over a week of production gateway logs: a high-volume tenant's
 * documents land mostly in batches of emails seconds apart, separated by gaps of
 * hours, and a low-volume tenant almost never has two documents within five
 * minutes at all. So the cache only ever amortizes *within* a batch — five
 * minutes covers that with room to spare, and an hour does not come close to
 * spanning the gap to the next one.
 *
 * That makes the hour a pure surcharge: it costs 2x base input per write against
 * 1.25x for five minutes, to avoid writes it cannot actually avoid.
 *
 * Reads refresh the entry's timer for free, so a long batch stays warm on one
 * write. Keep CACHE_TTL_MS in step with CACHE_TTL — the gate below uses it to
 * decide when the entry has expired.
 */
const CACHE_TTL = '5m' as const;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * How long a match call will wait for another request to warm a cold prefix.
 *
 * Bounded well inside the email gateway's 30s ingest timeout, which is
 * deliberately not retried: on expiry every waiter proceeds and pays its own
 * cache write, which is more expensive but never stalls an ingest. Only match
 * calls are gated — extraction never waits on the gate.
 */
const CACHE_GATE_MAX_WAIT_MS = 10 * 1000;

/**
 * Shaved off the TTL when recording warmth, since Anthropic measures an entry's
 * lifetime from the start of the request that writes or reads it — generation
 * time counts against it.
 */
const CACHE_GATE_SAFETY_MARGIN_MS = 60 * 1000;

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
});

// `.optional()` rather than `.nullable()`, per rule 1 above: it keeps the grammar
// cheap, and it lets the model omit a side it cannot match without failing schema
// validation.
const businessMatchSchema = z.object({
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
type BusinessMatch = z.infer<typeof businessMatchSchema>;

/** A party the deterministic matcher could not resolve, as extracted from the document. */
type UnresolvedParty = { name: string; vatNumber: string };

export type DocumentDataWithMatches = Omit<DocumentData, 'type' | 'currency'> & {
  type?: DocumentType;
  currency?: Currency;
  suggestedIssuer: string | null;
  suggestedRecipient: string | null;
};

/**
 * Extraction instructions. They carry no catalog and no cache breakpoint: on
 * their own they sit far below the model's minimum cacheable prefix, so there
 * is nothing to write.
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

/**
 * The static half of the cached match prefix. A module constant, deliberately:
 * anything interpolated in here (a date, a filename, a tenant id) would sit ahead
 * of the catalog in the prefix and invalidate it on every request.
 */
const MATCHING_INSTRUCTIONS =
  stripIndent(`You match the parties of a financial document against the KNOWN BUSINESSES catalog below.

    The user message lists the issuer and/or recipient that could not be matched automatically, as extracted from the document: the name, the VAT or registration number when present, and the document's description for context.

    Set \`issuerMatch\` / \`recipientMatch\` to the UUID of the closest matching business, copied verbatim from the catalog. Omit a field entirely when there is no confident match, and for any party that is not listed. Do not guess, and never invent a UUID that is not in the catalog.

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

function buildExtractionMessages(fileData: string, fileType: string): ModelMessage[] {
  return [
    { role: 'system', content: EXTRACTION_INSTRUCTIONS },
    {
      role: 'user',
      content: [{ type: 'file', data: fileData, mediaType: fileType }],
    },
  ];
}

/**
 * Build the match system prompt: static instructions first, then the tenant's
 * business catalog. Ordering is load-bearing. Prompt caching is a prefix match, so
 * content is only reusable if everything ahead of it is byte-identical — stable
 * content has to physically precede volatile content. Instructions never change,
 * and the catalog changes only when the tenant's businesses do.
 */
function buildMatchSystemPrompt(businesses: BusinessMatchData[]): string {
  return `${MATCHING_INSTRUCTIONS}\n${serializeBusinessCatalog(businesses)}`;
}

/**
 * The match request: the cached system prompt, then the unresolved parties in the
 * user turn. The breakpoint on the system block means the instructions and the
 * whole catalog are written once per tenant and read back at 0.1x by every later
 * match within the TTL. The user turn is the only per-document payload, and it
 * is a few lines of extracted text — the document itself is never re-sent.
 */
function buildMatchMessages(
  systemPrompt: string,
  unresolved: { issuer?: UnresolvedParty; recipient?: UnresolvedParty },
  description: string,
): ModelMessage[] {
  const lines: string[] = [];
  for (const [side, party] of Object.entries(unresolved)) {
    if (party) {
      const vat = party.vatNumber ? ` (VAT/registration number: ${party.vatNumber})` : '';
      lines.push(`Unmatched ${side}: ${JSON.stringify(party.name)}${vat}`);
    }
  }
  if (description) {
    lines.push(`Document description: ${JSON.stringify(description)}`);
  }
  return [
    {
      role: 'system',
      content: systemPrompt,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral', ttl: CACHE_TTL } },
      },
    },
    { role: 'user', content: lines.join('\n') },
  ];
}

function generateDocumentData(messages: ModelMessage[]) {
  return generateText({
    model: anthropic(MODEL_ID),
    output: Output.object({ schema: documentDataSchema }),
    messages,
    experimental_telemetry: { isEnabled: true, functionId: 'ocr-extract-invoice' },
  });
}

function generateBusinessMatch(messages: ModelMessage[]) {
  return generateText({
    model: anthropic(MODEL_ID),
    output: Output.object({ schema: businessMatchSchema }),
    messages,
    experimental_telemetry: { isEnabled: true, functionId: 'ocr-match-business' },
  });
}

function extractionError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  return new Error(`Failed to extract document details: ${message}`);
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AnthropicProvider {
  /**
   * Coordinates concurrent match calls that share one cached prefix. Correctness
   * rests on this provider being a singleton: one gate per process, shared by
   * every caller — the email ingest path and the interactive upload path alike.
   */
  private readonly cacheGate = new PromptCacheGate({
    ttlMs: CACHE_TTL_MS,
    maxWaitMs: CACHE_GATE_MAX_WAIT_MS,
    safetyMarginMs: CACHE_GATE_SAFETY_MARGIN_MS,
  });

  private async fileToBase64(fileOrBlob: File | Blob): Promise<string> {
    const buffer = await fileOrBlob.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  /**
   * Extract the document's fields, then resolve its issuer and recipient against
   * the tenant's businesses.
   *
   * The catalog is attached only when it can earn its place: on a financial
   * document with a named side the deterministic matcher could not resolve.
   * Riding on every request instead would bill it for documents that can never
   * use it — rendered email bodies, non-financial documents, and documents
   * `matchBusiness` resolves on its own — and production arrival is too sparse
   * for the cache to amortize that: one tenant almost never has two documents
   * within the TTL, so nearly every request would pay the write premium for
   * nothing.
   */
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

    const { output: draft, usage: extractionUsage } = await generateDocumentData(
      buildExtractionMessages(fileData, fileType),
    ).catch(err => {
      throw extractionError(err);
    });
    logOcrUsage('extract', extractionUsage, {
      tenantId: owner?.id,
      documentType: draft.type,
    });

    // The deterministic matcher stays primary: it keys off VAT numbers and
    // normalized names, which is more trustworthy than a judgement call. The
    // model is only consulted for a side it left unresolved.
    let suggestedIssuer = matchBusiness(draft.issuer, draft.issuerVatNumber, businessList);
    let suggestedRecipient = matchBusiness(draft.recipient, draft.recipientVatNumber, businessList);

    // Scoped to financial documents: a delivery note or a bank letter has no
    // meaningful issuer/recipient to resolve, and a match accepted there would feed
    // `applyForeignCounterpartyVatDefault` and the counterparty resolution for a
    // document that has no counterparty.
    if (businessList.length > 0 && draft.type != null && FINANCIAL_DOC_TYPES.has(draft.type)) {
      // Only a side the document actually has: a match for a side with no
      // extracted name could only be a guess.
      const unresolved = {
        issuer:
          suggestedIssuer === null && draft.issuer
            ? { name: draft.issuer, vatNumber: draft.issuerVatNumber }
            : undefined,
        recipient:
          suggestedRecipient === null && draft.recipient
            ? { name: draft.recipient, vatNumber: draft.recipientVatNumber }
            : undefined,
      };

      if (unresolved.issuer || unresolved.recipient) {
        const match = await this.matchUnresolvedParties(
          businessList,
          unresolved,
          draft.description,
        );
        if (match) {
          // Validated against the catalog so a hallucinated UUID can never reach
          // the document pipeline as a creditor/debtor.
          const knownId = (id: string | undefined): string | null =>
            id && businessList.some(b => b.id === id) ? id : null;

          if (unresolved.issuer) {
            suggestedIssuer = knownId(match.output.issuerMatch);
          }
          if (unresolved.recipient) {
            suggestedRecipient = knownId(match.output.recipientMatch);
          }

          logOcrUsage('match', match.usage, {
            tenantId: owner?.id,
            catalogSize: businessList.length,
            gate: match.gate,
            modelMatchUsed:
              (!!unresolved.issuer && suggestedIssuer !== null) ||
              (!!unresolved.recipient && suggestedRecipient !== null),
          });
        }
      }
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

    return {
      ...draft,
      vatAmount,
      type: validatedType,
      currency: validatedCurrency,
      suggestedIssuer,
      suggestedRecipient,
    };
  }

  /**
   * One gated, catalog-bearing match request. Returns null if it fails: a failed
   * match never costs the extraction, it just leaves the unresolved sides
   * unresolved.
   */
  private async matchUnresolvedParties(
    businessList: BusinessMatchData[],
    unresolved: { issuer?: UnresolvedParty; recipient?: UnresolvedParty },
    description: string,
  ): Promise<{ output: BusinessMatch; usage: LanguageModelUsage; gate: CacheGateOutcome } | null> {
    const systemPrompt = buildMatchSystemPrompt(businessList);
    try {
      // Under the gate: a cache entry is not readable until the request that writes
      // it responds, so without this every miss in a batch writes its own copy of
      // the catalog. The gate lets one call warm a cold prefix while its siblings
      // wait, and lets everyone through untouched once it is warm.
      const { result, gate } = await this.cacheGate.run(
        systemPrompt,
        () => generateBusinessMatch(buildMatchMessages(systemPrompt, unresolved, description)),
        // Warmth is recorded from what the response actually reports, never from an
        // assumption that the write landed. Both counters zero means the prefix
        // never reached the model's minimum cacheable length.
        ({ usage: u }) =>
          (u?.inputTokenDetails?.cacheReadTokens ?? 0) > 0 ||
          (u?.inputTokenDetails?.cacheWriteTokens ?? 0) > 0,
      );
      return { output: result.output, usage: result.usage, gate };
    } catch (err) {
      console.warn(
        `anthropic.ocr: business match request failed, keeping the deterministic match: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}

/**
 * Record what each OCR call cost, and what the prompt cache actually did.
 *
 * The expensive failure mode of prompt caching is silent: a change to prompt
 * assembly stops the prefix matching, every request quietly pays full price, and
 * nothing errors — the bill is just higher. These counters are the only ground
 * truth that caching is working, so they get logged on every call rather than
 * measured once at setup.
 *
 * `call` is `extract` for every document and `match` only when the catalog was
 * sent. Match lines over extract lines with a financial `documentType`, per
 * tenant, is the deterministic matcher's miss rate — the quantity that decides
 * what the catalog costs.
 *
 * On match calls, healthy steady state is `cacheReadTokens` covering the catalog
 * on all but the first match of a TTL window. A persistent `cacheReadTokens: 0`
 * with a non-empty catalog means something ahead of the breakpoint is varying per
 * request. Both zero means the prefix never reached the model's 1024-token
 * minimum, which is expected for a small tenant and harmless.
 *
 * Read cost, not hit rate. A shorter TTL can lower the hit rate while lowering
 * the bill, because a 5-minute write is 1.25x base input against 2x for an hour
 * — tracking hit rate alone reads that as a regression.
 *
 * `gate` reports how a match call was scheduled, so a collapse in cache reads can
 * be told apart from a gate that stopped coalescing. `modelMatchUsed` says whether
 * the model resolved a side the deterministic matcher could not.
 */
function logOcrUsage(
  call: 'extract' | 'match',
  usage: LanguageModelUsage,
  context: {
    tenantId?: string;
    documentType?: string;
    catalogSize?: number;
    gate?: CacheGateOutcome;
    modelMatchUsed?: boolean;
  },
): void {
  try {
    console.info(
      JSON.stringify({
        msg: 'anthropic.ocr.usage',
        call,
        model: MODEL_ID,
        ...context,
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
