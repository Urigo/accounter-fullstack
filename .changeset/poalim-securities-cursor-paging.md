---
'@accounter/modern-poalim-scraper': patch
'@accounter/scraper-app': patch
---

Page Poalim securities executions with the bank's own cursor, and stop the scraper-app from
answering misrouted uploads with its SPA.

`getSecuritiesTransactions` used to detect a full 150-row response and re-request the window with its
ceiling pulled back to the oldest day that page reached. The endpoint actually returns an opaque
cursor at `Account.PageState`, so `fetchAllExecutions` now repeats the request with the date window
**unchanged**, passing the previous response's cursor as a `pageState` query param, and follows it
until it comes back null. Row counts no longer decide anything — a short page with a cursor keeps
paging and a long page without one stops. This removes the walk-back's blind spot, where more than
150 executions on a single day could not be paged past. The loop is bounded by a raised round cap and
stops early if the cursor ever repeats itself; either case reports a truncation, which is now
surfaced to `scraper-app` as a per-account warning instead of being dropped (the rows still upload,
since ingestion is idempotent).

The scraper-app's SPA fallback no longer catches API calls, websocket upgrades, or non-GET verbs.
`reply.sendFile` responds with a 200, so a mistyped URL — notably a vault `serverUrl` pointing at the
scraper-app itself rather than the Accounter server — used to return `index.html` with a 200 and
surface as `Invalid execution result: result is not object or array` out of graphql-request. Those
requests now get a plain 404. Relatedly, `/api/vault/test-connection` reported such a config as
healthy: it only checked the status code, and probed with `Authorization: Bearer` rather than the
`X-API-Key` header the upload client and the server actually use. It now sends the right header and
requires a parseable GraphQL result, naming the missing `/graphql` path when the endpoint answers
with something that is not JSON.
