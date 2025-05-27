---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Features**
  - Added support for associating multiple IRS codes with sort codes, tax categories, and financial entities.
  - Introduced a new IRS codes input component allowing users to add, edit, and validate multiple IRS codes in forms.
  - Forms now dynamically update IRS codes based on sort code selection.

- **Improvements**
  - Enhanced UI feedback by visually marking modified (dirty) fields in forms, except during insert mode.
  - Updated tables and detail views to display multiple IRS codes where applicable.

- **Bug Fixes**
  - Ensured IRS code validation enforces uniqueness and valid ranges for all entries.

- **Database Migration**
  - Migrated database columns to support arrays of IRS codes, preserving existing data.

- **API Changes**
  - Updated GraphQL schema and API endpoints to handle arrays of IRS codes instead of single values.
