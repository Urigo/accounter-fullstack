---
'@accounter/client': patch
---

Make the unit of a contract's operations limit obvious. The field was labelled "Operations Limit"
with placeholder `500` and no unit, so a 30B-a-month plan was easy to enter as `30000` (millions)
when the column stores the full count. The edit dialog now reads "Operations limit (operations /
month)" with a `30,000,000,000` placeholder (shown for a new contract, since a zero value now
renders as an empty field), a live "= 30B operations a month. The full number, not millions."
description, and a non-blocking hint when the value is under a million. The contracts table column
is headed "Operations / month"; it and the client's contracts section show the compact form (`30B`,
`600M`) with the exact number in a tooltip, through a shared `formatCompactNumber` helper. No schema
change.
