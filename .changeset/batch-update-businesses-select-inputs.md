---
'@accounter/client': patch
---

Replace the free-text tax category and sort code inputs in the businesses batch-update dialog with
searchable selects.

Tax category previously required pasting a raw UUID; it now uses a `ComboBox` populated from
`useGetTaxCategories()`, matching the Country picker in the same dialog. Sort code previously was a
numeric text input; it now uses the shared `SortCodeSelect`, scoped to the active business from
`UserContext`. Since a selected sort code is always a valid key, the numeric-format guard now only
applies to the IRS code field.

`SortCodeSelect` option labels changed from `key - name` to `name (key)` (searchable by both name
and key), which also applies to its other usages in the business configurations section and the tax
category form.
