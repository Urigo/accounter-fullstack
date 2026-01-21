import { Inject, Injectable, Scope } from 'graphql-modules';
import { PubSub, Topic, type Message, type Subscription } from '@google-cloud/pubsub';
import { ENVIRONMENT } from '../../../shared/tokens.js';
import type { Environment } from '../../../shared/types/index.js';
import { GmailServiceProvider } from './gmail-service.provider.js';

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class PubsubServiceProvider {
  private gmailEnv: NonNullable<Environment['gmail']>;
  private subscription: Subscription | null = null;
  private topic: Topic | null = null;
  private pubSubClient: PubSub;
  private historyId: string | undefined = undefined;
  private processesGuard = new Set<string>();
  private watchExpirationTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(ENVIRONMENT) private env: Environment,
    private gmailService: GmailServiceProvider,
  ) {
    if (!this.env.gmail) {
      throw new Error('Gmail environment configuration is missing');
    }
    this.gmailEnv = this.env.gmail;
    this.pubSubClient = new PubSub({ projectId: this.gmailEnv.cloudProjectId });

    this.startListening();
  }

  private async validateAndCreateTopic(): Promise<Topic> {
    if (this.topic) return this.topic;

    // Look for existing topic
    try {
      const existingTopic = this.pubSubClient.topic(this.gmailEnv.topicName);
      if (existingTopic) {
        this.topic = existingTopic;
        return existingTopic;
      }
    } catch {
      /* empty */
    }

    // Creates a new topic
    console.log(
      `Creating new Pub/Sub topic [${this.gmailEnv.topicName}] for Gmail notifications...`,
    );
    const [topic] = await this.pubSubClient.createTopic(this.gmailEnv.topicName);
    this.topic = topic;
    return topic;
  }

  private async validateAndCreateSubscription(): Promise<Subscription> {
    if (this.subscription) return this.subscription;

    this.topic ||= await this.validateAndCreateTopic();

    // Look for existing topic

    try {
      const existingSubscription = this.pubSubClient.subscription(this.gmailEnv.subscriptionName);
      if (existingSubscription) {
        this.subscription = existingSubscription;
        return existingSubscription;
      }
    } catch {
      /* empty */
    }

    // Creates a subscription on that topic
    console.log(
      `Creating new Pub/Sub subscription [${this.gmailEnv.subscriptionName}] for [${this.gmailEnv.topicName}] topic...`,
    );
    const [subscription] = await this.topic.createSubscription(this.gmailEnv.subscriptionName);
    this.subscription = subscription;
    return subscription;
  }

  private async handleGmailNotification(historyId: string): Promise<void> {
    try {
      if (!this.gmailService.labelsDict.main) {
        console.error('Main label not found, cannot process emails');
        return;
      }

      const history = await this.gmailService.gmail.users.history.list({
        startHistoryId: this.historyId || historyId,
        userId: 'me',
      });

      if (history.data?.history?.length) {
        const notifications = history.data.history;
        for (const notification of notifications) {
          if (notification.labelsAdded) {
            for (const message of notification.labelsAdded) {
              if (message?.labelIds?.includes(this.gmailService.labelsDict.main)) {
                const id = message.message?.id;
                if (id && !this.processesGuard.has(id)) {
                  this.processesGuard.add(id);
                  try {
                    await this.gmailService.handleMessage(message.message);
                  } catch (error) {
                    console.error('Error handling email:', error);
                  }
                  this.processesGuard.delete(id);
                }
              }
            }
          }
        }
      }

      this.historyId = historyId;
    } catch (err) {
      throw new Error(`Error handling push message: ${err}`);
    }
  }

  private async setupPushNotifications(topicName: string): Promise<void> {
    try {
      const response = await this.gmailService.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: `projects/${this.gmailEnv.cloudProjectId}/topics/${topicName}`,
          labelIds: ['INBOX'], // Watch inbox changes
        },
      });

      if (response?.data?.historyId) {
        this.historyId = response.data.historyId;
      }

      // Schedule renewal before expiration
      if (response?.data?.expiration) {
        const expirationMs = parseInt(response.data.expiration);
        const now = Date.now();
        const renewalTime = expirationMs - now - 24 * 60 * 60 * 1000; // Renew 1 day before expiry

        if (this.watchExpirationTimer) {
          clearTimeout(this.watchExpirationTimer);
        }

        this.watchExpirationTimer = setTimeout(
          () => {
            console.log('Renewing Gmail watch subscription...');
            this.setupPushNotifications(topicName).catch(error => {
              console.error('Failed to renew Gmail watch:', error);
            });
          },
          Math.max(renewalTime, 0),
        );

        console.log(
          `Push notifications set up successfully. Watch expires at ${new Date(expirationMs).toISOString()}, renewal scheduled`,
        );
      } else {
        console.log('Push notifications set up successfully');
      }
    } catch (error) {
      console.error('Error setting up push notifications:', error);
      throw error;
    }
  }

  public async startListening(): Promise<void> {
    // populate topic and subscription
    this.topic ||= await this.validateAndCreateTopic().catch(error => {
      console.error('Error validating/creating Pub/Sub topic:', error);
      throw error;
    });

    this.subscription ||= await this.validateAndCreateSubscription().catch(error => {
      console.error('Error validating/creating Pub/Sub subscription:', error);
      throw error;
    });

    // Setup Gmail push notifications
    await this.setupPushNotifications(this.gmailEnv.topicName).catch(error => {
      console.error('Error setting up Gmail push notifications:', error);
      throw error;
    });

    console.log('Starting to listen for Gmail notifications...');

    this.subscription.on('message', async (message: Message) => {
      try {
        const data = JSON.parse(message.data.toString());
        console.log('Received notification:', data);

        // Check if this is a new message notification
        if (data.emailAddress && data.historyId) {
          await this.handleGmailNotification(data.historyId);
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

  public stopListening(): void {
    if (this.watchExpirationTimer) {
      clearTimeout(this.watchExpirationTimer);
      this.watchExpirationTimer = null;
    }
    this.subscription?.removeAllListeners();
    console.log('Stopped listening for notifications');
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.subscription) return false;

    // Verify Gmail API connection is still active
    try {
      await this.gmailService.gmail.users.getProfile({ userId: 'me' });
      return true;
    } catch (error) {
      console.error('Gmail API connection failed in health check:', error);
      return false;
    }
  }
}
