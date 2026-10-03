---
'@accounter/email-ingestion-gateway': patch
---

Add `replay:eml` to re-drive a captured `.eml` through the real ingestion pipeline.

When an inbound email fails before control grants, nothing durable is recorded anywhere — no charge,
no document, no quarantine row, no idempotency key — so there is nothing to reprocess server-side.
Recovering it means re-driving the raw MIME, and there was no tool for that: `inspect:eml` stops at
extraction, leaving only "re-send the email by hand" or hand-assembling a signed `curl` (computing
an HMAC over `` `${timestamp}.${rawBody}` `` and getting five headers right).

```bash
yarn workspace @accounter/email-ingestion-gateway replay:eml example-docs/lost.eml
```

The script signs the body exactly as `worker.ts` does and POSTs it to the gateway, so control →
treatment → ingest all run for real, then prints the response (`outcome`, `ingestId`, `reasonCode`,
`correlationId`). It defaults `x-cf-recipient` from the message's own `Delivered-To` /
`X-Original-To` / `To` and the received-at from its `Date` header — both overridable via
`--recipient` and `--received-at`, since the alias in the headers is not always the one that routed
the message and a replay should keep the real date in the charge description. `--gateway`,
`--message-id` and `--dry-run` round it out.

Safe to re-run: idempotency keys on the gateway-computed `rawMessageHash`, so a genuinely lost
message inserts cleanly and one that already landed comes back `DUPLICATE`. It refuses to send when
`CF_WEBHOOK_SECRET` is unset rather than producing a confusing `INVALID_AUTH`.

Documented in `TROUBLESHOOTING.md` as the recovery step, which previously explained how to diagnose
a lost email but not how to re-drive one.
