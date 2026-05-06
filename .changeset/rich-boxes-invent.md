---
'@accounter/scraper-app': patch
'@accounter/server': patch
---

- **Scraper Enhancements**: Updated currency rate and Poalim scrapers to accept specific date
  ranges, improving flexibility and data accuracy.
- **Transaction Ingestion Logic**: Implemented advanced transaction diffing and change detection for
  Isracard, Amex, and currency rates to identify updates to existing records rather than just
  inserting new ones.
- **Data Type Normalization**: Standardized card identifiers to strings across the ingestion
  pipeline and updated GraphQL schemas to reflect these changes.
