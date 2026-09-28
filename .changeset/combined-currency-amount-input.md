---
'@accounter/client': patch
---

`CurrencyInput` is now a single field: the currency picker sits inside the amount field's border
and shows only the currency symbol, while its dropdown lists each currency's symbol, name and code
(all searchable). The issue-document payment and income rows and the contract dialog now use it
instead of a separate amount input and currency select.
