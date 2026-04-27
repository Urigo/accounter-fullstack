---
'@accounter/client': patch
---

- **Comprehensive Test Coverage**: Added a new, extensive test suite for the `relevantDataPicker`
  utility function, ensuring its reliability and correctness.
- **Edge Case Validation**: The tests cover a wide array of scenarios including nested objects,
  arrays, null/undefined values, primitive types, and specific handling for fields like 'formatted'
  within financial objects (e.g., `localCurrencyAmount`, `originalAmount`, `withholdingTax`, `vat`,
  `amount`, `defaultIrsCode`, `irsCode`).
- **Robustness Assurance**: The new test suite validates that the `relevantDataPicker` function
  correctly identifies and extracts only 'dirty' fields from complex data structures, improving data
  integrity and reducing unnecessary data submissions.
