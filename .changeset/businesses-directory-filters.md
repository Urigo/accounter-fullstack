---
'@accounter/server': minor
'@accounter/client': minor
---

Filter the businesses directory server-side. `allBusinesses` takes a new `filters: BusinessFilter`
input, applied in SQL before the count and the page slice:

- `name`: case-insensitive substring of the name or Hebrew name
- `taxCategoryIds` / `withoutTaxCategory` and `sortCodes` / `withoutSortCode`: a list match OR-ed
  with a "has none" match, to find uncategorized businesses
- `countries` (the table's Locality), `isClient`, `isActive` and `isAdmin`

The top-level `name` and `isClient` arguments are deprecated in favour of `filters.name` and
`filters.isClient`. They keep working for now; a field present in `filters`, even as an explicit
`null`, wins over its same-named argument.

The businesses page replaces its inline filter bar with a name search in the toolbar and a Filters
dialog (tax category, sort code and country multi-selects, Any / Yes / No for client, active and
admin, and "Unused only"). The applied filter is persisted in the `businessesFilters` URL parameter,
so filtered views can be linked to, reloaded, and walked with back / forward. A business selected
under one filter stays selected when a later filter hides it.
