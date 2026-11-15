---
'@accounter/server': patch
---

A `@defer` request whose `Accept` header names no streaming type no longer holds a DB connection
after its 406. Yoga dropped the stream unread, so the end of execution never came and nothing
aborted the request: the request's client kept its connection, transaction open, until the watchdog
reclaimed it as a leak. `dbCleanupPlugin` now cancels the refused stream, which ends execution and
releases the client.
