---
'@accounter/server': patch
---

Fix the documents `unmatched` filter losing its outer correlation. In
`getDocumentsByExtendedFilters`, the `NOT EXISTS` subquery compared `t.charge_id = charge_id`, where
the unqualified column resolved to the subquery's own `transactions.charge_id` instead of the outer
`documents.charge_id`. The predicate therefore collapsed to "no transaction anywhere has a non-null
charge_id", so the filter returned no documents as soon as any transaction was matched to a charge.
The comparison is now qualified as `t.charge_id = documents.charge_id`.
