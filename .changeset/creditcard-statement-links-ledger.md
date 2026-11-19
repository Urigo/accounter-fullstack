---
'@accounter/server': minor
---

The ledger and the charge type now read stored bank ⇄ card statement links. A linked card debit
without relevant documents is booked against the linked card accounts, one entry per statement
(statements must add up to the debit exactly, in its currency). A charge with a link is a
`CreditcardBankCharge`. The hard-coded card fallback in the ledger became `MANUAL` links (data
migration). The `LINK_CREDITCARD_STATEMENTS` automation re-flags approved charges whose accounting a
link changes, and reports them as `CreditcardStatementsLinked.degradedCharge`.
