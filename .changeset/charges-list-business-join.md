---
'@accounter/server': patch
---

Charges list loads faster: the documents-to-counterparty join in the filtered charges query is now
an equality join instead of an `OR` condition, so Postgres no longer compares every document with
every business. On a production-sized copy the list request went from about 920 ms to about 330 ms.
