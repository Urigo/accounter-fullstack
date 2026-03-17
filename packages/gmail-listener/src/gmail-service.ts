import { google, type gmail_v1 } from 'googleapis';
import inlineCss from 'inline-css';
import { Browser, chromium } from 'playwright';
import { Environment } from './environment.js';
import type { EmailAttachmentType } from './gql/graphql.js';
import { getServer } from './server-requests.js';
import { troubleshootOAuth } from './troubleshoot-auth.js';
import type { EmailData, EmailDocument, Labels, Server } from './types.js';

export class GmailService {
  private gmailEnv: Environment['gmail'];
  private targetLabel: string;
  public labelsDict: Record<Labels, string | undefined> = {
    main: undefined,
    processed: undefined,
    errors: undefined,
    debug: undefined,
  };
  public gmail: gmail_v1.Gmail;
  private server: Server;

  constructor(private env: Environment) {
    this.gmailEnv = this.env.gmail!;
    this.targetLabel = this.gmailEnv.labelPath;

    const oauth2Client = new google.auth.OAuth2(this.gmailEnv.clientId, this.gmailEnv.clientSecret);

    oauth2Client.setCredentials({
      refresh_token: this.gmailEnv.refreshToken,
    });
    oauth2Client.getAccessToken();

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    this.server = getServer();
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

  private async isMessageLabeledToProcess(messageId: string): Promise<boolean> {
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
      throw new Error('Error checking message labels');
    }
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

  /* documents handling */

  private async convertHtmlToPdf(rawHtml: string): Promise<Required<EmailDocument>> {
    let browser: Browser | null = null;
    try {
      browser = await chromium
        .launch({
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        .catch(e => {
          throw new Error(`Error launching browser: ${e.message}`);
        });

      const page = await browser.newPage().catch(e => {
        throw new Error(`Error creating new page: ${e.message}`);
      });

      const html = await inlineCss(rawHtml, { url: '/' }).catch(e => {
        throw new Error(`Error inlining CSS: ${e.message}`);
      });

      await page
        .setContent(html, {
          waitUntil: 'networkidle', // Wait until all network requests are done
        })
        .catch(e => {
          throw new Error(`Error setting page content: ${e.message}`);
        });

      const rawPdf = await page.pdf().catch(e => {
        throw new Error(`Error generating PDF: ${e.message}`);
      });

      await browser.close();

      const content = Buffer.from(rawPdf).toString('base64url');

      return {
        filename: 'body.pdf',
        content,
        mimeType: 'application/pdf',
      };
    } catch (error) {
      const message = `Error converting HTML to PDF`;
      console.error(`${message}: ${error}`);
      throw new Error(message);
    } finally {
      // Ensure browser is closed in case of error
      await browser?.close();
    }
  }

  private getLinkFromBody(body: string, partialUrl: string): string | null {
    const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi;
    let match;
    try {
      const partial = new URL(partialUrl);
      while ((match = regex.exec(body)) !== null) {
        const urlString = match[1];
        try {
          const fullUrl = new URL(urlString);
          if (fullUrl.hostname === partial.hostname) {
            return urlString;
          }
        } catch {
          // ignore invalid URLs in href
        }
      }
    } catch {
      // ignore invalid partialUrl
    }
    return null;
  }

  private async innerLinkDocumentFetcher(
    body: string,
    internalLink: string,
  ): Promise<Required<EmailDocument> | null> {
    try {
      const link = this.getLinkFromBody(body, internalLink);
      if (!link) {
        return null;
      }
      const response = await fetch(link);
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('text/html')) {
        const html = await response.text();

        const doc = await this.convertHtmlToPdf(html);
        return doc;
      }

      if (contentType?.includes('application/pdf')) {
        const data = await response
          .arrayBuffer()
          .then(buffer => Buffer.from(buffer).toString('base64url'));

        if (!data) {
          return null;
        }

        return {
          filename: 'external.pdf',
          content: data,
          mimeType: 'application/pdf',
        };
      }

      console.error(`Unsupported content type from link ${link}: ${contentType}`);
      return null;
    } catch (e) {
      console.error(`Error fetching document from internal link ${internalLink}: ${e}`);
      return null;
    }
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
            throw `Error on fetching attachment: ${e.message}`;
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

  private async getEmailData(messageId: string): Promise<EmailData | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      if (!message) {
        await this.labelMessageAsDebug(messageId);
        return null;
      }

      const headers = message.payload?.headers || [];
      let from = headers.find(h => h.name === 'From')?.value || '';

      if (from.includes("'SOFTWARE PRODUCTS GUILDA  LTD'")) {
        // skip self-issued-documents emails
        await this.labelMessageAsProcessed(messageId);
        return null;
      }

      if (from.includes('<')) {
        from = this.extractEmailAddress(from);
      }

      const replyTo = headers.find(h => h.name === 'Reply-To')?.value || undefined;

      const originalFrom =
        headers.find(h => h.name === 'X-Original-Sender')?.value ||
        this.extractEmailAddress(
          headers.find(h => h.name === 'X-Original-From')?.value || replyTo || '',
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
        replyTo,
        to,
        body,
        labels: message.labelIds || [],
        receivedAt: new Date(date),
      };

      const documents = await this.getEmailAttachments(messageId, message.payload);

      return { ...emailData, documents };
    } catch (error) {
      console.error('Error fetching email:', error);
      throw new Error('Error fetching email data');
    }
  }

  private getIssuerEmail(emailData: EmailData): string {
    // This regex looks for a mailto link inside an anchor tag
    // that appears after "From:".
    const regex = /From:.*?<a href="mailto:([^"]+)">/i;

    const invoiceIssuingProvidersEmail = ['notify@morning.co', 'c@sumit.co.il', 'ap@the-guild.dev'];

    const body = emailData.body;
    const bodyRows = body.split('\n').map(row => row.trim());
    for (const row of bodyRows) {
      const match = row.match(regex);
      if (match?.[1]) {
        const email = decodeURIComponent(match[1]);
        if (!invoiceIssuingProvidersEmail.includes(email.toLowerCase()) || !emailData.replyTo) {
          return email;
        }
      }
    }

    const senderEmail = [emailData.originalFrom, emailData.from].find(
      email => !!email && !invoiceIssuingProvidersEmail.includes(email.toLowerCase()),
    );

    if (senderEmail) {
      return senderEmail;
    }
    if (emailData.replyTo) {
      return emailData.replyTo;
    }

    return emailData.from;
  }

  public async handleMessage(message?: gmail_v1.Schema$Message) {
    if (!message?.id) return;

    try {
      if (await this.isMessageLabeledToProcess(message.id)) {
        const emailData = await this.getEmailData(message.id);
        if (!emailData) {
          // dealt with in emailData
          return;
        }

        console.log('Processing email:', {
          subject: emailData.subject,
          from: emailData.from,
          id: emailData.id,
        });

        const issuerEmail = this.getIssuerEmail(emailData);
        const { businessEmailConfig } = await this.server
          .businessEmailConfig({
            email: issuerEmail,
          })
          .catch(e => {
            console.error(`Error fetching business email config for email ${issuerEmail}:`, e);
            throw new Error('Error fetching business email config');
          });

        const extractedDocuments: Array<Required<EmailDocument>> = [];

        // Attachments documents
        const relevantDocuments: Required<EmailDocument>[] = (emailData.documents ?? []).filter(
          doc => {
            if (!doc.content || !doc.mimeType) return false;

            if (businessEmailConfig?.attachments) {
              let docType = doc.mimeType.split('/')[1].toLocaleUpperCase();
              if (docType === 'OCTET-STREAM' && doc.filename?.includes('.pdf')) {
                doc.mimeType = 'application/pdf';
                docType = 'PDF';
              }
              if (!businessEmailConfig.attachments.includes(docType as EmailAttachmentType)) {
                return false; // skip this attachment as per config
              }
            }
            return true;
          },
        ) as Required<EmailDocument>[];

        for (const doc of relevantDocuments) {
          extractedDocuments.push(doc);
        }

        // Email body as PDF
        if (!businessEmailConfig?.businessId || businessEmailConfig?.emailBody === true) {
          const doc = await this.convertHtmlToPdf(emailData.body);
          extractedDocuments.push(doc);
        }

        // Extract documents from internal links
        if (businessEmailConfig?.internalEmailLinks?.length) {
          for (const link of businessEmailConfig.internalEmailLinks) {
            const doc = await this.innerLinkDocumentFetcher(emailData.body, link);
            if (doc) {
              extractedDocuments.push(doc);
            }
          }
        }

        if (extractedDocuments.length === 0) {
          console.log(`No relevant documents found in email id=${message.id}, skipping.`);
          await this.labelMessageAsDebug(message.id);
          return;
        }

        const userDescription = `Email documents: ${emailData.subject} (from: ${emailData.from}, ${emailData.receivedAt.toDateString()})`;
        const documents = extractedDocuments.map(
          doc =>
            new File([Buffer.from(doc.content, 'base64')], doc.filename, {
              type: doc.mimeType,
            }),
        );
        const { insertEmailDocuments } = await this.server
          .insertEmailDocuments({
            documents,
            userDescription,
            messageId: message.id ?? undefined,
            businessId: businessEmailConfig?.businessId,
          })
          .catch(e => {
            console.error(`Error sending documents to server for email id=${message.id}:`, e);
            throw new Error('Error sending documents to server');
          });
        if (!insertEmailDocuments) {
          throw new Error(`Server processing failed for email id=${message.id}`);
        }

        await this.labelMessageAsProcessed(message.id);
      }
    } catch (error) {
      console.error(`Error handling message id=${message.id}:`, error);
      await this.labelMessageAsError(message.id);
    }
  }

  public async handlePendingMessages(): Promise<boolean> {
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

      return true;
    } catch (error) {
      console.error('Error fetching messages:', error);
      return false;
    }
  }

  public async init() {
    await troubleshootOAuth(this.gmailEnv);
    await this.setupLabels();
  }
}
