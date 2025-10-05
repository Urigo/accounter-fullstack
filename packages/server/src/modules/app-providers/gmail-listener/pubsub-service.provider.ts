import { Inject, Injectable, Scope } from 'graphql-modules';
import { PubSub, Topic, type Message, type Subscription } from '@google-cloud/pubsub';
import { ENVIRONMENT } from '@shared/tokens';
import type { Environment } from '@shared/types';
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

  constructor(
    @Inject(ENVIRONMENT) private env: Environment,
    private gmailService: GmailServiceProvider,
  ) {
    this.gmailEnv = this.env.gmail!;
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
      throw `Error handling push message: ${err}`;
    }
  }

  private async setupPushNotifications(topicName: string): Promise<void> {
    try {
      await this.gmailService.gmail.users
        .watch({
          userId: 'me',
          requestBody: {
            topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/${topicName}`,
            labelIds: ['INBOX'], // Watch inbox changes
          },
        })
        .then(res => {
          if (res?.data?.historyId) {
            this.historyId = res.data.historyId;
          }
        });
      console.log('Push notifications set up successfully');
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
    this.subscription?.removeAllListeners();
    console.log('Stopped listening for notifications');
  }

  public healthCheck(): boolean {
    return !!this.subscription;
  }
}
