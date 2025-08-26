---
'@accounter/server': patch
---

- **New GraphQL Module**: A dedicated `admin-context` GraphQL module has been added to the
  application. This module centralizes the management of various administrative context settings,
  such as default currencies, tax categories, and business IDs.
- **Admin Context Management**: The module introduces new GraphQL queries to fetch `adminContext` by
  `ownerId` and mutations to `updateAdminContext`. These operations allow for comprehensive
  management of a wide range of configurable fields related to financial and tax operations.
- **Data Layer Integration**: An `AdminContextProvider` has been implemented, leveraging DataLoader
  for efficient data fetching. This provider interacts with the `user_context` database table,
  ensuring that data retrieval is optimized through batching and caching.
- **Related Entity Resolution**: Helper functions and resolvers have been added to automatically
  fetch and resolve associated `TaxCategory` and `Business` entities. This ensures that when an
  `AdminContext` is queried, all related details are seamlessly provided.
- **Schema Definition**: The GraphQL schema for the `AdminContext` type and its input has been
  defined, detailing a comprehensive set of fields for various financial and tax-related
  configurations, ensuring a clear and structured API.
