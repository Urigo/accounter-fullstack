---
"@accounter/server": minor
"@accounter/client": minor
---

Add the Charge Matching Review Screen: a guided side-by-side UI for pairing document-based and
transaction-based charges and merging them one by one.

- Server: new `chargesAwaitingMatchQueue` GraphQL query that returns a paginated queue of unmatched
  base charges with on-the-fly match suggestions, filterable by business, date range and mode
  (`DOC_BASE`/`TRANSACTION_BASE`) and sortable `BY_DATE` or `BY_SCORE` (score evaluation capped at
  the 100 most recent unmatched charges).
- Client: new `/charges/matching` screen with a filter/sort header, collapsible queue sidebar with
  per-item pending/matched/skipped status, side-by-side base-vs-suggestion comparison cards,
  alternative-suggestion switching, and accept (merge) / skip actions.
