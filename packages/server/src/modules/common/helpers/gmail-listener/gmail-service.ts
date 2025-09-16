import { gmail, troubleshootOAuth } from './config.js';
import { EmailData } from './types.js';

export class GmailService {
  private targetLabel: string;

  constructor(targetLabel: string) {
    this.targetLabel = targetLabel;
  }

  async getEmailById(messageId: string): Promise<EmailData | null> {
    try {
      const response = await gmail.users.messages.get({
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

      // Extract body (simplified - you might want to handle multipart messages)
      let body = '';
      if (message.payload?.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString();
      } else if (message.payload?.parts) {
        const textPart = message.payload.parts.find(
          part => part.mimeType === 'text/plain' || part.mimeType === 'text/html',
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString();
        }
      }

      return {
        id: message.id!,
        threadId: message.threadId!,
        subject,
        from,
        to,
        body,
        labels: message.labelIds || [],
        receivedAt: new Date(date),
      };
    } catch (error) {
      console.error('Error fetching email:', error);
      return null;
    }
  }

  async getLabelId(labelName: string): Promise<string | null> {
    try {
      const response = await gmail.users.labels.list({ userId: 'me' });
      const label = response.data.labels?.find(l => l.name === labelName);
      return label?.id || null;
    } catch (error) {
      console.error('Error fetching labels:', error);
      return null;
    }
  }

  async hasTargetLabel(messageId: string): Promise<boolean> {
    try {
      const labelId = await this.getLabelId(this.targetLabel);
      if (!labelId) return false;

      const message = await gmail.users.messages.get({
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
      // await troubleshootOAuth();

      await gmail.users.watch({
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
}
