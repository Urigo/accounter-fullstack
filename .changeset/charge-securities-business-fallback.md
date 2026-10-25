---
'@accounter/client': patch
---

The charge's Foreign Securities panel now falls back to the security's business when the bank's
reference list has no entry for its key. That happens for securities closed out before the list was
scraped, such as a redeemed bond. The panel shows the business's name, symbol and descriptor badges
instead of a "not found" message, and leads with the ISIN in both cases. The security's name links
straight to its business's Security tab. The panel and the Security tab now share one heading
component, so the two show a security the same way.
