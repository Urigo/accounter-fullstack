---
'@accounter/server': patch
---

* **VAT Suggestion Logic**: Implemented a new suggestion resolver that identifies missing VAT charge descriptions by comparing transaction amounts against monthly VAT reports.
* **Ledger Validation**: Added validation logic to the ledger generation process to ensure monthly VAT charges have valid descriptions and that the VAT amount matches the transaction sum.
* **Helper Utilities**: Introduced helper functions to calculate monthly VAT totals and verify them against transaction amounts within a defined tolerance.
