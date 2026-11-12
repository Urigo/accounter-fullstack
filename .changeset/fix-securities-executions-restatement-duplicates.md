---
'@accounter/server': patch
---

Stop duplicating Poalim securities executions that are scraped before they settle. The bank
restates an execution's price, net value and value/settlement dates as it settles, and those fields
were part of the dedup key, so each restated scrape added a second row. The key now leaves them out
(plus a per-scrape `occurrence` ordinal to keep genuine same-day, same-size executions apart), and a
re-scrape updates the existing row in place. A migration removes the superseded rows already
stored, keeping the most recent version of each execution.
