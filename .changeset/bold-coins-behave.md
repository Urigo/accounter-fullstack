---
'@accounter/server': patch
---

- A new provider, `FinancialAccountsTaxCategoriesProvider`, has been added to handle database
  operations for financial account tax categories. This provider includes SQL queries for fetching,
  updating, inserting, and deleting tax categories, and utilizes a `DataLoader` for efficient data
  retrieval.
- The `financial-accounts.resolver.ts` now includes comprehensive logic to manage tax categories
  during financial account creation and updates. This involves identifying new categories to insert,
  existing ones to update, and old ones to delete, ensuring data consistency.
