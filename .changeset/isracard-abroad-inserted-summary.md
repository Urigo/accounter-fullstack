---
'@accounter/server': patch
---

Fix empty date, description and amount in the scraper app's "New transactions" list for inserted
Isracard/Amex abroad transactions. The upload summary now falls back to the `*_outbound` columns
(date, supplier name, payment sum) that abroad rows populate instead of the domestic ones.
