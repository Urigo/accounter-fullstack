/**
 * Sends one test message to each configured Slack webhook and reports the outcome.
 *
 *   yarn workspace @accounter/server notify:test [alerts|events|all]
 *
 * Ignores the development / test gate (that is the point of a manual check), but never prints the
 * webhook URLs.
 */
import { env, slackEnv } from '../environment.js';
import { SlackNotifier } from '../observability/notifications/notifier.js';
import type { Channel } from '../observability/notifications/types.js';

const TYPE_FOR_CHANNEL = {
  alerts: 'server.crashed',
  events: 'tenant.created',
} as const satisfies Record<Channel, string>;

async function main(): Promise<number> {
  const arg = process.argv[2] ?? 'all';
  if (arg !== 'alerts' && arg !== 'events' && arg !== 'all') {
    console.error(`Unknown channel "${arg}". Use alerts, events or all.`);
    return 1;
  }

  for (const problem of slackEnv.problems) {
    console.warn(`warning: ${problem}`);
  }

  const notifier = new SlackNotifier(slackEnv, {
    envLabel: env.otel.deploymentEnv,
    release: process.env.RELEASE,
  });
  const channels = notifier.channels.filter(channel => arg === 'all' || channel === arg);
  if (channels.length === 0) {
    console.error(`No valid Slack webhook configured for "${arg}".`);
    return 1;
  }

  let failed = false;
  // Stats are cumulative (and shared when both variables hold the same URL): compare deltas.
  let before = await notifier.flush(0);
  for (const channel of channels) {
    notifier.sendTo(channel, {
      type: TYPE_FOR_CHANNEL[channel],
      title: 'Test notification (notify:test)',
      fields: { channel, env: env.otel.deploymentEnv, release: process.env.RELEASE },
      fingerprint: `notify-test:${channel}`,
    });
    const after = await notifier.flush(15_000);
    const ok = after.sent === before.sent + 1;
    before = after;
    failed ||= !ok;
    console.log(`${channel}: ${ok ? 'delivered' : 'FAILED (see the warning line above)'}`);
  }
  return failed ? 1 : 0;
}

main().then(
  code => process.exit(code),
  error => {
    console.error(error instanceof Error ? error.name : 'notify:test failed');
    process.exit(1);
  },
);
