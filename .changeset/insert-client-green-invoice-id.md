---
'@accounter/server': patch
---

`insertClient` now returns the client as it stands after its Green Invoice customer is created, so
`integrations.greenInvoiceInfo` carries the new id instead of `null`.
