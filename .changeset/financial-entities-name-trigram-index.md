---
'@accounter/server': patch
---

Add a GIN trigram index on `accounter_schema.financial_entities.name`.

The charge free-text filter matches counterparty names with a leading-wildcard `ILIKE '%…%'` in six
branches of the `search_matches` / `excluded_matches` CTEs. The only index on that column was a
plain btree (`financial_entities_name_index`), which cannot serve `'%…%'` patterns, so every one of
those branches fell back to a sequential scan of `financial_entities` — the one hot search column
the original `pg_trgm` work missed.

The new `idx_financial_entities_name_trgm` is built with `CREATE INDEX CONCURRENTLY`, so it does not
lock `financial_entities` against writes while it builds. The existing btree is kept: it still
serves equality, prefix and ordering lookups. Query behaviour is unchanged — this is a pure index
addition.
