---
'@accounter/mcp-server': patch
---

`accounter_get_charges` with `includeSecurities` now takes a security's `exchange` and `itemType`
from its security business, falling back to the bank's reference row, like `symbol` and `name`.
They used to be `null` whenever the reference list had no row for the key (e.g. a position closed
before the list was scraped), even when the security business had both.
