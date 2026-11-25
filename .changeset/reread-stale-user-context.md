---
'@accounter/client': patch
---

Read the user context again when it goes out of date, instead of keeping the one from the page
load until a reload. Changing the business scope now re-reads it for the new scope (the read scope,
default currency, ledger lock and the other single-business fields), behind the loader, as dev
auth already did. A user who accepts an invitation gets their memberships as the app opens.
