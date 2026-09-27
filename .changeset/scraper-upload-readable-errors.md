---
'@accounter/server': patch
'@accounter/scraper-app': patch
---

Show a readable error when a scraper upload fails, instead of `Unexpected error.` followed by the
whole request payload.

A statement rejected inside an upload — a row-level security violation, a constraint, a bad value —
reached yoga as a plain error, which its default error masking replaced with `Unexpected error.`.
`graphql-request` then embedded the entire request, query and every transaction, in the message, so
the scraper task row showed kilobytes of JSON (twice, via the stack trace) and nothing about the
cause, which was only in the server log.

**Server.** Every scraper upload mutation now runs through `withScraperUploadErrors`, which turns a
Postgres error into a `GraphQLError` carrying the database message, the failing trigger function
and a code: `DB_PERMISSION_DENIED`, `DB_CONFLICT`, `DB_REFERENCE_MISSING`, `DB_INVALID_DATA`,
`DB_REJECTED`, or `SERVICE_UNAVAILABLE` for a dropped connection. The SQL statement from Postgres'
`where` context stays server-side, and any other error keeps its message out of the response. The
error is built with `createGraphQLError`, the factory yoga itself uses, and never sets
`originalError`, since yoga masks any error whose `originalError` is not a `GraphQLError`. Each failure
is logged once as a single line; the providers' own `console.error` + rethrow blocks are removed.
The Poalim securities uploads' missing-business-context error is now a `FORBIDDEN` `GraphQLError`,
so its message reaches the client too.

**Scraper app.** Upload failures become an `UploadError` with the server's message and supporting
details (code, hint, table, constraint), and none of the payload. The task row shows those details
in place of a stack trace. A rejected API key (HTTP 401/403) and an unreachable server get their own
messages.
