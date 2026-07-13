---
'@accounter/server': patch
---

- **Refactored Merge Logic**: Extracted the complex merge planning logic for charges by transaction
  reference into a dedicated helper function, improving maintainability and testability.
- **Added Dry Run Support**: Introduced a `dryRun` parameter to the
  `mergeChargesByTransactionReference` mutation, allowing users to preview merge plans before
  execution.
- **Enhanced Transaction Data**: Updated the SQL query to include `origin_user_description` by
  joining additional transaction tables, providing more context for matching logic.
- **Comprehensive Test Suite**: Added a new test file covering various scenarios, including
  recurring payments, foreign securities, and fee associations, to ensure robust merge planning.
