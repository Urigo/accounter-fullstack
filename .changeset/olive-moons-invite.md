---
'@accounter/server': patch
'@accounter/mcp-server': patch
---

Fix document uploads failing at the final INSERT with "TenantAwareDBClient is already disposed"

Uploading a document through the MCP connector timed out and left the charge untouched, every time.
The mutation was running to completion server-side and dying on its last step: the caller's abort
disposed the request's DB client while the resolver was still working, so `insertDocuments` — after
a Drive download, a Cloudinary upload and an OCR pass — threw `TenantAwareDBClient is already
disposed`, and the follow-up field resolvers threw the same. Nothing was ever written, and the
connector reported the timeout as retryable, so each retry paid the full cost again.

Fixed at every layer it goes through:

- **Request lifecycle** — a caller hanging up no longer stops the operation this server is running.
  `dbCleanupPlugin` now *defers* disposal (`disposeWhenIdle`) while GraphQL execution is in flight,
  so the work finishes and writes, and the client is released at the end of execution.
- **Leak watchdog** — gains separate idle ceilings for a client whose operation is still executing
  (`POSTGRES_ACTIVE_CLIENT_MAX_IDLE_MS`, 15 min) and one whose caller already hung up
  (`POSTGRES_ABORTED_CLIENT_MAX_IDLE_MS`, 2.5 min — this is what bounds the deferral above). A
  request that goes minutes without a query because it is waiting on OCR is no longer mistaken for a
  leak.
- **Document ingestion** — `releaseIdleConnection` hands the pooled connection back before the
  download / Cloudinary / OCR stretch instead of holding it `idle in transaction` throughout, so
  those requests no longer sit in the pool (or in reach of `idle_in_transaction_session_timeout`)
  while they wait on an external API.
- **Google Drive** — every Drive call now has a 60s timeout (`fetch` has none by default, so an
  unanswered call pinned the request indefinitely), and Drive failures keep their reason in the
  message instead of collapsing to "Failed fetching files from Google Drive".
- **`batchUploadDocumentsFromUrls`** — a failing insert is reported per URL like every other failure
  in that resolver, rather than sinking the whole batch into one opaque GraphQL error.
- **MCP connector** — document uploads get their own budget, `GRAPHQL_UPSTREAM_LONG_TIMEOUT_MS`
  (default 5 min), instead of the 10s budget sized for a database read. A timed-out write is now
  reported as **not** retryable, with a message saying to check whether it took effect first —
  re-sending one that may still be in progress upstream risks duplicating it.
