---
'@accounter/server': patch
---

- **New SHAAM File Import Feature**: Introduced a new `importShaamFile` resolver and
  `ShaamImportProvider` to facilitate onboarding by importing SHAAM uniform-format files.
- **Encoding Support**: Added `iconv-lite` to handle Windows-1255 encoding, ensuring correct
  processing of legacy SHAAM file formats.
- **Database Enhancements**: Updated `BusinessesProvider`, `FinancialEntitiesProvider`, and
  `SortCodesProvider` to support transactional inserts with custom `PoolClient` instances.
