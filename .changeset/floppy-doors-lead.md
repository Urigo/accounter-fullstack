---
'@accounter/client': patch
---

- **Navigation Enhancement**: Introduced a new `ChargeNavigateButton` component to enable direct
  navigation to individual charge details from both income and expense rows within the VAT monthly
  report.
- **UI Refinement**: Consolidated the `ToggleExpansionButton`, `ToggleMergeSelected`, and the new
  `ChargeNavigateButton` into a single column for a more organized and cleaner user interface in
  both income and expense report rows.
- **Data Visibility**: Added a new column to the expenses section of the VAT monthly report to
  display the `taxReducedLocalAmount`, providing more detailed financial information at a glance.
