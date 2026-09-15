---
'@accounter/client': patch
---

Hoist the four in-render `dedupeFragments()` calls in the report screens.

`tax-report`, `profit-and-loss-report`, `corporate-tax-ruling-compliance-report` and
`vat-monthly-report/pcn-generator` each passed `dedupeFragments(XDocument)` straight into `useQuery`.
`dedupeFragments` builds a new `DocumentNode` every call, so each render handed urql a fresh object
that it had to re-print and re-hash before arriving at the same operation key it had last time — and
the tax report's document is 126 lines.

Each is now a module-scope constant, matching `vat-monthly-report/index.tsx`, which already did this
and carries a comment explaining why.

Behaviour is unchanged: the operation key was already stable, so no query re-keys or re-fires. This
only stops the repeated work of deriving it.
