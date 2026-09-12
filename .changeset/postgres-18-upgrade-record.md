---
'@accounter/server': patch
---

Add `yarn db:reindex-trgm` and record the Postgres 16 → 18 production upgrade.

`scripts/reindex-trigram-indexes.ts` rebuilds every GIN trigram index, always `CONCURRENTLY`.
It discovers the indexes from `pg_index`/`pg_opclass` at runtime rather than from a hardcoded
list — the set grew from six to seven when `idx_financial_entities_name_trgm` was added, and a
copied list silently skips the new one. `CONCURRENTLY` is not optional: only that seventh index
was originally built concurrently, so a plain `REINDEX` would take `ACCESS EXCLUSIVE` on
`charges`, `transactions` and `documents`.

Also reports the collation provider (which decides whether the reindex is required at all),
detects invalid indexes and `_ccnew` leftovers from a failed rebuild, disables
`statement_timeout` for the session, and re-reads the catalog afterwards rather than trusting
the absence of errors.

Docs-only otherwise: the upgrade audit, the runbook with its execution record, and the
before/after catalog snapshots.
