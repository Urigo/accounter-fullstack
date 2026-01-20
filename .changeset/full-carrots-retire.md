---
'@accounter/server': patch
---

- **Generalized `getEntryTypeByRecord` function**: The `getEntryTypeByRecord` function has been
  refactored to accept a more comprehensive object containing `pcn874RecordType`, `isExpense`,
  `vatNumber`, `localVat`, and `foreignVatAfterDeduction`. This allows for more dynamic and accurate
  inference of the PCN874 entry type when an explicit type is not provided.
- **Enhanced Error Handling for Unmapped Types**: The function now throws an error for unhandled
  `pcn874RecordType` values, replacing a previous debug log. This ensures that any unmapped types
  are explicitly caught and addressed, improving system robustness.
- **Conditional VAT Number Handling for Foreign Businesses**: The `adjustTaxRecord` function now
  checks if a business is local and only includes the VAT number in the record if it is. For foreign
  businesses, the VAT number is set to `undefined`, which correctly triggers the new inference logic
  in `getEntryTypeByRecord` for foreign transactions.
- **Updated and Expanded Test Coverage**: Existing test cases for `getEntryTypeByRecord` have been
  updated to match the new function signature, and new tests have been added to specifically cover
  the inference logic for various edge cases. Snapshot tests were also updated and expanded to
  include new scenarios for local customer credit invoices, ensuring the generated PCN874 reports
  are accurate.
