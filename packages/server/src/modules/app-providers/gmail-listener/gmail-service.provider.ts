import { google, type gmail_v1 } from 'googleapis';
import { Inject, Injectable, Scope } from 'graphql-modules';
import nodeHtmlToImage from 'node-html-to-image';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '@shared/types';
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
  to: string;
  body: string;
  labels: string[];
  receivedAt: Date;
  documents?: EmailDocument[];
}

type Labels = 'processed' | 'main' | 'errors' | 'debug';

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

  constructor(@Inject(ENVIRONMENT) private env: Environment) {
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
          removeLabelIds: [this.labelsDict.main, this.labelsDict.processed],
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
          removeLabelIds: [this.labelsDict.main, this.labelsDict.errors],
        },
      } as gmail_v1.Params$Resource$Users$Messages$Modify)
      .catch(e => {
        console.error(`Error labeling email id=${messageId} as processed: ${e}`);
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

      const to = headers.find(h => h.name === 'To')?.value || '';
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';
      const body = this.getEmailBody(message.payload);

      const emailData = {
        id: message.id!,
        threadId: message.threadId!,
        subject,
        from,
        to,
        body,
        labels: message.labelIds || [],
        receivedAt: new Date(date),
      };

      // 1. Check for attached files
      const attachments = await this.getEmailAttachments(messageId, message.payload);
      if (attachments?.length) {
        return { ...emailData, documents: attachments };
      }

      // 2. Check for links inside the email body
      // TODO: implement

      // 3. Use the email body as a document

      const dataUrl = await nodeHtmlToImage({
        type: 'png',
        encoding: 'base64',
        html: `<html><body>${body}</body></html>`,
      })
        .then(res => res as string)
        .catch(error => {
          throw `Error while trying to convert Email body to an image: ${error}`;
        });

      return {
        ...emailData,
        documents: [
          {
            filename: 'body.png',
            content: dataUrl,
            mimeType: 'image/png',
          },
        ],
      };
    } catch (error) {
      console.error('Error fetching email:', error);
      return null;
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
        if (emailData?.documents?.length) {
          // Replace this with your custom logic
          console.log('Executing custom function for email:', {
            subject: emailData.subject,
            from: emailData.from,
            id: emailData.id,
            documents: emailData.documents,
          });

          // TODO: Upload to claudinary
          // TODO: run through AI
          // TODO: insert to DB

          // this.labelMessageAsProcessed(message.id);
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
