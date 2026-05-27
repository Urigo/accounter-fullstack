---
'@accounter/server': patch
---

* **Database Schema Update**: Updated the `sort_codes` table to use a composite primary key of `(key, owner_id)` to prevent multi-tenant ID collisions.
* **API and Data Loader Refactoring**: Refactored `SortCodesProvider` and associated GraphQL resolvers to support multi-tenant lookups by `ownerId`, replacing single-key lookups with composite key loaders.
