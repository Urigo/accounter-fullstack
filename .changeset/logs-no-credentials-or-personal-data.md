---
'@accounter/green-invoice-graphql': patch
'@accounter/server': patch
---

Stop logging credentials and personal data:

- The Green Invoice Mesh client sets its transport log level from a new `GREEN_INVOICE_LOG_LEVEL`
  env var (`trace` | `debug` | `info` | `warn` | `error`, default `info`; an unknown value warns
  and falls back to `info`). The generic `DEBUG` / `LOG_LEVEL` no longer turn on the REST
  transport's request dumps (`Authorization: Bearer …` headers and response bodies). Adds
  `@graphql-hive/logger` as a dependency.
- The server's log level comes from a new, validated `SERVER_LOG_LEVEL` (`debug` | `info` | `warn` |
  `error`, default `info`; an unknown value fails startup). It is one setting for Yoga and Hive,
  which forwards its logs to Yoga's logger, and `DEBUG=1` no longer adds per-request debug lines.
- Recovery-reserve calculation no longer prints employee first names or reserve amounts.
- A rejected JWT logs only its jose `code` and `message`, never the claims; an expired one isn't
  logged.
- A failed document upload from a URL logs only the URL's host and the error class, and `Not a valid
  URL` no longer echoes the value.
- `formatFinancialIntAmount` rounds without warning, and the VAT report rounds its pre-VAT amounts
  before formatting them.
- Removed per-render `no image url` / `no file url` logs, and the `console.error`s ahead of
  accommodation `BusinessTripError`s. Updating a business that isn't a Green Invoice client no
  longer warns.
- `business(id)` for a missing business is a `NOT_FOUND` `GraphQLError`, instead of a masked
  `Unexpected error.`
