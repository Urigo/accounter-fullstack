# @accounter/kraken-scraper

## 0.0.2

### Patch Changes

- [#4994](https://github.com/Urigo/accounter-fullstack/pull/4994) [`79fc048`](https://github.com/Urigo/accounter-fullstack/commit/79fc0480cafeddbd9a0e7dd6d2f3e9611fabdc23) Thanks [@gilgardosh](https://github.com/gilgardosh)! - Each scraper now documents its environment variables in a `.env.template`: new templates for the
  etana, etherscan and kraken scrapers (their READMEs point at them instead of inline blocks), a
  described template for the VAT scraper, and a new modern-poalim-scraper template holding the bank
  credentials its `src/test` dev scripts read (moved out of the root template, plus the missing
  `OTSAR_HAHAYAL_*`). A repo-wide test now fails when any template lists a variable no code reads.

## 0.0.1

### Patch Changes

- [#3091](https://github.com/Urigo/accounter-fullstack/pull/3091)
  [`fa665bb`](https://github.com/Urigo/accounter-fullstack/commit/fa665bb6b6e54fe228d3bbbdc95139bc44309306)
  Thanks [@gilgardosh](https://github.com/gilgardosh)! - - **Row-Level Security (RLS) Enforcement**:
  The pull request introduces changes to various scraper modules and database triggers to enforce
  Row-Level Security by explicitly associating all new transactions with an `owner_id`.
  - **Database Schema Migration**: A new migration script has been added to update existing
    PostgreSQL trigger functions, ensuring that `owner_id` is included in transaction insertions
    across multiple data sources (e.g., Poalim, credit cards, bank discounts, Amex).
  - **Scraper Module Updates**: The Etana, Etherscan, and Kraken scraper modules have been modified
    to pass the `owner_id` when inserting new transactions into the database.
