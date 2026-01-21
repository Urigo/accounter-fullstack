---
'@accounter/client': patch
'@accounter/server': patch
---

- **Charge Type Refactoring**: Replaced the boolean `isConversion` field with a comprehensive
  `ChargeType` enum across the application, providing a more explicit and flexible way to categorize
  charges.
- **Database Migration**: A new database migration was added to enrich the
  `accounter_schema.charge_type` enum with several new values, including 'BUSINESS_TRIP', 'COMMON',
  'CREDITCARD_BANK', 'DIVIDEND', 'FOREIGN_SECURITIES', 'INTERNAL', and 'VAT'.
- **GraphQL Schema and Resolvers Update**: The GraphQL schema was updated to include the new
  `ChargeType` enum and integrate it into the `Charge` input type.
- **Client-side UI Enhancements**: The UI for editing and merging charges was updated to replace the
  'Is Conversion' switch with a selectable dropdown for `ChargeType`, improving user experience and
  data accuracy. Icons and names for charge types are now dynamically displayed using helper
  functions.

- **Unified Charge Type Management**: Replaced disparate boolean flags (e.g., 'isConversion', 'isSalary') with a single, comprehensive 'ChargeType' enum across the application for better categorization and extensibility.
- **Database Schema Evolution**: Introduced a new database migration to expand the 'accounter_schema.charge_type' enum with several new values, aligning the backend with the new type system.
- **GraphQL API Modernization**: Updated the GraphQL schema to incorporate the new 'ChargeType' enum, modifying input types for charge updates and ensuring all charge types expose their 'type' via resolvers.
- **Enhanced User Interface for Charge Editing**: Revamped the client-side UI for editing and merging charges, replacing simple boolean switches with a user-friendly dropdown selector for 'ChargeType', complete with dynamic icons and labels.
- **Streamlined Backend Logic**: Adjusted server-side helpers and resolvers to correctly handle the new 'ChargeType' enum, ensuring consistent type assignment and retrieval throughout the system.
