export type Channel = 'alerts' | 'events';

/**
 * Every notification the server can send, and the channel it goes to. Call sites are added by
 * later PRs; a type that is not listed here cannot be sent.
 */
export const NOTIFICATION_CHANNELS = {
  'tenant.created': 'events',
  'invitation.accepted': 'events',
  'server.crashed': 'alerts',
  'job.failed': 'alerts',
  'db.pool.saturated': 'alerts',
  'db.connection.leaked': 'alerts',
  'graphql.internal-error': 'alerts',
  'email-ingestion.quarantined': 'alerts',
  /** Sent by the notifier itself when the global alert cap is hit. */
  'notifications.alert-storm': 'alerts',
} as const satisfies Record<string, Channel>;

export type NotificationType = keyof typeof NOTIFICATION_CHANNELS;

/**
 * Primitives only: ids, enums, counts. Never whole domain objects, emails, tokens, Auth0 ids, SQL,
 * stack text or free-form user content.
 */
export type NotificationFields = Record<string, string | number | boolean | null | undefined>;

export interface ServerNotification {
  type: NotificationType;
  /** Static text (no user data): it goes into the message header. */
  title: string;
  fields?: NotificationFields;
  /** What makes two alerts "the same" for dedupe. Defaults to the type plus all fields. */
  fingerprint?: string;
}
