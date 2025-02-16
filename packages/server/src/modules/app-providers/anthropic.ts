import { Inject, Injectable, Scope } from 'graphql-modules';
import stripIndent from 'strip-indent';
import Anthropic from '@anthropic-ai/sdk';
import { DocumentBlockParam, ImageBlockParam } from '@anthropic-ai/sdk/resources';
import { Currency, DocumentType } from '@shared/enums';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '@shared/types';

interface DocumentData {
  // The type of financial document
  type: DocumentType | null;

  // Legal name of the organization that issued the document
  issuer: string | null;

  // Legal name and details of the entity to whom the document is addressed
  recipient: string | null;

  // Total monetary amount including taxes and all charges
  fullAmount: number | null;

  // ISO 4217 currency code
  currency: Currency | null;

  // Value Added Tax amount if separately specified on the document
  vatAmount: number | null;

  // Document issue date in ISO 8601 format (YYYY-MM-DD)
  date: string | null;

  // Complete document identifier including any separators (e.g., dashes, slashes)
  referenceCode: string | null;
}

const IMAGE_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type ImageFileTypesTuple = typeof IMAGE_FILE_TYPES;
type ImageFileType = ImageFileTypesTuple[number];

function isImageFileType(value: string): value is ImageFileType {
  return IMAGE_FILE_TYPES.includes(value as ImageFileType);
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class AnthropicProvider {
  private client: Anthropic;

  constructor(@Inject(ENVIRONMENT) private env: Environment) {
    this.client = new Anthropic({
      // apiKey: 'TOKEN', // defaults to process.env["ANTHROPIC_API_KEY"]
    });
  }

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
   * Extract text from PDF (basic implementation)
   * @param pdfFile PDF file to extract text from
   * @returns Base64 encoded text
   */
  private async extractPDFText(pdfFile: File | Blob): Promise<string> {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const base64Data = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
    );
    return base64Data;
  }

  /**
   * Determine file type and prepare for OCR
   * @param fileOrBlob File or Blob to process
   * @returns Image or Document block for OCR
   */
  private async createMediaBlockFromFile(
    fileOrBlob: File | Blob,
  ): Promise<ImageBlockParam | DocumentBlockParam> {
    const fileType = fileOrBlob.type.toLowerCase();

    if (fileType.startsWith('image/')) {
      // If it's an image, convert directly to base64
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: isImageFileType(fileType) ? fileType : 'image/png',
          data: await this.fileToBase64(fileOrBlob),
        },
      };
    }
    if (fileType === 'application/pdf') {
      // If it's a PDF, attempt to extract text
      return {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: await this.extractPDFText(fileOrBlob),
        },
      };
    }
    throw new Error('Unsupported file type. Please provide an image or PDF.');
  }

  /**
   * Extract invoice details using Anthropic API
   * @param fileOrBlob File or Blob to process
   * @returns Parsed invoice data
   */
  async extractInvoiceDetails(fileOrBlob: File | Blob): Promise<DocumentData> {
    try {
      // Prepare file for OCR
      const mediaBlock = await this.createMediaBlockFromFile(fileOrBlob);

      // Process the first (or only) content
      const response = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              mediaBlock,
              {
                type: 'text',
                text: stripIndent(`Please analyze the provided document(s) and extract the following information into a JSON object with this structure:

                    {
                    // One of the following options [${Object.values(DocumentType).join(', ')}] or null
                    type: string;

                    // Legal name of the organization that issued the document
                    issuer: string;

                    // Legal name and details of the entity to whom the document is addressed
                    recipient: string;

                    // Total monetary amount including taxes and all charges
                    fullAmount: number;

                    // ISO 4217 currency code. One of [${Object.values(Currency).join(', ')}] or null
                    currency: string;

                    // Value Added Tax amount if separately specified on the document
                    vatAmount: number;

                    // Document issue date in ISO 8601 format (YYYY-MM-DD)
                    date: string;

                    // Complete document identifier including any separators (e.g., dashes, slashes)
                    referenceCode: string;
                    }

                    Please:
                    1. Return only the JSON object without any additional explanation
                    2. If any field is not found, use NULL
                    3. Ensure numbers are returned as numbers, not strings
                    4. Format dates in YYYY-MM-DD format
                    5. Use 3-letter ISO currency codes
                    6. Include any special characters (like dashes) in the referenceCode`),
              },
            ],
          },
        ],
      });

      // Parse the response
      const extractedText = response.content.find(c => c.type === 'text')?.text;

      try {
        // Attempt to parse the response as JSON
        return (extractedText ? JSON.parse(extractedText) : {}) as DocumentData;
      } catch (parseError) {
        console.error('Failed to parse document details:', parseError, extractedText);
        throw new Error('Could not parse document details');
      }
    } catch (error) {
      console.error('Error in document extraction:', error);
      throw error;
    }
  }
}
