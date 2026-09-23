---
'@accounter/modern-poalim-scraper': patch
---

Tighten the Hapoalim deposits Zod schema: metadata, attributes, message and `links` objects now use
`.strict()` instead of `.passthrough()`, so unexpected fields in the bank's response fail validation
instead of being silently carried through.
