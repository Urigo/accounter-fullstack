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
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastMessageReceived: Date | null = null;
  private messageCount = 0;
  private isListening = false;

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
      const [exists] = await existingTopic.exists();
      if (exists) {
        this.topic = existingTopic;
        return existingTopic;
      }
    } catch (error) {
      console.error(`[PubSub] Error checking topic existence:`, error);
    }

    // Creates a new topic
    console.log(
      `[PubSub] Creating new Pub/Sub topic [${this.gmailEnv.topicName}] for Gmail notifications...`,
    );
    const [topic] = await this.pubSubClient.createTopic(this.gmailEnv.topicName);
    console.log(`[PubSub] Successfully created topic: ${this.gmailEnv.topicName}`);
    this.topic = topic;
    return topic;
  }

  private async validateAndCreateSubscription(): Promise<Subscription> {
    if (this.subscription) return this.subscription;

    this.topic ||= await this.validateAndCreateTopic();

    // Look for existing subscription
    try {
      const existingSubscription = this.pubSubClient.subscription(this.gmailEnv.subscriptionName);
      const [exists] = await existingSubscription.exists();
      if (exists) {
        console.log(`[PubSub] Found existing subscription: ${this.gmailEnv.subscriptionName}`);
        this.subscription = existingSubscription;
        return existingSubscription;
      }
      console.log(`[PubSub] Subscription does not exist: ${this.gmailEnv.subscriptionName}`);
    } catch (error) {
      console.error(`[PubSub] Error checking subscription existence:`, error);
    }

    // Creates a subscription on that topic
    console.log(
      `[PubSub] Creating new Pub/Sub subscription [${this.gmailEnv.subscriptionName}] for [${this.gmailEnv.topicName}] topic...`,
    );
    const [subscription] = await this.topic.createSubscription(this.gmailEnv.subscriptionName);
    console.log(`[PubSub] Successfully created subscription: ${this.gmailEnv.subscriptionName}`);
    this.subscription = subscription;
    return subscription;
  }

  private async handleGmailNotification(historyId: string): Promise<void> {
    try {
      if (!this.gmailService.labelsDict.main) {
        console.error('[Gmail] Main label not found, cannot process emails');
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
                    console.error(`[Gmail] Error handling email ${id}:`, error);
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
      console.error(`[Gmail] Error handling push message:`, err);
      throw new Error(`Error handling push message: ${err}`);
    }
  }

  private async setupPushNotifications(topicName: string): Promise<void> {
    const fullTopicName = `projects/${this.gmailEnv.cloudProjectId}/topics/${topicName}`;

    try {
      const response = await this.gmailService.gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: fullTopicName,
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
        const expirationDate = new Date(expirationMs);
        const renewalTime = expirationMs - now - 24 * 60 * 60 * 1000; // Renew 1 day before expiry

        if (this.watchExpirationTimer) {
          clearTimeout(this.watchExpirationTimer);
        }

        const renewWatch = () => {
          console.log(`[Gmail Watch] Renewing Gmail watch subscription...`);
          this.setupPushNotifications(topicName).catch(error => {
            console.error(
              `[Gmail Watch] Failed to renew Gmail watch. Retrying in 5 minutes.`,
              error,
            );
            // Retry after a delay
            setTimeout(renewWatch, 5 * 60 * 1000);
          });
        };

        this.watchExpirationTimer = setTimeout(renewWatch, Math.max(renewalTime, 0));

        console.log(
          `[Gmail Watch] Push notifications set up successfully.\n` +
            `  Expiration: ${expirationDate.toISOString()} (${Math.round(renewalTime / 1000 / 60 / 60)} hours)\n` +
            `  Renewal scheduled: ${new Date(now + renewalTime).toISOString()}`,
        );
      } else {
        console.warn(
          `[Gmail Watch] No expiration time in response! Watch may expire unexpectedly.`,
        );
      }
    } catch (error) {
      console.error(`[Gmail Watch] Error setting up push notifications:`, error);
      throw error;
    }
  }

  public async startListening(): Promise<void> {
    // populate topic and subscription
    this.topic ||= await this.validateAndCreateTopic().catch(error => {
      console.error('[PubSub] Error validating/creating Pub/Sub topic:', error);
      throw error;
    });

    this.subscription ||= await this.validateAndCreateSubscription().catch(error => {
      console.error('[PubSub] Error validating/creating Pub/Sub subscription:', error);
      throw error;
    });

    // Setup Gmail push notifications
    await this.setupPushNotifications(this.gmailEnv.topicName).catch(error => {
      console.error('[PubSub] Error setting up Gmail push notifications:', error);
      throw error;
    });

    console.log('[PubSub] Setting up message and error handlers...');

    this.subscription.on('message', async (message: Message) => {
      this.lastMessageReceived = new Date();
      this.messageCount++;

      try {
        const data = JSON.parse(message.data.toString());
        console.log(
          `[PubSub] <<<< Received notification #${this.messageCount} at ${this.lastMessageReceived.toISOString()}:`,
          data,
        );

        // Check if this is a new message notification
        if (data.emailAddress && data.historyId) {
          await this.handleGmailNotification(data.historyId);
        } else {
          console.warn(`[PubSub] Notification missing expected fields:`, data);
        }

        message.ack();
      } catch (error) {
        console.error('[PubSub] Error processing message:', error);
        console.error('[PubSub] Message data:', message.data.toString());
        // Acknowledge anyway to prevent infinite redelivery
        message.ack();
      }
    });

    this.subscription.on('error', (error: Error) => {
      console.error(`[PubSub] !!!! Subscription error at ${new Date().toISOString()}:`, error);
      console.error(`[PubSub] Error stack:`, error.stack);
      // Attempt to reconnect
      console.log(`[PubSub] Attempting to recover from subscription error...`);
      this.restartListening();
    });

    this.subscription.on('close', () => {
      console.warn(`[PubSub] !!!! Subscription closed at ${new Date().toISOString()}`);
      this.isListening = false;
    });

    this.isListening = true;
    console.log(`[PubSub] ======= Listener is now ACTIVE =======`);

    // Start periodic health checks
    this.startHealthMonitoring();
  }

  private async restartListening(): Promise<void> {
    console.log(`[PubSub] Restarting listener...`);
    try {
      this.stopListening();
      // Wait a bit before restarting
      await new Promise(resolve => setTimeout(resolve, 5000));
      await this.startListening();
    } catch (error) {
      console.error(`[PubSub] Failed to restart listener:`, error);
      // Retry after delay
      setTimeout(() => this.restartListening(), 30000);
    }
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check health every 10 minutes
    this.healthCheckInterval = setInterval(
      async () => {
        const now = new Date();
        const timeSinceLastMessage = this.lastMessageReceived
          ? (now.getTime() - this.lastMessageReceived.getTime()) / 1000 / 60
          : null;

        console.log(
          `[PubSub Health] Status Check at ${now.toISOString()}:\n` +
            `  Listening: ${this.isListening}\n` +
            `  Messages received: ${this.messageCount}\n` +
            `  Last message: ${this.lastMessageReceived?.toISOString() || 'Never'}\n` +
            `  Time since last: ${timeSinceLastMessage ? `${timeSinceLastMessage.toFixed(1)} minutes` : 'N/A'}\n` +
            `  History ID: ${this.historyId || 'Not set'}`,
        );

        const isHealthy = await this.healthCheck();
        if (!isHealthy) {
          console.error(`[PubSub Health] Health check FAILED! Attempting restart...`);
          await this.restartListening();
        } else {
          console.log(`[PubSub Health] Health check PASSED`);
        }
      },
      10 * 60 * 1000,
    ); // Every 10 minutes

    console.log(`[PubSub] Health monitoring started (10-minute intervals)`);
  }

  public stopListening(): void {
    if (this.watchExpirationTimer) {
      clearTimeout(this.watchExpirationTimer);
      this.watchExpirationTimer = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.subscription?.removeAllListeners();
    this.isListening = false;
    console.log(`[PubSub] Stopped listening for notifications`);
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.subscription) {
      console.error(`[PubSub Health] No subscription object!`);
      return false;
    }

    // Check if subscription is still open
    if (!this.isListening) {
      console.error(`[PubSub Health] Listener is not active!`);
      return false;
    }

    // Verify Gmail API connection is still active
    try {
      const profile = await this.gmailService.gmail.users.getProfile({ userId: 'me' });
      console.log(`[PubSub Health] Gmail API connection OK (email: ${profile.data.emailAddress})`);
      return true;
    } catch (error) {
      console.error('[PubSub Health] Gmail API connection FAILED:', error);
      return false;
    }
  }
}
