---
'@accounter/server': patch
---

- **New `createRemarks` Helper Function**: A new utility function, `createRemarks`, has been
  introduced to standardize the generation of document remarks, ensuring consistent formatting for
  purchase orders and existing contract remarks.
- **VAT Type Deduction Logic Update**: The `deduceVatTypeFromBusiness` function now utilizes the
  `locality` property from the `GraphQLModules.Context` for determining the VAT type, enhancing
  accuracy and consistency.
