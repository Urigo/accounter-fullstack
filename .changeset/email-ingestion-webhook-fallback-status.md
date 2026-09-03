---
'@accounter/email-ingestion-gateway': patch
---

Return non-2xx from `/webhook` when orchestration leaves no durable record, so the Worker's
`FALLBACK_EMAIL` path actually fires.

`worker.ts` has a designed no-loss path: if the gateway rejects the request, forward the email to
the legacy mailbox rather than dropping it.

```ts
if (!response.ok) {
  if (env.FALLBACK_EMAIL) {
    await message.forward(env.FALLBACK_EMAIL)
    return
  }
  throw new Error('Gateway returned status ' + response.status)
}
```

But `webhook.ts` answered `202` even when orchestration failed, and `202` satisfies `response.ok` —
so the Worker treated a total-loss outcome as success and the fallback branch was unreachable for
every orchestration failure. The `failed: true` flag in the body was never read. This is one of the
four gaps that turned a sub-second upstream blip into five permanently lost emails (#4344).

The status is now decided per reason code rather than by outcome shape:

- `TRANSIENT_UPSTREAM`, `UPSTREAM_ERROR`, `TIMEOUT` — control never granted, so there is no resolved
  tenant, and `email_ingestion_quarantine` requires one. Nothing was recorded and nothing can be.
  **503**, so the Worker forwards.
- `UNKNOWN_ALIAS` — the mail is undeliverable to any tenant. Forwarding it to a human beats dropping
  it. **503**.
- `GRANT_INVALID` and the other post-grant failures — these _are_ recorded server-side
  (quarantine/audit rows exist) and are reprocessable, so **202** stays correct; forwarding them
  would duplicate work.

Shadow mode (`EMAIL_INGESTION_SHADOW_MODE=1`) responds `202` before orchestration runs, so it cannot
participate and is left as-is.

The mapping is an exported `statusForOrchestrationFailure(reason)` with a test per reason code, and
`worker-pipe.integration.test.ts` gains an end-to-end case asserting that a control call returning a
GraphQL error drives the Worker down the `FALLBACK_EMAIL` branch.
