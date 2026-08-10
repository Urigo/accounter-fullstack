---
'@accounter/client': patch
---

The All Charges screen scrolled sideways: the table forced itself to `max-w-fit` with
`whitespace-nowrap` on every cell, so it grew to its content width and stretched the page. Expanding
a charge made it worse — the nested section tables (transactions, documents, ledger) propagated
their intrinsic width up through the expansion cell
