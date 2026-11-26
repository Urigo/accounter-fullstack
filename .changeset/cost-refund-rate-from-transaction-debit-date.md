---
'@accounter/server': patch
---

A cost refund from the refund date (`FROM_REFUND_DATE`) of an asset recorded in a foreign currency
now converts at the rate of the debit date of the refund charge's main (non-fee) transaction, the
date the refund was received, instead of its earliest document date. The date is the one the
charge's ledger converts that transaction at (debit timestamp, then debit date override, then debit
date); of several main transactions, the earliest counts. Without a charge, or before the refund is
received, the refund date is used. Refunds from activation still convert at the asset's cost-basis
rate.
