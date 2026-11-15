---
'@accounter/server': patch
---

Server logs are single-line JSON records on stdout (part of #4872). See
`docs/operations/logging.md`.

- New `observability/log.ts`: `log(level, msg, fields)` writes `{"msg", "level", "time", …}` on one
  line, honouring `SERVER_LOG_LEVEL`, plus a `fatal` level that is always written. Every record has
  credential-named keys redacted, JWTs, `Bearer`/`Basic` credentials, Slack webhook URLs and emails
  scrubbed from its strings, strings capped at 2000 characters and error messages at 500.
  `serializeError` keeps an allowlist of fields (a `GraphQLError`'s `extensions` never get past
  `code`). A failed stdout write (`EPIPE`) is swallowed, as with `console.*`. `setLogWriter` and
  `setLogContextProvider` are seams for another sink and for ambient request context.
- Yoga and Hive log through it (`createYogaLogger`), so their lines are JSON too.
- The startup, shutdown and pool idle-error lines and the scheduled-job logger use it:
  `server-shutting-down` is `fatal` after a crash.
