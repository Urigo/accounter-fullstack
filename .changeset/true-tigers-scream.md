---
'@accounter/client': patch
---

* **API and Data Loader Refactoring**: Refactored `SortCodesProvider` and associated GraphQL resolvers to support multi-tenant lookups by `ownerId`, replacing single-key lookups with composite key loaders.
* **Frontend Integration**: Updated various UI components and modals to pass `ownerId` context when fetching and editing sort codes, ensuring data consistency across different business contexts.
