# Charges filter — exclusion predicates

> **Status: implemented.** The four `excluded*` fields were added to the `ChargeFilter` typeDefs
> ahead of the SQL and spent one release accepted-but-ignored. They now have real predicates and are
> exposed through the MCP charge tools. This document records how they behave; the outstanding items
> are in [Still open](#still-open).

| Field                       | Type        | Positive twin         | Predicate                                 |
| --------------------------- | ----------- | --------------------- | ----------------------------------------- |
| `excludedBusinesses`        | `[UUID!]`   | `byBusinesses`        | `business_array` non-overlap              |
| `excludedFinancialAccounts` | `[UUID!]`   | `byFinancialAccounts` | `account_array` non-overlap               |
| `excludedTags`              | `[String!]` | `byTags`              | `tags` non-overlap                        |
| `excludedFreeText`          | `String`    | `freeText`            | not present in the `excluded_matches` CTE |

## How it works

`getChargesByFilters`
([`charges.provider.ts`](../../packages/server/src/modules/charges/providers/charges.provider.ts))
already aggregates each charge's businesses, tags and accounts into arrays before the closing
`WHERE`, so the three entity exclusions are array **non**-overlap rather than the `NOT EXISTS` this
document originally called for:

```sql
AND ($isExcludedTags = 0 OR NOT COALESCE(ec.tags && $excludedTags, FALSE))
```

The `COALESCE` matters. Those arrays come from `LEFT JOIN`s, and `NULL && array` is `NULL`, not
`FALSE` — without it, every charge that has _no_ tags at all would be dropped from a tag-exclusion
query, which is the opposite of what the filter means.

Because the arrays hold the charge's full set, this gives the right semantics directly: a charge is
dropped when **any** of its businesses / tags / accounts appears in the exclusion list. (The concern
about a plain `NOT IN` matching on a second joined row does not arise — there is no per-row join
left at that point.)

`excludedFreeText` is a set-membership test instead. `excluded_matches` mirrors the existing
`search_matches` CTE — the same eight sources: charge description, transaction
description/reference, document description/remarks/serial, transaction and document amounts, and
counterparty names via transactions, creditor and debtor. Every branch requires the parameter to be
`NOT NULL`, the inverse of `search_matches`, whose first branch deliberately passes every charge
through when `$freeText` is `NULL`. `filtered_charges` then requires the charge not to be in that
set.

This also settles the NULL question the original draft raised: a charge whose columns are all `NULL`
never enters `excluded_matches`, so **"does not mention X" keeps charges with no text at all** — no
`COALESCE` needed, because the test is set membership rather than a negated `ILIKE`.

`excludedFreeText` gets the same thousands-separator stripping as `freeText`
(`excludedFreeTextNumeric`), so excluding `1,234.56` also excludes `1234.56`.

## Empty search text

An empty string is not `NULL` in SQL, so it survives the query's `IS NOT NULL` guards and degrades
to `ILIKE '%%'`. As an exclusion that drops nearly every charge; as a positive filter it drops the
opposite set — the charges whose description is `NULL`, since they fail an `ILIKE` every other row
passes. A whitespace-only input trims to exactly that.

`ChargesProvider.getChargesByFilters` normalizes both `freeText` and `excludedFreeText` to `NULL`
when they are empty after trimming. That is deliberately at the provider rather than any one caller
— several resolvers build these params independently. The GraphQL mapping layer and the MCP input
schema reject it too, so it fails at the edge rather than silently becoming a no-op.

The numeric variants (`freeTextNumeric`, `excludedFreeTextNumeric`) are only set when the term
contains a digit: those branches compare against `amount::TEXT`, so a digit-free term cannot match
one and only costs a scan.

## Precedence

Include and exclude are separate predicates, `AND`ed. A value named in both lists is therefore
**excluded** — exclude wins. The client's tri-state cannot produce that, but the API allows it and
`allCharges` accepts it.

## Editing note

pgTyped **silently truncates the generated parameter list at the first `--` comment inside the
closing `WHERE` clause**, dropping every parameter after it. This surfaced while adding these
predicates: an explanatory comment there cut `IGetChargesByFiltersParams` down to ten entries and
took `tags`, `accountIds`, `sortColumn` and the rest with it. Comments inside CTEs are fine. Keep
explanation for that clause in TypeScript, above the `sql` template.

## Coverage

- [`all-charges-filters.test.ts`](../../packages/server/src/modules/charges/resolvers/__tests__/all-charges-filters.test.ts)
  — each field reaching its provider parameter, free-text normalisation, and independence from its
  positive twin.
- [`charge-filter-exclusions.test.ts`](../../packages/mcp-server/src/tools/__tests__/charge-filter-exclusions.test.ts)
  — the MCP input shape and `buildChargeFilters` forwarding, including empty-array handling.
- [`schema-contract.test.ts`](../../packages/mcp-server/src/tools/__tests__/schema-contract.test.ts)
  — enforces, in both directions, that a `ChargeFilter` field is either exposed by the charge tools
  or explicitly listed as unsupported.

## Still open

- **No DB-level integration test.** The predicates are covered at the mapping layer only; the SQL
  itself is exercised by hand. A DB-backed test per field — a charge that should be dropped, one
  that should survive, one matching both lists, and a `NULL`-description charge for
  `excludedFreeText` — belongs in the integration project.
- **Query cost.** `excluded_matches` roughly doubles the trigram-scan surface of `search_matches`
  when an exclusion is active. It is guarded so the CTE is empty and the `NOT EXISTS` short-circuits
  when both text parameters are `NULL`, but the exclusion path has not been profiled against a large
  charge table.
- **`unbalanced` and `businessTrip`** remain accepted-but-ignored, and stay in
  `UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS`
  ([`charge-filters.ts`](../../packages/mcp-server/src/tools/charge-filters.ts)). They are the same
  class of problem this change fixed and are worth either implementing or dropping from the schema.
