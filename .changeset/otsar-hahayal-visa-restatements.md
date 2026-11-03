---
'@accounter/server': patch
---

Otsar Hahayal credit-card uploads no longer duplicate deals the bank restates after the monthly
charge. Visa deals are reported provisionally until then (merchant name truncated and upper-cased,
no notes) and rewritten about a day later (date one day back, full name, notes filled in). Since
date, name and notes are part of the dedup key, each restated deal used to be inserted as a second
transaction. The upload now pairs a restated deal with the stored row it replaces — only rows that
dropped out of the latest scrape of their own statement, with the same card, amounts and currencies,
a matching name prefix and a date within three days — and updates that row in place. A new trigger
carries the new date and description over to the existing transaction, so it keeps its charge,
business and edits; the charge's accountant approval is re-flagged for review. Stored rows that
vanish from a scraped statement without a matching restatement are logged and left unchanged.
