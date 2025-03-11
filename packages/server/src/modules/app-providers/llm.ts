import { generateObject } from 'ai';
import { Injectable, Scope } from 'graphql-modules';
import stripIndent from 'strip-indent';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';
import { Currency, DocumentType } from '@shared/enums';

const documentDataSchema = z.object({
  type: z.nativeEnum(DocumentType).nullable().describe('The type of financial document'),
  issuer: z.string().nullable().describe('Legal name of the organization that issued the document'),
  recipient: z
    .string()
    .nullable()
    .describe('Legal name and details of the entity to whom the document is addressed'),
  fullAmount: z
    .number()
    .nullable()
    .describe('Total monetary amount including taxes and all charges'),
  currency: z.nativeEnum(Currency).nullable().describe('ISO 4217 currency code'),
  vatAmount: z
    .number()
    .nullable()
    .describe('Value Added Tax amount if separately specified on the document'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .describe('Document issue date in ISO 8601 format (YYYY-MM-DD)'),
  referenceCode: z
    .string()
    .nullable()
    .describe('Complete document identifier including any separators (e.g., dashes, slashes)'),
});

export type DocumentData = z.infer<typeof documentDataSchema>;

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
export class LLMProvider {
  model = anthropic('claude-3-7-sonnet-latest');

  /**
   * Convert File or Blob to Base64
   * @param fileOrBlob File or Blob to convert
   * @returns Base64 encoded string
   */
  private async fileToBase64(fileOrBlob: File | Blob): Promise<string> {
    const buffer = await fileOrBlob.arrayBuffer();
    const base64string = Buffer.from(buffer).toString('base64');
    return base64string;
  }

  /**
   * Extract invoice details using Anthropic API
   * @param fileOrBlob File or Blob to process
   * @returns Parsed invoice data
   */
  async extractInvoiceDetails(fileOrBlob: File | Blob): Promise<DocumentData> {
    try {
      const fileType = fileOrBlob.type.toLowerCase();
      if (!isSupportedFileType(fileType)) {
        throw new Error('Unsupported file type. Please provide an image or PDF.');
      }

      const fileData = await this.fileToBase64(fileOrBlob);

      const { object, usage } = await generateObject({
        model: this.model,
        schema: documentDataSchema,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: stripIndent(`Please analyze the provided document and extract:
                        - Document type
                        - Issuer and recipient details
                        - Monetary amounts (total and VAT)
                        - Date and reference numbers

                        Return only a JSON object without any explanation. Use NULL for missing values.`),
              },
              {
                type: 'file',
                data: fileData,
                mimeType: fileType,
              },
            ],
          },
        ],
      });

      // Shows token usage to calculate the cost of the request
      console.log('Usage:', usage);

      return object;
    } catch (error) {
      console.error('Error in document extraction:', error);
      throw error;
    }
  }

  /**
   * Match a document to a transaction
   * @param document The document to match
   * @returns The matched transaction
   */
  async matchDocumentToTransaction(
    document: DocumentData,
    transactions: { id: string }[],
  ): Promise<{ id: string } | null> {
    const schema = z.object({
      matchedTransactionId: z.string().nullable().describe('The ID of the matched transaction'),
      rationale: z
        .string()
        .nullable()
        .describe('Concise explanation of why the document was matched to the transaction'),
    });

    const { object, usage } = await generateObject({
      model: this.model,
      schema,
      system: stripIndent(`
        You are a helpful assistant that matches a document to a transaction for accounting purposes.
        You will be given a document and a list of transactions.
        You will need to match the document to the correct transaction.
        It's possible that the document doesn't match any transaction. Return NULL if that's the case.
      `),
      prompt: stripIndent(`
        Here is the data that was extracted from the document:
        <document>
        ${JSON.stringify(document)}
        </document>

        Here is the list of transactions:
        <transactions>
        ${transactions
          .map(
            transaction => `
        <transaction>
        ${JSON.stringify(transaction)}
        </transaction>
        `,
          )
          .join('\n')}
        </transactions>
      `),
    });

    console.log('Usage:', usage);
    console.log('Result:', object);

    const matchedTransactionId = object.matchedTransactionId;
    const matchedTransaction = transactions.find(
      transaction => transaction.id === matchedTransactionId,
    );

    return matchedTransaction ?? null;
  }
}
