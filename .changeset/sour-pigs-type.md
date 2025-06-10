---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Features**
  - Added support for an optional "taxExcluded" field when creating tax categories, allowing users to specify whether a tax category is tax-excluded.
- **Bug Fixes**
  - Corrected parameter naming to ensure proper handling of the "taxExcluded" value during tax category creation.
