---
'@accounter/server': patch
---

Fix `TaxCategory.irsCode`, `ownerId`, `createdAt` and `updatedAt` always resolving to `null`.

The resolver map only covered `id`, `name` and `isActive`, so GraphQL's default resolver looked for
camelCase keys on a snake_case database row and found nothing. `irsCode` and `ownerId` were already
queried by the edit-tax-category modal; `createdAt`/`updatedAt` are non-null in the schema, so
querying them errored.
