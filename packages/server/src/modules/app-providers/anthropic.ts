import { generateText, ModelMessage, Output } from 'ai';
import { Injectable, Scope } from 'graphql-modules';
import stripIndent from 'strip-indent';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';
import { Currency, DocumentType } from '../../shared/enums.js';
import type { BusinessMatchData } from './helpers/business-matcher.helper.js';
import { matchBusiness } from './helpers/business-matcher.helper.js';

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

type DocumentData = z.infer<typeof documentDataSchema>;

export type DocumentDataWithMatches = Omit<DocumentData, 'type' | 'currency'> & {
  type?: DocumentType;
  currency?: Currency;
  suggestedIssuer: string | null;
  suggestedRecipient: string | null;
};

const businessMatchSchema = z.object({
  issuerMatch: z
    .string()
    .nullable()
    .describe('UUID of the best-matching issuer business, or null if no confident match'),
  recipientMatch: z
    .string()
    .nullable()
    .describe('UUID of the best-matching recipient business, or null if no confident match'),
});

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
  ): Promise<DocumentDataWithMatches> {
    const fileType = fileOrBlob.type.toLowerCase();
    if (!isSupportedFileType(fileType)) {
      throw new Error('Unsupported file type. Please provide an image or PDF.');
    }

    const fileData = await this.fileToBase64(fileOrBlob);

    const inputMessages: Array<ModelMessage> = [
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: stripIndent(`Please analyze the provided document and extract:
                        - Document type
                        - Issuer and recipient details (names and VAT/registration numbers)
                        - Monetary amounts (total and VAT)
                        - Date and reference numbers
                        - Allocation number (if VAT exists and applicable)
                        - Description or remarks

                        Note that some receipts (e.g. by Stripe) carry the invoice details; pay extra attention not to misclassify them as INVOICE_RECEIPT.

                        Return only a JSON object without any explanation. Omit any field whose value is missing or not present on the document; allocation number is optional.`),
          },
          { type: 'file', data: fileData, mediaType: fileType },
        ],
      },
    ];

    const { output, response } = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      output: Output.object({ schema: documentDataSchema }),
      messages: inputMessages,
    }).catch(err => {
      throw new Error(`Failed to extract document details: ${err.message}`);
    });

    const draft = output;

    const businessList = businesses ?? [];
    let suggestedIssuer = matchBusiness(draft.issuer, draft.issuerVatNumber, businessList);
    let suggestedRecipient = matchBusiness(draft.recipient, draft.recipientVatNumber, businessList);

    // LLM fallback: for financial documents with unmatched sides, ask Claude to
    // pick from the businesses list using the existing conversation context (no
    // file re-send — the document is already in the prior turn).
    if (
      businessList.length > 0 &&
      draft.type != null &&
      FINANCIAL_DOC_TYPES.has(draft.type) &&
      (suggestedIssuer === null || suggestedRecipient === null)
    ) {
      const unmatched: string[] = [];
      if (suggestedIssuer === null && draft.issuer) {
        unmatched.push(`issuer "${draft.issuer}"`);
      }
      if (suggestedRecipient === null && draft.recipient) {
        unmatched.push(`recipient "${draft.recipient}"`);
      }

      if (unmatched.length > 0) {
        const sortedBusinesses = [...businessList].sort(
          (a, b) => (b.suggestion_data?.priority ?? 0) - (a.suggestion_data?.priority ?? 0),
        );
        const businessesText = sortedBusinesses
          .map(b => `${b.id}|${b.name ?? b.hebrew_name ?? ''}`)
          .join('\n');

        const followUpText = [
          `The document has unmatched ${unmatched.join(' and ')}.`,
          `Below is a list of known businesses (format: UUID|name). Return the UUID of the closest matching business for each unmatched side, or null if no confident match. Do not guess.`,
          businessesText,
        ].join('\n\n');

        try {
          const { output: matchOutput } = await generateText({
            model: anthropic('claude-sonnet-4-5'),
            output: Output.object({ schema: businessMatchSchema }),
            messages: [
              ...inputMessages,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ...(response.messages as any[]),
              { role: 'user' as const, content: followUpText },
            ],
          });

          if (matchOutput) {
            if (
              suggestedIssuer === null &&
              matchOutput.issuerMatch &&
              businessList.some(b => b.id === matchOutput.issuerMatch)
            ) {
              suggestedIssuer = matchOutput.issuerMatch;
            }
            if (
              suggestedRecipient === null &&
              matchOutput.recipientMatch &&
              businessList.some(b => b.id === matchOutput.recipientMatch)
            ) {
              suggestedRecipient = matchOutput.recipientMatch;
            }
          }
        } catch {
          // LLM fallback failure is non-fatal — proceed with server-side match only
        }
      }
    }

    const validatedType = (Object.values(DocumentType) as string[]).includes(draft.type ?? '')
      ? (draft.type as DocumentType)
      : undefined;
    const validatedCurrency = (Object.values(Currency) as string[]).includes(draft.currency ?? '')
      ? (draft.currency as Currency)
      : undefined;

    return {
      ...draft,
      type: validatedType,
      currency: validatedCurrency,
      suggestedIssuer,
      suggestedRecipient,
    };
  }
}
