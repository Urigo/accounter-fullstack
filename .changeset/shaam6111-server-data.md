---
"@accounter/server": patch
---

SHAAM 6111 report: read the requested business's ledger (it read the session owner's), fall back
to the sort code's default IRS code for entities without one, report a company as a company, and
take the withholding file number from the business admin settings. `validation` also lists
balances of entities with no IRS code, IRS codes that are not 6111 lines, a mismatch between 6666
and the books, and a missing withholding file number.
