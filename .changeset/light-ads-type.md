---
'@accounter/client': patch
---

- **Income Charge Identification**: The `ChargeExtendedInfo` component now fetches the
  `totalAmount.raw` field for charges. This new data is used to derive an `isIncomeCharge` flag,
  identifying charges with a positive total amount.
- **Direct Document Issuance for Income Charges**: An `IssueDocumentModal` component has been
  integrated into the 'Transactions' accordion header. This modal is conditionally rendered and
  accessible only for charges identified as income charges, providing a direct pathway to issue new
  documents.
