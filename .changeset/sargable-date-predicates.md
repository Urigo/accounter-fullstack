---
'@accounter/server': patch
---

Make the transaction, document and charge date-range filters sargable by dropping the `::TEXT::DATE`
round-trip they compared through.

Every date-range predicate in `transactions.provider.ts`, `documents.provider.ts`,
`charges.provider.ts` and `accountant-approval.provider.ts` was written as
`<expr>::TEXT::DATE >= date_trunc('day', $param ::DATE)` — 24 sites in all. Since `event_date`,
`debit_date`, `debit_date_override`, `documents.date`, `vat_report_date_override` and the ledger
dates are all already `date` columns, the cast was a pure round-trip that changed no value, but it
cost three ways. The qual was an expression rather than a bare column, so
`transactions_event_date_index`, `transactions_debit_date_index` and `documents_date_index` could
not serve it. The planner also lost the column statistics and fell back to a default range guess,
which propagated bad row estimates into join order downstream. And because `date_in`/`date_out` are
`STABLE` rather than `IMMUTABLE` (they depend on `DateStyle`), there was no escape hatch either —
PostgreSQL rejects an expression index over that form with `functions in index expression must be
marked IMMUTABLE`.

The predicates now compare the bare date expression against `$param ::DATE`. The `date_trunc('day', …)`
wrapper on the parameter side goes too: the parameters are `TimelessDateString`, so truncation was a
no-op that only widened the comparison to `timestamp`. The `$param ::TEXT IS NULL` guards are
unchanged, and the generated pgtyped parameter and result types are byte-identical.

A new migration adds four indexes covering the filters, built `CONCURRENTLY`. They are composite on
`(owner_id, <date>)` rather than plain date indexes because every read is tenant-scoped through RLS,
so one index serves both the tenant predicate and the range:
`idx_transactions_owner_event_date`, `idx_transactions_owner_effective_debit_date`,
`idx_documents_owner_date` and `idx_documents_owner_vat_report_date`. The two `COALESCE` variants
match the "effective" date the filters actually compare against — `COALESCE` over two `date` columns
is immutable, so unlike the old cast it is a legal index expression.

On a 400k-row reproduction, a three-month range scoped to one owner went from a parallel bitmap heap
scan discarding 26,067 rows over 3,885 buffers (estimate 394 against 1,800 actual) to a plain bitmap
index scan over 186 buffers with no rows discarded and an estimate within 1% — roughly 75× faster.

The predicates in `charges.provider.ts` and `accountant-approval.provider.ts` run over the
post-aggregation `enriched_charges` CTE and `extended_charges` view, so no base-table index can serve
them either way; they are cleaned up here for the per-row cost and the restored statistics, but
pushing those date ranges down into the base-table CTEs remains open work under
`docs/all-charges-performance-boost/enhancement-plan.md`.
