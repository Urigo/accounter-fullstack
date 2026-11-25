---
'@accounter/server': patch
---

A request's database reads no longer wait for each other: they share the request's connection in
pg pipeline mode instead of queueing behind a per-request mutex. Writes, explicit transactions and
session open/close still run alone. A read that fails only because another statement aborted the
session is retried on a fresh one. With a 10 ms server-to-database round trip, the charges list
request drops from about 1.4 s to about 0.4 s.
