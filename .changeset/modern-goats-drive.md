---
'@accounter/scraper-app': patch
---

- Updated `parseForeignXls` to support `subAccount` identification, ensuring foreign transactions
  are correctly associated with their respective sub-accounts.
- Improved browser launch configuration to explicitly check for `headless` mode.
- Updated types to include `subAccount` in `ForeignAccountMetadata`.

- **Database Migrations:**
  - Added a new migration to flag fees in Otsar Hahayal transactions (ILS, foreign, and credit card)
    based on description and name patterns.
  - Updated the migration runner to include the new fee-flagging migration.
