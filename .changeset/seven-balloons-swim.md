---
'@accounter/server': patch
---

- Extended migration infrastructure to support non-transactional migrations via a new
  `noTransaction` flag
- Added indexes and foreign keys for `owner_id` columns across 47 tables
- Created test coverage for the migration to verify indexes and foreign keys are properly created
