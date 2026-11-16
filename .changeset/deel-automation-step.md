---
'@accounter/server': minor
'@accounter/client': patch
---

`runCronJobs` now pulls Deel documents as its last step (`FETCH_DEEL_DOCUMENTS`), streaming a
`DeelChargeSynced` event for each charge that got Deel invoices. A business without Deel
credentials gets the new `NOT_CONFIGURED` step state instead of a failure, and running the step
last means a Deel error never blocks the other automations. A failed step's error now includes its
underlying cause when that cause is meant for users; database and validation errors stay in the
server logs.
