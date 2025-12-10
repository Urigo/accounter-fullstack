---
'@accounter/server': patch
---

- **Fixture Type Independence**: The test fixture types (for businesses, tax categories, and
  financial accounts) have been decoupled from the `pgtyped`-generated database types. This enhances
  test independence and flexibility, allowing fixtures to define their own minimal interfaces.
- **Standardized Naming Convention**: The `createBusiness` and `createTaxCategory` factories now use
  a generic `name` field for display purposes, replacing the more specific `hebrewName` and
  `hashavshevetName` fields. The original specific fields are retained as optional/nullable.
- **Intelligent Name Defaulting**: New logic has been implemented in the `createBusiness` and
  `createTaxCategory` factories to intelligently default the `name` field. If a `name` is not
  explicitly provided, it will fall back to the `id` of the entity, ensuring a meaningful display
  name in test scenarios.
- **Updated Fixture Usage and Tests**: All existing test files and fixture scenarios have been
  updated to reflect the new `name` field and type definitions. This includes updates to factory
  calls, test assertions, and the `fixture-loader`'s database insertion logic.
