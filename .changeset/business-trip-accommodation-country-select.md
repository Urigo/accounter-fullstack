---
'@accounter/client': patch
---

Replace the free-text country field in the "Add Accommodation Expense" modal with the searchable
`ComboBox`, matching the country picker already used by the issue-document client form.

Options are built once at module scope from the `CountryCode` enum in `helpers/countries.ts`, so the
label is the country name and the submitted value is the ISO alpha-3 code the
`AddBusinessTripAccommodationsExpenseInput.country` field expects. Previously any typed string was
sent through, including values the server could not resolve to a country.
