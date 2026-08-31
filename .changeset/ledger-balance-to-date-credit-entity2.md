---
'@accounter/server': patch
---

Fix opening balances in the yearly ledger report missing every credit-side entity-2 amount.

`getLedgerBalanceToDate` unions the four entity slots of a ledger record into one
`(entity_id, amount, invoice_date)` stream and sums it. Two of the four branches were byte-identical
— `credit_entity1, credit_local_amount1, invoice_date` appeared twice — so `credit_entity2` /
`credit_local_amount2` was never read at all, while both debit slots were. Any record crediting a
second entity (the common shape for a split credit) contributed nothing for that entity, and the
opening balance `yearlyLedgerReport` carries into the year was silently wrong for it. The duplicated
branch did not double-count, because `UNION` deduplicated it against its twin.

The second branch now selects `credit_entity2, credit_local_amount2`, and all three set operations
are `UNION ALL`. `UNION` deduplicates across the whole stream, not just the accidental duplicate:
two genuine movements that happen to share an entity, a local amount and an invoice date — the same
fee posted twice in a day, two identical monthly lines — collapsed into one, understating the
balance. `UNION ALL` keeps every row, which is what a sum over ledger sides needs.
