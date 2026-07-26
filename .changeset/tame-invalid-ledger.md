---
'@accounter/server': patch
---

- Short-circuit `ChargeMetadata.invalidLedger` to `VALID` for empty common-type charges (no
  transactions, documents, ledger records or misc expenses), skipping full ledger generation. The
  emptiness probe reads counts only — from the enriched charge row when available, otherwise from
  the existing per-charge loaders.
- Memoized derived charge types per request in `getChargeType`, so a null-typed charge resolves its
  type once instead of on every `__isTypeOf` probe, validation and suggestion call.
- `isChargeLocked` now passes the charge row (rather than its id) to the meta helpers, letting
  enriched rows skip redundant child-table loads.
