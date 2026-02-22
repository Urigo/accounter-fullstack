---
'@accounter/etherscan-scrapper': patch
'@accounter/kraken-scrapper': patch
'@accounter/etana-scrapper': patch
---

- **Row-Level Security (RLS) Enforcement**: The pull request introduces changes to various scraper
  modules and database triggers to enforce Row-Level Security by explicitly associating all new
  transactions with an `owner_id`.
- **Database Schema Migration**: A new migration script has been added to update existing PostgreSQL
  trigger functions, ensuring that `owner_id` is included in transaction insertions across multiple
  data sources (e.g., Poalim, credit cards, bank discounts, Amex).
- **Scraper Module Updates**: The Etana, Etherscan, and Kraken scraper modules have been modified to
  pass the `owner_id` when inserting new transactions into the database.
