---
'@accounter/server': patch
---

- **sort-codes.provider.ts**: Modified `updateSortCode` to retrieve the verified admin context and
  pass the `ownerId` to the query via `reassureOwnerIdExists` helper
- **sort-codes.provider.test.ts**: Added comprehensive test coverage for both `updateSortCode` and
  `addSortCode` methods, including:
  - Regression test verifying `owner_id` is included in update query values
  - Test confirming all parameters (key, name, defaultIrsCode, ownerId) are forwarded correctly
  - Test verifying cache is cleared after updates
  - Test for `addSortCode` ensuring `owner_id` is injected into insert queries
