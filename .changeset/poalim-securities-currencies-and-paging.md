---
'@accounter/modern-poalim-scraper': patch
'@accounter/scraper-app': patch
'@accounter/server': patch
---

Accept the Poalim securities feed's non-USD currencies, and page past its 150-execution response cap

The executions schema only knew `שקל חדש` and `דולר ארה"ב`, so any non-US listing failed validation;
`אירו`, `לירה שטרלינג` and `ין יפני` are now accepted and mapped to `Currency` on read. The endpoint
also caps a response at 150 executions without saying it truncated, so a full page is re-requested
with the window's ceiling pulled back to the oldest day that page reached, and the pages are merged
and deduplicated.
