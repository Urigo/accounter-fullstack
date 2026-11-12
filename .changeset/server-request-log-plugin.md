---
'@accounter/server': patch
---

One structured line per GraphQL operation, and its errors logged once
(part of #4872).

- Every GraphQL operation writes one `graphql-operation` line: operation name and type, duration,
  error count and codes, whether the caller aborted, the internal user and business IDs, the
  request ID and the correlation ID. Operations rejected before execution (parse, validation,
  context errors) are included, and a `@defer` operation is logged when its stream ends.
- Errors an execution returns are logged as `graphql-error` lines before Yoga masks them, with the
  operation name, code and path. An unexpected error (one Yoga masks, or one thrown on purpose with
  `INTERNAL_SERVER_ERROR`; `isUnexpectedGraphQLError`) is logged at `error` with its stack and
  `cause` chain, the rest at `warn`. Identical errors are logged once per operation with a count,
  and Yoga no longer logs an unexpected error a second time.
- `AuthContextProvider` records the internal user ID and the business the operation runs as.
