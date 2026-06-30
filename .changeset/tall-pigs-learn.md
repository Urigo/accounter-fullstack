---
'@accounter/scraper-app': patch
---

- Updated `amex.test.ts`, `cal.test.ts`, `discount.test.ts`, and `isracard.test.ts` to set
  `vi.setConfig({ testTimeout: 30_000 })`
- Added explanatory comments referencing PR #3795 which introduced the 2-5s per-month delays in
  scrapers
