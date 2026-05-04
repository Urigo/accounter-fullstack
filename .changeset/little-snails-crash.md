---
'@accounter/server': patch
---

- **New Scraper Ingestion Module**: Introduced a new server module to handle scraper data ingestion,
  including GraphQL resolvers, providers, and type definitions.
- **Database Migrations**: Added new database migrations to implement unique constraints for various
  transaction tables to improve data deduplication.
- **Validation Logic**: Implemented helper functions to validate and map incoming transaction data
  from various scrapers before database insertion.
