import { describe, expect, it } from 'vitest';
import { parseSlackConfig } from '../config.js';
import { WEBHOOK } from './helpers.js';

describe('parseSlackConfig', () => {
  it('reads valid settings, with the URLs wrapped as secrets', () => {
    const config = parseSlackConfig({
      SLACK_ALERTS_WEBHOOK_URL: WEBHOOK,
      SLACK_EVENTS_WEBHOOK_URL: ` ${WEBHOOK} `,
      SLACK_ALERT_MENTION: '<!subteam^S0123ABC>',
      SLACK_ALERT_DEDUPE_WINDOW_SECONDS: '60',
      SLACK_ALLOW_NON_PROD: '1',
    });
    expect(config.problems).toEqual([]);
    expect(config.alertsWebhookUrl?.reveal()).toBe(WEBHOOK);
    expect(config.eventsWebhookUrl?.reveal()).toBe(WEBHOOK);
    expect(config).toMatchObject({
      alertMention: '<!subteam^S0123ABC>',
      dedupeWindowSeconds: 60,
      allowNonProd: true,
    });
    expect(JSON.stringify(config)).not.toContain('hooks.slack.com');
  });

  it('defaults to off when nothing is set (empty strings count as unset)', () => {
    expect(parseSlackConfig({ SLACK_ALERTS_WEBHOOK_URL: '' })).toEqual({
      alertsWebhookUrl: undefined,
      eventsWebhookUrl: undefined,
      alertMention: undefined,
      dedupeWindowSeconds: 300,
      allowNonProd: false,
      problems: [],
    });
  });

  it.each([
    ['non-https', WEBHOOK.replace('https:', 'http:')],
    ['another host', WEBHOOK.replace('hooks.slack.com', 'hooks.slack.com.evil.example')],
    ['another path', WEBHOOK.replace('/services/', '/workflows/')],
    ['not a URL', 'nope'],
  ])('drops an invalid webhook (%s) with a problem that does not echo it', (_, value) => {
    const config = parseSlackConfig({ SLACK_ALERTS_WEBHOOK_URL: value });
    expect(config.alertsWebhookUrl).toBeUndefined();
    expect(config.problems).toHaveLength(1);
    expect(config.problems[0]).toMatch(/^SLACK_ALERTS_WEBHOOK_URL /);
    expect(config.problems[0]).not.toContain(value);
  });

  it('drops a bad mention, window or flag, keeping the rest', () => {
    const config = parseSlackConfig({
      SLACK_ALERTS_WEBHOOK_URL: WEBHOOK,
      SLACK_ALERT_MENTION: '<https://evil|x>',
      SLACK_ALERT_DEDUPE_WINDOW_SECONDS: '-5',
      SLACK_ALLOW_NON_PROD: 'yes',
    });
    expect(config.alertsWebhookUrl).toBeDefined();
    expect(config.alertMention).toBeUndefined();
    expect(config.dedupeWindowSeconds).toBe(300);
    expect(config.allowNonProd).toBe(false);
    expect(config.problems.map(p => p.split(' ')[0])).toEqual([
      'SLACK_ALERT_MENTION',
      'SLACK_ALERT_DEDUPE_WINDOW_SECONDS',
      'SLACK_ALLOW_NON_PROD',
    ]);
  });
});
