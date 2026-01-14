---
'@accounter/client': patch
'@accounter/server': patch
---

- **Client UI Enhancement**: A new toggle switch for "Is Decreased VAT" has been added to the
  `EditCharge` form, allowing users to directly modify this status for individual charges.
- **Charge Merging Functionality**: The `MergeChargesSelectionForm` now supports viewing and
  selecting the "Is Decreased VAT" status for charges during the merge process, enabling consistent
  application of this attribute across merged charges.
- **GraphQL Schema Extension**: The GraphQL schema has been updated across various `Charge` and
  `FinancialCharge` types to include a new `decreasedVAT: Boolean` field, and
  `isDecreasedVAT: Boolean` in input types, to support this new attribute.
- **Server-Side Logic Update**: The server-side resolvers for `updateCharge`, `batchUpdateCharges`,
  and `mergeCharges` have been modified to process the `isDecreasedVAT` input. Notably, the
  `isDecreasedVAT` value is currently mapped to the `isProperty` field (`is_property` attribute on `charges` DB table).
