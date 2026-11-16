---
'@accounter/server': patch
---

Add the Slack notification core: an optional, fail-open notifier for two incoming webhooks
(`SLACK_ALERTS_WEBHOOK_URL`, `SLACK_EVENTS_WEBHOOK_URL`) with mrkdwn escaping, a bounded per-webhook
queue, alert dedupe and a `notify:test` script. Outgoing Slack calls are no longer traced. Nothing
sends notifications yet.
