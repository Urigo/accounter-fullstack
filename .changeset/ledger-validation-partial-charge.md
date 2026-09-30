---
'@accounter/client': patch
---

Fix the Ledger Validation page crashing (`Cannot read properties of undefined (reading 'map')`)
when a charge fails on the server mid-stream: a late deferred `metadata` patch could turn its
`null` charge into a partial object, which is now filtered out instead of reaching the charges
table.
