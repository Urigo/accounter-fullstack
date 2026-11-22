---
'@accounter/client': patch
---

Add a Playwright end-to-end suite (`yarn workspace @accounter/client e2e`) that runs a production
build of the client against the real server and a seeded local Postgres, starting with the All
Charges screen: paging, filters, browser history, merging, and the route loader's request hand-off.
Test-only; no runtime change.
