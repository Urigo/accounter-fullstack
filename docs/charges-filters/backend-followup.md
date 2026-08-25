# Charges filter — deferred backend work

The charges filter redesign added four fields to the `ChargeFilter` GraphQL input **in the typeDefs
only**, so the client could build and send them. The server currently **accepts and silently ignores
all four**: `allCharges` destructures `filters` field-by-field in
[`filtered-charges.helper.ts`](../../packages/server/src/modules/charges/helpers/filtered-charges.helper.ts),
so unknown keys never reach the provider and no predicate is applied.

This document collects the work needed to make them real. It is a follow-up task, not part of the
redesign PR.

| Field | Type | Positive twin |
| --- | --- | --- |
| `excludedBusinesses` | `[UUID!]` | `byBusinesses` |
| `excludedFinancialAccounts` | `[UUID!]` | `byFinancialAccounts` |
| `excludedTags` | `[String!]` | `byTags` |
| `excludedFreeText` | `String` | `freeText` |

Schema location:
[`packages/server/src/modules/charges/typeDefs/charges.graphql.ts`](../../packages/server/src/modules/charges/typeDefs/charges.graphql.ts)
(base `input ChargeFilter`).

## Current user-visible behaviour

The UI ships the exclude controls fully enabled — a per-option `+`/`−` flip on Financial Entities,
Financial Accounts and Tags, and a Contains/Excludes toggle on free text. Choosing "exclude" today
produces an **unfiltered** result with no indication that the constraint was dropped. This was a
deliberate call when the redesign shipped; it is the main reason to prioritise this work.

## What each field needs

All four follow the same three-step shape:

1. A new parameter on `ChargesProvider.getChargesByFilters`
   ([`charges.provider.ts`](../../packages/server/src/modules/charges/providers/charges.provider.ts)).
2. A SQL predicate, negating the same joins the positive twin already uses.
3. One wiring line in `filtered-charges.helper.ts`, next to its twin — e.g.
   `excludedBusinessIds: filters?.excludedBusinesses`.

### `excludedBusinesses` / `excludedFinancialAccounts`

Both twins filter through a join against the charge's transactions/documents. The negation must be
`NOT EXISTS` over that join rather than `NOT IN` over a joined column: with a plain `NOT IN`, a
charge that touches both an excluded business and a non-excluded one still matches on the second
row, so the exclusion silently fails to exclude. Semantics to implement: *drop the charge if any of
its businesses/accounts is in the list.*

### `excludedTags`

Same `NOT EXISTS` reasoning against the charge-tags join table. Note the schema types this as
`[String!]` to mirror `byTags`, even though the values are tag ids — keep them consistent rather
than "fixing" one side.

### `excludedFreeText`

`freeText` is a multi-column `ILIKE` across user description, transaction description/reference and
document description/remarks/serial. Negating it needs care on two points:

- **NULL safety.** `NOT (column ILIKE '%x%')` is `NULL`, not `TRUE`, when the column is `NULL`, so a
  charge with no description would be dropped from an exclusion query rather than kept. Wrap each
  column in `COALESCE(column, '')`.
- **Decide the intent explicitly.** "Charges that do not mention X" should almost certainly include
  charges with no text at all. Confirm and encode that, and cover it with a test.

Apply the same `.trim().toLowerCase()` normalisation the positive twin uses.

## Precedence

The tri-state UI cannot put one value in both the include and exclude list, but the API allows it.
Specify and test **exclude wins** — it is the safer default, and it keeps the predicate order
irrelevant.

## Tests

Extend
[`all-charges-filters.test.ts`](../../packages/server/src/modules/charges/resolvers/__tests__/all-charges-filters.test.ts)
with, per field: a charge that should be excluded, one that should survive, a charge matching both
an included and an excluded value (the precedence case), and — for `excludedFreeText` — a charge
with `NULL` description.

## Downstream

- **MCP.** The four fields are currently listed in
  `UNSUPPORTED_UPSTREAM_CHARGE_FILTER_FIELDS`
  ([`packages/mcp-server/src/tools/charge-filters.ts`](../../packages/mcp-server/src/tools/charge-filters.ts)),
  which keeps them out of the charge tools precisely because upstream ignores them. Remove each
  field from that list as it gains a predicate, and expose it on `accounter_get_charges` /
  `accounter_search_charges`. The `schema-contract` test enforces this both ways, so a field left in
  the list after implementation is not silently forgotten.
- **Client.** No client change is needed — the UI already sends the fields.

## Related

`unbalanced` and `businessTrip` are in the same accepted-but-ignored category and have been for
longer. If this work is picked up, they are worth resolving in the same pass — either implement them
or remove them from the schema.
