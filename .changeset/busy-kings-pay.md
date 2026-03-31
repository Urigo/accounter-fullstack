---
'@accounter/server': patch
---

- fix charge amount where credit invoices exist
- validate document amount is positive (sign determined according to debtor and creditor sides)
- enhance error messaging levaraging Green Invoice's error messages
