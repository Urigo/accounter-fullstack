---
'@accounter/modern-poalim-scraper': patch
---

- Updated the scraper runner to pass the `headless` option.
- Refactored account identification logic to include `subAccount` in the `accountId` string,
  ensuring uniqueness.
- Updated `useRunSocket` to separate `accountSteps` and `monthSteps` in the task state, improving
  the reliability of progress tracking.
- Refactored the UI to use a new `CollapsibleSection` component for cleaner organization of task
  steps (Accounts vs. Months).

- **Database Migrations:**
  - Added a new migration to flag fees in Otsar Hahayal transactions (ILS, foreign, and credit card)
    based on description and name patterns.
  - Updated the migration runner to include the new fee-flagging migration.
