---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Features**
  - Simplified IRS code handling throughout the app: IRS codes are now managed as a single value instead of an array in all relevant forms, tables, and modals.

- **Bug Fixes**
  - Updated number input fields to only accept whole numbers (no decimals) where applicable.

- **Refactor**
  - Unified IRS code fields and logic across the user interface for consistency.
  - Updated all related queries, mutations, and schema fields to use singular IRS code values.

- **Database Migration**
  - Migrated existing IRS code data from arrays to single-value columns for improved data consistency.
