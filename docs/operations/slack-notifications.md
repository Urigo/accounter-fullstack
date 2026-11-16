# Slack Notifications

The server can post to two Slack channels through
[incoming webhooks](https://api.slack.com/messaging/webhooks):

- **Alerts:** unexpected failures. Examples: the server crashed, a scheduled job failed, the DB pool
  is saturated, a resolver hit an internal error, an email ingestion was quarantined.
- **Events:** business events, such as a tenant was created or an invitation was accepted.

Both are optional. Each one is configured on its own, and the server runs the same without them.

> **Status:** the notifier is in place, but nothing sends notifications yet. The hook points for
> each event and alert land in follow-up PRs, which will also add the event catalog to this page.
> You can set the variables up now and check them with `notify:test`.

## Create the webhooks

1. Go to [api.slack.com/apps](https://api.slack.com/apps). Create an app (_From scratch_, in your
   workspace) or open an existing one.
2. Open **Incoming Webhooks**, switch **Activate Incoming Webhooks** on, then click **Add New
   Webhook to Workspace**.
3. Pick the alerts channel and authorize. Copy the URL. It looks like
   `https://hooks.slack.com/services/T…/B…/…`.
4. Repeat for the events channel.

Each webhook URL is a credential: anyone who has it can post to that channel. Store it as a secret,
and never commit it or paste it into an issue. You can give both variables the same URL to send
everything to one channel. The two channels then share one delivery queue.

## Variables

| Variable                            | Default | Accepted values                                                      | Effect                                                      |
| ----------------------------------- | ------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| `SLACK_ALERTS_WEBHOOK_URL`          | unset   | `https://hooks.slack.com/services/…`                                 | Turns on the alerts channel.                                |
| `SLACK_EVENTS_WEBHOOK_URL`          | unset   | `https://hooks.slack.com/services/…`                                 | Turns on the events channel.                                |
| `SLACK_ALERT_MENTION`               | unset   | `<!here>`, `<!channel>`, `<@U…>` (a user), `<!subteam^S…>` (a group) | Prefixed to every alert, so it pings. Events never mention. |
| `SLACK_ALERT_DEDUPE_WINDOW_SECONDS` | `300`   | A whole number of seconds                                            | Identical alerts within the window are sent only once.      |
| `SLACK_ALLOW_NON_PROD`              | `0`     | `0` or `1`                                                           | `1` turns Slack on in `development` / `test` (see below).   |

- **Webhook URLs:** must use `https`, the host `hooks.slack.com` and a path that starts with
  `/services/`. Anything else, such as `http`, another host or a workflow URL, is rejected.
- **Mentions:**
  - **A user (`<@U…>`):** open their Slack profile, then **⋮ → Copy member ID**.
  - **A user group (`<!subteam^S…>`):** open the group under **People → User groups** and use **⋮ →
    Copy group ID**, or look it up with the `usergroups.list` API. The ID starts with `S`.
  - Other forms are rejected, including plain `@name`.
- **Empty values:** a variable set to an empty string counts as unset.

### Where to set them

- **Production (Render):** add the variables in the server's **Environment** settings, then
  redeploy. The server reads them once, at startup.
- **Locally:** add them to `packages/server/.env` (git-ignored), together with
  `SLACK_ALLOW_NON_PROD=1`. Point them at a test channel, not the production ones.

Slack stays **off** when the environment label is `development`, `dev`, `test` or `local`, unless
`SLACK_ALLOW_NON_PROD=1`. The label is `OTEL_DEPLOYMENT_ENV`, or `NODE_ENV` when that is unset. This
keeps local runs and test suites from posting to real channels.

### Invalid values never stop the server

Slack configuration is fail-open, unlike the rest of the environment, which stops startup when a
value is invalid:

- **An invalid variable** is ignored. One `warn` line is logged at startup, and it names the
  variable without repeating the value.
- **One webhook set:** the other channel is disabled. A warning lists the notification types that
  will not be delivered.
- **No valid webhook:** notifications are a no-op.

## Check the setup

Send a test message to each configured channel. This works in any environment, because the
development / test switch does not apply to this script:

```bash
yarn workspace @accounter/server notify:test        # both channels
yarn workspace @accounter/server notify:test alerts # or just one
```

It prints one line per channel, such as `alerts: delivered` or
`events: FAILED (see the warning line above)`. It exits with `1` if no valid webhook is configured
or a send failed. It never prints the URLs. It loads the full server environment, so the usual
required variables (Postgres, `CREDENTIALS_ENCRYPTION_KEY`) must be set too.

At server startup, look for these lines:

| `msg`                          | Level  | Meaning                                                                       |
| ------------------------------ | ------ | ----------------------------------------------------------------------------- |
| `slack-notifications-enabled`  | `info` | Slack is on. `channels` lists the active ones.                                |
| `slack-notifications-disabled` | `info` | Webhooks are set, but the environment label is development / test (`reason`). |
| `slack-config-invalid`         | `warn` | A variable was ignored. `problem` says which and why.                         |
| `slack-channel-disabled`       | `warn` | One channel has no webhook. `types` lists what it will not deliver.           |

## Delivery

- **Queue:**
  - Messages are sent in the background, one at a time per webhook, at least 1.1 s apart.
  - Each request has a 3 s timeout.
  - A notification never blocks or fails the code that sent it.
- **Retries:**
  - A `429` is retried once after `Retry-After`, capped at 5 s.
  - A `5xx`, network error or timeout is retried once after 1 s.
  - A `400` (Slack rejected the formatted blocks) is resent once as plain text.
- **Dedupe:**
  - An alert identical to one sent within `SLACK_ALERT_DEDUPE_WINDOW_SECONDS` is not sent.
  - The next copy sent after the window shows "N similar suppressed".
  - Events are never deduped.
- **Alert cap:** at most 20 alerts per minute in total. The next one is replaced by a single **Alert
  storm** message, and the rest of that minute's alerts are dropped.
- **Dedupe scope:** dedupe and the cap work per process. Production runs a single instance on
  Render. With several replicas, each one would send its own copy.

### Troubleshooting

| `msg`                        | Meaning                                                                                    | What to do                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `slack-notification-failed`  | A send failed after its retry (`status` / `reason`).                                       | Usually transient. If it repeats, check Slack's status and run `notify:test`.             |
| `slack-webhook-rejected`     | Slack answered `403`, `404` or `410`: the webhook was revoked or its channel was archived. | Create a new webhook, update the variable and redeploy. Sends to it pause for 15 minutes. |
| `slack-notification-dropped` | The webhook's queue was full (100 messages) and newer messages were dropped.               | Look for the burst of failures in the logs. It is logged once per overflow.               |

## Rotate or remove a webhook

1. Create the new webhook (see above), or, to remove it, skip to step 3.
2. Set the variable to the new URL.
3. In the Slack app's **Incoming Webhooks** page, remove the old webhook so its URL stops working.
4. Redeploy. To turn a channel off, unset its variable and redeploy.

## Security

- **Where the URL goes:** the server keeps the URL out of the GraphQL context and out of traces
  (calls to `hooks.slack.com` are not traced). A webhook URL that reaches a log line is replaced
  with `[slack-webhook]`.
- **Message content:** messages carry ids, enums and counts only. They never include emails, tokens,
  Auth0 ids, SQL or user-supplied text. Every value is escaped, so it cannot trigger a mention or a
  link.
- **What Slack can't report:** Slack cannot report a process that is killed (OOM, `SIGKILL`), a hung
  event loop, or a failed deploy. Pair it with an external uptime check on `/health`.
