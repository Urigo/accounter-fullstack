---
'@accounter/server': patch
'@accounter/mcp-server': patch
---

Implement the `ChargeFilter` exclusion predicates, and expose them through the MCP charge tools.

`excludedBusinesses`, `excludedFinancialAccounts`, `excludedTags` and `excludedFreeText` were added
to the schema alongside the charges filter redesign so the client could send them, with the SQL
deliberately deferred. Until now `allCharges` accepted all four and silently ignored them — picking
"exclude" in the filter modal returned an unfiltered result with no indication the constraint had
been dropped. They now have real predicates.

`getChargesByFilters` already aggregates each charge's businesses, tags and accounts into arrays
before its closing `WHERE`, so the three entity exclusions are array **non**-overlap rather than the
`NOT EXISTS` the follow-up doc originally called for — a charge is dropped when any of its
businesses / tags / accounts appears in the exclusion list. Each is wrapped in `COALESCE`, because
those arrays come from `LEFT JOIN`s and `NULL && array` is `NULL`: without it, a tag exclusion would
have dropped every charge that has no tags at all.

`excludedFreeText` is a set-membership test. A new `excluded_matches` CTE mirrors the existing
`search_matches` across the same eight sources — charge description, transaction
description/reference, document description/remarks/serial, transaction and document amounts, and
counterparty names via transactions, creditor and debtor — and `filtered_charges` requires the charge
not to appear in it. Every branch requires the parameter to be non-null, the inverse of
`search_matches`, whose first branch deliberately passes everything through when `$freeText` is null.
A charge with no text never enters the set, so "does not mention X" keeps charges with no
description — the NULL-safety concern the follow-up doc raised does not arise, because nothing
negates an `ILIKE`. Thousands separators are stripped as they are for `freeText`, so excluding
`1,234.56` also excludes `1234.56`.

Include and exclude are separate predicates, `AND`ed, so a value named in both lists is excluded —
exclude wins. The client's tri-state cannot produce that, but the API allows it.

All four are removed from the MCP server's `UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS` and exposed on
`accounter_get_charges` and `accounter_search_charges`, which makes "mentions X but not Y" and
"everything except these accounts" expressible by a model for the first time. `unbalanced` and
`businessTrip` stay on that list — they remain accepted-but-ignored.

Both text predicates are now normalized at the provider: a value that is empty once trimmed becomes
`NULL` rather than reaching SQL as an empty string, which would degrade to `ILIKE '%%'`. As an
exclusion that would have dropped nearly every charge — reachable through the MCP tools, whose
`.min(2)` accepted two spaces — and the same latent bug existed on the pre-existing `freeText` path,
where it instead drops the charges whose description is `NULL`. The mapping layer and the MCP input
schema now reject whitespace-only text as well, so it fails at the edge. The numeric variants are
only set when the term contains a digit, since those branches compare against `amount::TEXT` and a
digit-free term can never match one.

One editing hazard found and documented: **pgTyped silently truncates the generated parameter list at
the first `--` comment inside the closing `WHERE` clause.** An explanatory comment placed there cut
`IGetChargesByFiltersParams` from 30-odd entries to ten, taking `tags`, `accountIds` and `sortColumn`
with it. Comments inside CTEs are unaffected. There is now a note above the `sql` template, and
`docs/charges-filters/backend-followup.md` records it.
