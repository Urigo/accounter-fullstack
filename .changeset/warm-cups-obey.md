---
'@accounter/server': patch
---

Fix ledger generation for edge case: cross-year, VAT-included, foreign-currency. Corrected VAT
payment entries to ensure credit amounts are accurately reflected.
