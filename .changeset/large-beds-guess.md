---
'@accounter/server': patch
---

- **New Database Migration**: A new database migration was added to populate the `owner_id` column
  in `accounter_schema.ledger_records` based on associated `charges` and subsequently enforce a
  `NOT NULL` constraint on this column.
- **Comprehensive Owner ID Backfill Script**: A comprehensive backfill script was introduced to
  systematically populate `owner_id` values across 30+ tables within the `accounter_schema`,
  addressing various data relationships.
