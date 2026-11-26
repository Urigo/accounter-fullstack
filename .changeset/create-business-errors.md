---
'@accounter/server': patch
---

`insertNewBusiness` no longer leaves a financial entity behind when the business row cannot be
inserted, and says so when the cause is a country missing from the countries table instead of a
bare "Failed to create business". `deleteFinancialEntityById` now waits for its final delete.
