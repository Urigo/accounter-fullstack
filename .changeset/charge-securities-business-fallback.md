---
'@accounter/client': patch
---

The charge's Foreign Securities panel now falls back to the security's business when the bank's
reference list has no entry for its key. That happens for securities closed out before the list was
scraped, such as a redeemed bond. The panel shows the business's name, symbol and descriptor badges
instead of "Not found in the ingested securities list". The security's title links to its business
page.
