---
'@accounter/server': patch
---

- Update charge meta helpers to accept either a charge id or a loaded charge row (`ChargeRef`) and
  use an enriched fast path when available.
- Short-circuit multiple GraphQL field resolvers to use precomputed aggregates already present on
  enriched charge rows.
- Extend the filters SQL query to return additional precomputed aggregates and prime the
  charge-by-id DataLoader with enriched rows.
