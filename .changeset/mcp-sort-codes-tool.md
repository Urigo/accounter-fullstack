---
'@accounter/mcp-server': minor
---

Add `accounter_list_sort_codes` to the MCP connector.

The sort code (kod miyun) is the chart-of-accounts grouping every financial report buckets by —
revenue, cost of sales, research and development, marketing, financial expenses. The connector's
glossary already told the model that a profit-and-loss shaped question groups by sort code rather
than by entity name, and tax-category rows already carried their own `sortCode` as `{ key, name }`,
but nothing enumerated the groupings themselves. A model could read a code off a row it happened to
hold; it could not learn which buckets exist, or that a key seen elsewhere has a name at all.

The new read-only tool returns `{ id, key, name, ownerId, defaultIrsCode }`, filtered by `keys`,
`nameContains` and the usual `memberBusinessIds`. `defaultIrsCode` comes along because this is the
only place it is defined: an entity's own `irsCode` overrides it, so without the default there is no
way to tell a deliberate override from an inherited code. `name` stays `null` for a code created
without one rather than becoming an empty string, and an unnamed code is excluded from a name search
instead of matching every needle.

Rows are ordered by numeric `key`, tie-broken by `ownerId`, rather than by the name-then-id order
the other lookups use: a sort code *is* its number, reports group by ranges of codes, and the name
is nullable — sorting by it would scatter the ranges. Upstream's per-owner
`allSortCodesByBusiness(ownerId:)` is deliberately not used, so a multi-membership scope stays a
single query; scoping is the same defense-in-depth owner filter `accounter_list_clients` applies on
top of RLS. The glossary's `sort-code` and `irs-code` entries now point at the tool, and it is
registered directly after `accounter_list_tax_categories` — where the model first meets a
`sortCode.key`.
