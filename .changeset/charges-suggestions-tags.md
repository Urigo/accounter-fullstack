---
'@accounter/server': patch
---

Charge suggestions look up tags only for the suggestion that matched: the phrase table is built once
per request and keeps tag references, instead of resolving every business's tags one business at a
time for every charge. Removes about 20 sequential tag queries from each charges page; suggestions
are unchanged.
