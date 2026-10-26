---
'@accounter/server': minor
---

Book sales of securities from their FIFO lots. A sale used to be booked as is, crediting the
securities account with the proceeds, so no gain or loss was recognised. It is now booked like a
redemption: the securities account gives up the FIFO cost at the cash leg's rate, and the difference
is a gain or loss (`(sell price − buy price) × units × sale rate`). A sale with withheld tax, and a
cancelled sale, keep the base entry with a ledger error. Existing sale ledgers change when
regenerated; ledgers in a locked period are not touched.
