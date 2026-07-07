---
'@accounter/server': patch
---

**Conversion charges with multiple transactions per side**: conversion ledger generation no longer
requires exactly two main transactions. A single conversion can now be split across two or more
transactions on the base or quote side (for example two ILS credits against one USD debit).

- Main transactions are grouped by sign; each side is validated to be single-currency and the two
  sides to differ in currency, with failures recorded as ledger errors instead of aborting
  generation.
- Each side is aggregated into one representative entry (`aggregateConversionSideEntries`) that feeds
  the existing fee and exchange-revaluation calculations, so the classic two-transaction case is
  unchanged.
