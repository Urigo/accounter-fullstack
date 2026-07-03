---
'@accounter/client': patch
---

Refactored the `/businesses` screen to use a robust `@tanstack/react-table` implementation, replacing the previous card list view. This upgrade introduces advanced data management capabilities including grouping, lazy-loading, sorting, client-side filtering, and batch operations.

- **Data Table Migration**: Replaced the `BusinessHeader` card list with a comprehensive data table featuring grouped columns: Core, Main, Categorization, Extension tags, and Suggestion defaults. Added a "Columns" dropdown to toggle column visibility.
- **Row Selection & Batch Actions**: Implemented row selection to enable merging businesses and a new batch update dialog for bulk-editing shared fields (country, city, zip, sort/IRS codes, tax category, and suggestion descriptions).
- **Lazy-Loaded Usage Tracking**: Introduced a "Usage" column group tracking transactions, documents, expenses, and ledger records. To optimize performance, the `BusinessesUsage` query is lazy-loaded and only un-pauses when a usage column is rendered or the "unused only" filter is active.
- **Advanced Filtering & Sorting**: Added sortable headers with custom null-safe comparators. Implemented robust client-side filtering, including toggles for client/admin/inactive flags, free-text code filters, and an "unused only" view.
- **Guarded Deletion**: Added a per-row delete action that mirrors the server's hard-delete guard; the delete button remains strictly disabled unless the business is completely unused across all metrics.
- **Architecture & Testing**: Extracted pure, dependency-free row mapping, usage merging, and filtering logic into a dedicated, unit-tested `business-rows.ts` module.