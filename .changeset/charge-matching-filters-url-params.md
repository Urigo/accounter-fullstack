---
"@accounter/client": patch
---

Persist the Charge Matching screen filters (mode, from/to dates, business and sort-by) in the URL
query string, so the current selection survives a page refresh and can be shared via link. Filter
updates are merged into the existing query params, preserving any unrelated params already in the
URL.
