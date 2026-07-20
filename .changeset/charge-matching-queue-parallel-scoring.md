---
"@accounter/server": patch
---

Score charge-match candidates in parallel. `findMatches` previously scored candidates in a
sequential `await` loop, which serialized the per-candidate client and issued-document-status
DataLoader lookups inside `scoreMatch` into an N+1. Scoring now runs with `Promise.all` so those
loads batch. Ordering is unaffected (results are sorted afterwards), so match output is unchanged.
