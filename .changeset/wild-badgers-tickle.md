---
'@accounter/scraper-app': patch
---

Skip Max transactions with `runtimeReference.type === 0` — these are declarations of transactions
not received by the credit card company and are missing many required attributes, which previously
failed payload validation and aborted the whole Max scrape.
