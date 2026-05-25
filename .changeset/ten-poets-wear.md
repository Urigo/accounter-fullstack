---
'@accounter/server': patch
---

- **New Scraper Implementation**: Added a comprehensive scraper for Otsar Hahayal, supporting ILS,
  foreign currency, and credit card transactions.
- **Database Schema & Migrations**: Introduced new database tables for Otsar Hahayal transactions
  and updated the ingestion pipeline with necessary triggers and constraints.
- **Infrastructure Integration**: Integrated the new scraper into the existing system, including
  GraphQL mutation updates and UI configuration support.
