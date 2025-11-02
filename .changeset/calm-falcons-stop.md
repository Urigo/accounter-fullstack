---
'@accounter/green-invoice-graphql': patch
---

- Migrated from JSON Schema draft-07 to 2020-12
- Updated all type references from `definitions` to `$defs` (represented as `_DOLLAR_defs` in
  TypeScript)
- Added client management operations (add, update, delete)
- Enhanced JSON schema with better validation constraints and shared type definitions
