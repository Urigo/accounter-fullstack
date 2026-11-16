import type { ServerNotification } from './types.js';

export interface SlackText {
  type: 'plain_text' | 'mrkdwn';
  text: string;
}

export type SlackBlock =
  | { type: 'header'; text: SlackText }
  | { type: 'section'; text?: SlackText; fields?: SlackText[] }
  | { type: 'context'; elements: SlackText[] };

export interface SlackMessage {
  /** Fallback for notifications and clients that do not render blocks. */
  text: string;
  blocks: SlackBlock[];
}

export interface FormatOptions {
  envLabel: string;
  release?: string;
  /** Validated mention token; the only raw `<…>` a message may contain. */
  mention?: string;
  /** How many identical alerts were suppressed since the last one sent. */
  suppressed?: number;
}

const HEADER_MAX = 150;
const MAX_FIELDS = 10;
const KEY_MAX = 50;
// Escaping can grow a value up to 5x (`&` → `&amp;`); 300 x 5 stays under Slack's 2000-char field.
const VALUE_MAX = 300;

/**
 * Escapes the three characters Slack's mrkdwn treats as control characters, so dynamic values
 * cannot form links or mentions (`<!channel>`, `<https://evil|x>`).
 */
export function escapeMrkdwn(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Truncate first, then escape, so a cut never splits an entity. */
function safe(text: string, max: number): string {
  return escapeMrkdwn(truncate(text, max).replaceAll('```', "'''"));
}

export function formatSlackMessage(
  notification: ServerNotification,
  options: FormatOptions,
): SlackMessage {
  const title = truncate(`[${options.envLabel}] ${notification.title}`, HEADER_MAX);
  const blocks: SlackBlock[] = [{ type: 'header', text: { type: 'plain_text', text: title } }];

  if (options.mention) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: options.mention } });
  }

  const fields = Object.entries(notification.fields ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, MAX_FIELDS)
    .map(([key, value]): SlackText => ({
      type: 'mrkdwn',
      text: `*${safe(key, KEY_MAX)}*\n${safe(String(value), VALUE_MAX)}`,
    }));
  if (fields.length > 0) {
    blocks.push({ type: 'section', fields });
  }

  const context = [`\`${notification.type}\``];
  if (options.release) {
    context.push(`release ${safe(options.release, 64)}`);
  }
  if (options.suppressed) {
    context.push(`${options.suppressed} similar suppressed`);
  }
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: context.join(' · ') }] });

  const text = escapeMrkdwn(title);
  return { text: options.mention ? `${options.mention} ${text}` : text, blocks };
}
