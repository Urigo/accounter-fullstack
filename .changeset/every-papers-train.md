---
'@accounter/server': patch
---

- **Negative VAT Handling**: Negative VAT values, such as those found in credit invoices, are now
  correctly categorized as `SALE_REGULAR` instead of being misclassified as
  `SALE_UNIDENTIFIED_ZERO_OR_EXEMPT`.
