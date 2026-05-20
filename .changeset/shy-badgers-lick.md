---
'@accounter/server': patch
---

adds `updateDeposit(id, name?, openDate?, closeDate?)` GraphQL mutation — merges provided fields
with existing record so omitted fields are preserved. The provider's `updateBankDeposit` method was
already in place; only the schema and resolver were missing.
