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
  allocationNumber: z
    .string()
    .length(9)
    .nullable()
    .optional()
    .describe(
      'Should be empty if no VAT amount. Unique document 9-digits allocation number (מספר הקצאה). Usually last 9 digits of a longer number.',
    ),
});

type DocumentData = z.infer<typeof documentDataSchema>;

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
    const fileType = fileOrBlob.type.toLowerCase();
    if (!isSupportedFileType(fileType)) {
      throw new Error('Unsupported file type. Please provide an image or PDF.');
    }

    const fileData = await this.fileToBase64(fileOrBlob);

    const { object } = await generateObject({
      model: anthropic('claude-4-sonnet-20250514'),
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
                        - Allocation number (if VAT exists and applicable)

                        Return only a JSON object without any explanation. Use NULL value for missing values, allocation number is optional.`),
            },
            fileType === 'application/pdf'
              ? {
                  type: 'file',
                  data: fileData,
                  mediaType: fileType,
                }
              : {
                  type: 'image',
                  image: fileData,
                  mediaType: fileType,
                },
          ],
        },
      ],
    });

    return object;
  }
}
