import zod from 'zod';
import { Secret } from './secret.js';

export interface SlackConfig {
  alertsWebhookUrl?: Secret;
  eventsWebhookUrl?: Secret;
  /** A Slack mention token (`<!here>`, `<@U…>`, `<!subteam^S…>`) prepended to alerts. */
  alertMention?: string;
  dedupeWindowSeconds: number;
  allowNonProd: boolean;
  /** One message per variable that was set but invalid (and is therefore ignored). */
  problems: string[];
}

// Messages are static on purpose: zod would otherwise echo the (secret) input back.
const WebhookUrl = zod.string().refine(
  value => {
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.hostname === 'hooks.slack.com' &&
        url.pathname.startsWith('/services/') &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  },
  {
    message: 'must be a Slack incoming webhook URL (https, host hooks.slack.com, path /services/…)',
  },
);

const Mention = zod.string().regex(/^<(!subteam\^S[A-Z0-9]+|@[UW][A-Z0-9]+|!here|!channel)>$/, {
  message: 'must be one of <!here>, <!channel>, <@U…>, <!subteam^S…>',
});

const WindowSeconds = zod
  .string()
  .regex(/^\d+$/, { message: 'must be a whole number of seconds' })
  .transform(Number);

const Flag = zod.enum(['0', '1'], { message: 'must be "0" or "1"' });

/**
 * Parses the `SLACK_*` variables. Unlike the rest of the environment this is fail-open: Slack is
 * optional, so an invalid variable is dropped and reported in `problems` (logged as a warning at
 * startup) instead of stopping the server.
 */
export function parseSlackConfig(source: Record<string, string | undefined>): SlackConfig {
  const problems: string[] = [];

  function read<T>(name: string, schema: zod.ZodType<T>): T | undefined {
    const raw = source[name];
    if (raw === undefined || raw.trim() === '') {
      return undefined;
    }
    const parsed = schema.safeParse(raw.trim());
    if (parsed.success) {
      return parsed.data;
    }
    problems.push(`${name} ${parsed.error.issues[0]?.message ?? 'is invalid'}; it is ignored.`);
    return undefined;
  }

  const alerts = read('SLACK_ALERTS_WEBHOOK_URL', WebhookUrl);
  const events = read('SLACK_EVENTS_WEBHOOK_URL', WebhookUrl);

  return {
    alertsWebhookUrl: alerts ? new Secret(alerts) : undefined,
    eventsWebhookUrl: events ? new Secret(events) : undefined,
    alertMention: read('SLACK_ALERT_MENTION', Mention),
    dedupeWindowSeconds: read('SLACK_ALERT_DEDUPE_WINDOW_SECONDS', WindowSeconds) ?? 300,
    allowNonProd: read('SLACK_ALLOW_NON_PROD', Flag) === '1',
    problems,
  };
}
