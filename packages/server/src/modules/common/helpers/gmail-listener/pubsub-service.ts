import type { Message, Subscription } from '@google-cloud/pubsub';
import { gmail, gmailConfig, pubSubClient } from './config.js';
import { GmailService } from './gmail-service.js';
import { EmailData } from './types.js';

export class PubSubService {
  private gmailService: GmailService;
  private subscription: Subscription;

  constructor(targetLabel: string) {
    this.gmailService = new GmailService(targetLabel);
    this.subscription = pubSubClient.subscription(gmailConfig.subscriptionName);
  }

  async startListening(): Promise<void> {
    console.log('Starting to listen for Gmail notifications...');

    this.subscription.on('message', async (message: Message) => {
      try {
        const data = JSON.parse(message.data.toString());
        console.log('Received notification:', data);

        // Check if this is a new message notification
        if (data.emailAddress && data.historyId) {
          await this.handleGmailNotification(data);
        }

        message.ack();
      } catch (error) {
        console.error('Error processing message:', error);
        message.nack();
      }
    });

    this.subscription.on('error', (error: Error) => {
      console.error('Subscription error:', error);
    });
  }

  private async handleGmailNotification(data: any): Promise<void> {
    try {
      // Get recent messages (you might want to implement history-based fetching)
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 5,
        q: 'in:accounter/documents/',
      });

      const messages = response.data.messages || [];

      for (const message of messages) {
        if (await this.gmailService.hasTargetLabel(message.id!)) {
          const emailData = await this.gmailService.getEmailById(message.id!);
          if (emailData) {
            await this.executeCustomFunction(emailData);
          }
        }
      }
    } catch (error) {
      console.error('Error handling Gmail notification:', error);
    }
  }

  private async executeCustomFunction(emailData: EmailData): Promise<void> {
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

  stopListening(): void {
    this.subscription.removeAllListeners();
    console.log('Stopped listening for notifications');
  }
}
