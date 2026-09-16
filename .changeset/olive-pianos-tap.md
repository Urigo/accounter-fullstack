---
"@accounter/client": patch
---

Fix tables silently truncating to 10 rows, including the VAT report's expenses section

The shared TanStack Table v9 feature set registered a paginated row model for every table, so
`getRowModel()` returned only TanStack's default page of 10 rows. Tables that never configured
`initialState.pagination` were capped at ten, and the nine that render no pagination control gave no
way to reach the rest — the VAT monthly report's expenses and income sections, the similar-charges
and similar-transactions modals (where the header "select all" checkbox therefore approved only ten
records), a charge's documents list, charge matches, bank deposits, recent business documents and
the dynamic-report template manager.

Pagination is now opt-in. `tableFeaturesConfig` registers no paginated row model, so it renders every
row; tables that page through their rows use the new `paginatedTableFeaturesConfig` alongside a
pagination control. The all-documents screen, which already had a pagination bar, now opens at a
deliberate 100 rows per page instead of an accidental 10.
