---
'@accounter/client': patch
---

The All Charges list now keeps its charges in a normalized client cache (urql Graphcache), so a row
shows an edit from the save's own result. Setting the accountant status or accepting suggested tags
no longer refetches the row. Only the charges-list operations go through the cache; every other
screen behaves as before. Each charges-table cell has its own GraphQL fragment, and charge mutations
return those fragments.
