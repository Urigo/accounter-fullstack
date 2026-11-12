---
'@accounter/server': patch
---

`businesses(ids:)` now reports an unknown id as `Businesses not found: ID="…"` instead of the masked
"Unexpected error.", so callers can tell a bad id from an outage. A failed load is still masked.
