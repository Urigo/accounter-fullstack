import { google, type gmail_v1 } from 'googleapis';
import { Environment } from '@shared/types';
import { troubleshootOAuth } from './config.js';

interface EmailData {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  body: string;
  labels: string[];
  receivedAt: Date;
  attachments?: {
    filename?: string;
    content?: string;
    mimeType?: string;
  }[];
}

type Labels = 'processed' | 'main' | 'errors' | 'debug';

export class GmailService {
  private targetLabel: string;
  public labelsDict: Record<Labels, string | undefined> = {
    main: undefined,
    processed: undefined,
    errors: undefined,
    debug: undefined,
  };
  public gmail: gmail_v1.Gmail;

  constructor(private gmailEnv: NonNullable<Environment['gmail']>) {
    this.targetLabel = this.gmailEnv.labelPath;

    const oauth2Client = new google.auth.OAuth2(this.gmailEnv.clientId, this.gmailEnv.clientSecret);

    oauth2Client.setCredentials({
      refresh_token: this.gmailEnv.refreshToken,
    });
    oauth2Client.getAccessToken();

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

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
  ): Promise<EmailData['attachments']> {
    if (!payload?.parts) return [];

    const attachments: EmailData['attachments'] = [];
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

  async getEmailById(messageId: string): Promise<EmailData | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      if (!message) return null;

      const headers = message.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const to = headers.find(h => h.name === 'To')?.value || '';
      const date = headers.find(h => h.name === 'Date')?.value || '';

      const body = this.getEmailBody(message.payload);

      const attachments = await this.getEmailAttachments(messageId, message.payload);

      return {
        id: message.id!,
        threadId: message.threadId!,
        subject,
        from,
        to,
        body,
        labels: message.labelIds || [],
        receivedAt: new Date(date),
        attachments,
      };
    } catch (error) {
      console.error('Error fetching email:', error);
      return null;
    }
  }

  async getLabelId(labelName: string): Promise<string | null> {
    try {
      const response = await this.gmail.users.labels.list({ userId: 'me' });
      const label = response.data.labels?.find(l => l.name === labelName);
      return label?.id || null;
    } catch (error) {
      console.error('Error fetching labels:', error);
      return null;
    }
  }

  async createLabel(name: string): Promise<string> {
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

  async setupPushNotifications(topicName: string): Promise<void> {
    try {
      await this.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/${topicName}`,
          labelIds: ['INBOX'], // Watch inbox changes
        },
      });
      console.log('Push notifications set up successfully');
    } catch (error) {
      console.error('Error setting up push notifications:', error);
      throw error;
    }
  }

  async setupLabels() {
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

  async handleMessage(message?: gmail_v1.Schema$Message) {
    if (!message?.id) return;

    if (await this.hasTargetLabel(message.id)) {
      const emailData = await this.getEmailById(message.id);
      if (emailData) {
        // Replace this with your custom logic
        console.log('Executing custom function for email:', {
          subject: emailData.subject,
          from: emailData.from,
          id: emailData.id,
        });

        // Example: Save to database, send webhook, process content, etc.
        // await saveToDatabase(emailData);
        // await sendWebhook(emailData);
        // await processEmailContent(emailData);
      }
    }
  }

  async handlePendingMessages() {
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

  async init() {
    await troubleshootOAuth(this.gmailEnv);
    await this.setupLabels();
    await this.handlePendingMessages();
  }
}
