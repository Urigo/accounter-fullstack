---
'@accounter/server': patch
---

Make a page of the charges list cheaper to load. The values the list sorts and filters by (dates,
amounts, counts of documents and transactions, counterparties) are now stored per charge in
`charge_list_facts` and kept current by database triggers. A paged list picks its page from that
table and derives the full rows for that page only, instead of for every charge of the business. A
list with a search term, and unpaged callers, still use the single query.
