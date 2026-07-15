---
"@accounter/client": patch
---

Reduce the "blinking" on the All Charges screen when data is refetched. Applying the same insights as
the bank deposits fix:

- The loading spinner now only replaces the table on the initial load (`fetching && !data`) instead
  of on every background refetch, so changing filters or pages no longer blanks out the whole table —
  the current results stay visible until the new data arrives.
- The charge nodes are wrapped in the shared `useStableValue` hook, so the table and its rows keep a
  stable reference and only re-render (and reset per-row state) when the data actually changed.
- Filter refetches are issued with `{ requestPolicy: 'network-only' }` to make the intent explicit.
- The filters-bar effect now depends only on the page count it actually consumes, instead of the
  whole query result and `fetching`, so it isn't rebuilt on every refetch.

Per-charge edits were already scoped to their own row query and are unaffected.
