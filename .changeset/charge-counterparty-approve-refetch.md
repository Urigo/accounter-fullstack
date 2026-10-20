---
'@accounter/client': patch
---

Approving a transaction's suggested counterparty (or creating a new business for it) in a charge's
transactions table now refetches the charge, instead of leaving it stale until the page reloads.
