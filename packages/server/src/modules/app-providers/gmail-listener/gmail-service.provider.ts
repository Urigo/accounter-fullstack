import { google, type gmail_v1 } from 'googleapis';
import { Inject, Injectable, Scope } from 'graphql-modules';
import nodeHtmlToImage from 'node-html-to-image';
import { ChargesProvider } from '@modules/charges/providers/charges.provider.js';
import {
  getDocumentFromUrlsAndOceData,
  type OcrData,
} from '@modules/documents/helpers/upload.helper.js';
import { DocumentsProvider } from '@modules/documents/providers/documents.provider.js';
import {
  EmailListenerConfig,
  suggestionDataSchema,
} from '@modules/financial-entities/helpers/business-suggestion-data-schema.helper.js';
import { BusinessesProvider } from '@modules/financial-entities/providers/businesses.provider.js';
import { DocumentType } from '@shared/enums';
import { EmailAttachmentType } from '@shared/gql-types';
import { hashStringToInt } from '@shared/helpers';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '@shared/types';
import { AnthropicProvider } from '../anthropic.js';
import { CloudinaryProvider } from '../cloudinary.js';
import { troubleshootOAuth } from './config.js';

type EmailDocument = {
  filename?: string;
  content?: string;
  mimeType?: string;
};

interface EmailData {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  originalFrom?: string;
  to: string;
  body: string;
  labels: string[];
  receivedAt: Date;
  documents?: EmailDocument[];
}

type Labels = 'processed' | 'main' | 'errors' | 'debug';

const decode64Url = (raw: string) => {
  // Replace non-url compatible chars with base64 standard chars
  raw = raw.replace(/-/g, '+').replace(/_/g, '/');

  // Pad out with standard base64 required padding characters
  const pad = raw.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error(
        'InvalidLengthError: raw base64url string is the wrong length to determine padding',
      );
    }
    raw += new Array(5 - pad).join('=');
  }

  return raw;
};

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class GmailServiceProvider {
  private gmailEnv: NonNullable<Environment['gmail']>;
  private targetLabel: string;
  public labelsDict: Record<Labels, string | undefined> = {
    main: undefined,
    processed: undefined,
    errors: undefined,
    debug: undefined,
  };
  public gmail: gmail_v1.Gmail;

  constructor(
    @Inject(ENVIRONMENT) private env: Environment,
    private cloudinaryProvider: CloudinaryProvider,
    private anthropicProvider: AnthropicProvider,
    private chargesProvider: ChargesProvider,
    private documentsProvider: DocumentsProvider,
    private businessesProvider: BusinessesProvider,
  ) {
    this.gmailEnv = this.env.gmail!;
    this.targetLabel = this.gmailEnv.labelPath;

    const oauth2Client = new google.auth.OAuth2(this.gmailEnv.clientId, this.gmailEnv.clientSecret);

    oauth2Client.setCredentials({
      refresh_token: this.gmailEnv.refreshToken,
    });
    oauth2Client.getAccessToken();

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    this.init();
  }

  /* labels */

  private async getLabelId(labelName: string): Promise<string | null> {
    try {
      const response = await this.gmail.users.labels.list({ userId: 'me' });
      const label = response.data.labels?.find(l => l.name === labelName);
      return label?.id || null;
    } catch (error) {
      console.error('Error fetching labels:', error);
      return null;
    }
  }

  private async createLabel(name: string): Promise<string> {
    const newLabel = await this.gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
      },
    });
    if (!newLabel.data.id) {
      throw new Error('Failed to create label');
    }
    return newLabel.data.id;
  }

  async hasTargetLabel(messageId: string): Promise<boolean> {
    try {
      const labelId = await this.getLabelId(this.targetLabel);
      if (!labelId) return false;

      const message = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'minimal',
      });

      return message.data.labelIds?.includes(labelId) || false;
    } catch (error) {
      console.error('Error checking labels:', error);
      return false;
    }
  }

  private async setupLabels() {
    const response = await this.gmail.users.labels.list({ userId: 'me' }).catch(err => {
      throw `Error fetching inbox labels: ${err}`;
    });
    const labels = response.data.labels ?? [];

    await Promise.all(
      Object.keys(this.labelsDict).map(async key => {
        try {
          const path = key === 'main' ? this.targetLabel : `${this.targetLabel}/${key}`;
          const existingLabel = labels.find(label => label.name === path);
          this.labelsDict[key as Labels] = existingLabel?.id ?? (await this.createLabel(path));
        } catch (e) {
          throw new Error(`Error creating new label [${key}]: ${e}`);
        }
      }),
    );
  }

  private async labelMessageAsError(messageId: string) {
    await this.gmail.users.messages
      .modify({
        id: messageId,
        userId: 'me',
        requestBody: {
          addLabelIds: [this.labelsDict.errors],
          removeLabelIds: [this.labelsDict.main, this.labelsDict.processed, this.labelsDict.debug],
        },
      } as gmail_v1.Params$Resource$Users$Messages$Modify)
      .catch(e => {
        console.error(`Error labeling email id=${messageId} as error: ${e}`);
      });
  }

  private async labelMessageAsProcessed(messageId: string) {
    await this.gmail.users.messages
      .modify({
        id: messageId,
        userId: 'me',
        requestBody: {
          addLabelIds: [this.labelsDict.processed],
          removeLabelIds: [this.labelsDict.main, this.labelsDict.errors, this.labelsDict.debug],
        },
      } as gmail_v1.Params$Resource$Users$Messages$Modify)
      .catch(e => {
        console.error(`Error labeling email id=${messageId} as processed: ${e}`);
      });
  }

  private async labelMessageAsDebug(messageId: string) {
    await this.gmail.users.messages
      .modify({
        id: messageId,
        userId: 'me',
        requestBody: {
          addLabelIds: [this.labelsDict.debug],
          removeLabelIds: [this.labelsDict.main, this.labelsDict.errors, this.labelsDict.processed],
        },
      } as gmail_v1.Params$Resource$Users$Messages$Modify)
      .catch(e => {
        console.error(`Error labeling email id=${messageId} as debug: ${e}`);
      });
  }

  /* email parsing */

  private getBodyWithRecursion(payload: gmail_v1.Schema$MessagePart, mimeType: string) {
    let body = '';

    if (payload.parts) {
      for (const part of payload.parts) {
        body = this.getBodyWithRecursion(part, mimeType) || body;
      }
    } else if (
      payload.body?.data != null &&
      payload.body.attachmentId == null &&
      payload.mimeType === mimeType
    ) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    return body;
  }

  private getEmailBody(payload?: gmail_v1.Schema$MessagePart): string {
    if (!payload) return '';

    const htmlBody = this.getBodyWithRecursion(payload, 'text/html');
    if (htmlBody) {
      return htmlBody;
    }
    return this.getBodyWithRecursion(payload, 'text/plain');
  }

  private async getEmailAttachments(
    messageId: string,
    payload?: gmail_v1.Schema$MessagePart,
  ): Promise<EmailDocument[]> {
    if (!payload?.parts) return [];

    const attachments: EmailDocument[] = [];
    // handle relevant attachment
    const attachmentParts = payload.parts.filter(
      part =>
        part.mimeType === 'application/pdf' ||
        (part.mimeType === 'application/octet-stream' && part.filename?.includes('.pdf')) ||
        part.mimeType?.split('/')[0] === 'image',
    );
    if (attachmentParts.length) {
      for (const attachmentPart of attachmentParts) {
        const attachment = await this.gmail.users.messages.attachments
          .get({
            userId: 'me',
            messageId,
            id: attachmentPart.body?.attachmentId ?? undefined,
          })
          .catch(e => {
            throw `Error on fetching attachement: ${e.message}`;
          });

        attachments.push({
          filename: attachmentPart.filename ?? undefined,
          content: attachment.data.data ?? undefined,
          mimeType: attachmentPart.mimeType ?? undefined,
        });
      }
    }
    return attachments;
  }

  private extractEmailAddress(original: string): string {
    const match = original.match(/<(.+)>/);
    if (match?.[1]) {
      return match[1];
    }
    return original;
  }

  private async getEmailById(messageId: string): Promise<EmailData | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      if (!message) return null;

      const headers = message.payload?.headers || [];
      const from = headers.find(h => h.name === 'From')?.value || '';

      if (from === 'SOFTWARE PRODUCTS GUILDA  LTD <notify@morning.co>') {
        // skip self-issued-documents emails
        return null;
      }

      const originalFrom =
        headers.find(h => h.name === 'X-Original-Sender')?.value ||
        this.extractEmailAddress(
          headers.find(h => h.name === 'X-Original-From')?.value ||
            headers.find(h => h.name === 'Reply-To')?.value ||
            '',
        );
      const to = this.extractEmailAddress(headers.find(h => h.name === 'To')?.value || '');
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const body = this.getEmailBody(message.payload);

      const emailData = {
        id: message.id!,
        threadId: message.threadId!,
        subject,
        from,
        originalFrom,
        to,
        body,
        labels: message.labelIds || [],
        receivedAt: new Date(date),
      };

      const documents = await this.getEmailAttachments(messageId, message.payload);

      return { ...emailData, documents };
    } catch (error) {
      console.error('Error fetching email:', error);
      return null;
    }
  }

  private async getUrls(doc: EmailDocument) {
    if (!doc.content || !doc.mimeType) {
      throw new Error('Document content or mimeType is missing for URL extraction');
    }

    return this.cloudinaryProvider
      .uploadInvoiceToCloudinary(`data:${doc.mimeType};base64,${decode64Url(doc.content)}`)
      .catch(e => {
        console.error('Error uploading to Cloudinary:', e);
        throw new Error(`Error on uploading file to cloudinary: ${e.message}`);
      });
  }

  private async getOcrData(doc: EmailDocument): Promise<OcrData> {
    const validateNumber = (value: unknown): number | null => {
      return typeof value === 'number' && !Number.isNaN(value) ? value : null;
    };

    const validateDate = (value: string | null): Date | null => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    if (!doc.content || !doc.mimeType) {
      throw new Error('Document content or mimeType is missing for OCR');
    }

    try {
      const buffer = Buffer.from(decode64Url(doc.content), 'base64');
      const file = new File([buffer], doc.filename ?? 'unknown', { type: doc.mimeType });

      const draft = await this.anthropicProvider.extractInvoiceDetails(file);

      if (!draft) {
        throw new Error('No data returned from Anthropic OCR');
      }

      let isOwnerIssuer: boolean | null = null;
      if (draft.recipient?.toLocaleLowerCase().includes('the guild')) {
        isOwnerIssuer = false;
      }
      if (draft.issuer?.toLocaleLowerCase().includes('the guild')) {
        isOwnerIssuer = true;
      }

      return {
        isOwnerIssuer,
        counterpartyId: null,
        documentType: draft.type ?? DocumentType.Unprocessed,
        serial: draft.referenceCode,
        date: validateDate(draft.date),
        amount: validateNumber(draft.fullAmount),
        currency: draft.currency,
        vat: validateNumber(draft.vatAmount),
        allocationNumber: draft.allocationNumber ?? null,
      };
    } catch (e) {
      const message = 'Error extracting OCR data from document';
      console.error(`${message}: ${e}`);
      throw new Error(message);
    }
  }

  private async handleAttachment(
    doc: Required<EmailDocument>,
    chargeId: string,
    messageId?: string,
    businessId?: string,
  ) {
    try {
      console.log(`Uploading document: ${doc.filename}, type: ${doc.mimeType}`);

      const hash = hashStringToInt(doc.content);

      const [{ fileUrl, imageUrl }, ocrData] = await Promise.all([
        this.getUrls(doc),
        this.getOcrData(doc),
      ]);

      if (businessId) {
        // link business if found by email
        ocrData.counterpartyId = businessId;
      }

      const documentToUpload = getDocumentFromUrlsAndOceData(
        fileUrl,
        imageUrl,
        ocrData,
        this.env.authorization.adminBusinessId,
        chargeId,
        hash,
      );

      // insert to DB
      const [document] = await this.documentsProvider.insertDocuments({
        document: [documentToUpload],
      });

      if (!document) {
        throw new Error('Failed to insert document into the database');
      }

      console.log('Document to upload:', documentToUpload);
    } catch (e) {
      console.error(`Error processing document ${doc.filename} in email id=${messageId}: ${e}`);
      throw new Error(`Error processing document ${doc.filename}`);
    }
  }

  public async handleMessage(message?: gmail_v1.Schema$Message) {
    if (!message?.id) return;

    if (
      await this.hasTargetLabel(message.id).catch(e => {
        console.error(`Error checking target label for message id=${message?.id}: ${e}`);
        return false;
      })
    ) {
      try {
        const emailData = await this.getEmailById(message.id);
        if (emailData) {
          console.log('Processing email:', {
            subject: emailData.subject,
            from: emailData.from,
            id: emailData.id,
          });

          const business = await this.businessesProvider.getBusinessByEmail(
            emailData.originalFrom || emailData.from,
          );

          let listenerConfig: EmailListenerConfig = {};
          if (business?.suggestion_data) {
            const { data, success, error } = suggestionDataSchema.safeParse(
              business.suggestion_data,
            );
            if (success) {
              if (data.emailListener) {
                listenerConfig = data.emailListener;
              }
            } else {
              console.error(
                `Invalid suggestion_data schema for business ${business.id}: ${JSON.stringify(error.issues)}`,
              );
            }
          }

          const extractedDocuments: Array<Required<EmailDocument>> = [];

          // Attachments documents
          const relevantDocuments: Required<EmailDocument>[] = (emailData.documents ?? []).filter(
            doc => {
              if (!doc.content || !doc.mimeType) return false;

              if (listenerConfig.attachments) {
                const docType = doc.mimeType
                  .split('/')[1]
                  .toLocaleUpperCase() as EmailAttachmentType;
                if (!listenerConfig.attachments.includes(docType)) {
                  return false; // skip this attachment as per config
                }
              }
              return true;
            },
          ) as Required<EmailDocument>[];

          for (const doc of relevantDocuments) {
            extractedDocuments.push(doc);
          }

          // Email body as image
          if (!business || listenerConfig.emailBody === true) {
            try {
              const image = await nodeHtmlToImage({
                type: 'png',
                encoding: 'base64',
                html: `<html><body>${emailData.body}</body></html>`,
              }).catch(error => {
                console.error(
                  `Error converting email body to image for email id=${message.id}: ${error}`,
                );
                throw new Error('Error while trying to convert Email body to an image');
              });

              const doc = {
                filename: 'body.png',
                content: image.toString(),
                mimeType: 'image/png',
              };

              extractedDocuments.push(doc);
            } catch (e) {
              console.error(`Error processing email body for email id=${message.id}: ${e}`);
              throw new Error('Error processing email body');
            }
          }

          // Extract documents from internal links
          if (listenerConfig.internalEmailLinks?.length) {
            // future feature
          }

          if (extractedDocuments.length === 0) {
            console.log(`No relevant documents found in email id=${message.id}, skipping.`);
            await this.labelMessageAsDebug(message.id);
            return;
          }

          const [charge] = await this.chargesProvider
            .generateCharge({
              ownerId: this.env.authorization.adminBusinessId,
              userDescription: `Email documents: ${emailData.subject} (from: ${emailData.from}, ${emailData.receivedAt.toDateString()})`,
            })
            .catch(e => {
              throw new Error(`Error generating charge for email id=${message.id}: ${e}`);
            });

          if (!charge?.id) {
            throw new Error(`Charge creation failed for email id=${message.id}`);
          }

          await Promise.all(
            extractedDocuments.map(async doc =>
              this.handleAttachment(doc, charge.id, message.id ?? undefined, business?.id),
            ),
          );

          this.labelMessageAsProcessed(message.id);
        }
      } catch (error) {
        console.error(`Error handling message id=${message.id}:`, error);
        await this.labelMessageAsError(message.id);
      }
    }
  }

  private async handlePendingMessages() {
    try {
      // Get recent messages
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults: 1000,
        q: `in:${this.gmailEnv.labelPath}`,
      });

      const messages = response.data.messages || [];

      for (const message of messages) {
        await this.handleMessage(message);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }

  public async init() {
    await troubleshootOAuth(this.gmailEnv);
    await this.setupLabels();
    await this.handlePendingMessages();
  }
}
