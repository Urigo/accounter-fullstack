---
'@accounter/scraper-app': patch
---

Round the scraped JPY exchange rate (converted from BOI's per-100-units quote) to the DB column's
6-decimal precision, so floating-point noise (e.g. `0.018734999999999998`) no longer shows up as
changed currency-rate rows.
