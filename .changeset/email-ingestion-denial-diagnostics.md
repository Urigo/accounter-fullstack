---
'@accounter/email-ingestion-gateway': patch
---

Log the upstream error on a control/ingest denial instead of discarding it.

`ServerClient.requestControl` / `requestIngest` returned a failure carrying both a `reason` code and
a `message` holding the actual error string, and `orchestrator.ts` logged only the reason. The one
field that distinguishes connection refused from a 4xx from a GraphQL error the server returned was
the one not logged.

Diagnosing the incident in #4344 therefore meant reconstructing which branch was taken from
`durationMs` alone — comparing it against the retry policy's fixed 300 ms backoff floor to prove the
failure had not been retried, and so that the server had answered rather than refused. That should
be a single glance at a log line.

`orchestrate:control:denied` and `orchestrate:ingest:failed` now carry:

- `upstreamMessage` — the error text. Named `upstreamMessage` rather than `message` because `log()`
  spreads `fields` and then sets its own `message`, so a field by that name is silently overwritten.
- `status` — the HTTP status when the server answered, so 200-with-GraphQL-errors is distinguishable
  from a 4xx and from a transport failure without parsing strings.
- `attempts` — the actual attempt count from `withRetry`, which removes the need to infer it from
  timing.

`String(err)` on a `graphql-request` `ClientError` embeds the whole response body, which can be a
multi-kilobyte HTML error page from a proxy. A `ClientError` is now reduced to its status plus the
GraphQL error messages, and every error string is truncated at 500 characters.

Also silences the dotenv banner printed on every gateway boot:

```
failed to load /app/packages/email-ingestion-gateway/.env ENOENT: no such file or directory
◇ injected env (0) from .env
```

In the deployed container the environment comes from the platform and there is no `.env`, so this is
expected — but it reads as an error at the top of an incident log. The old gate
(`debug: process.env.RELEASE ? false : true`) depended on `RELEASE`, which is not actually set in
the deployment; dotenv diagnostics are now opt-in via `DOTENV_DEBUG=1`.
