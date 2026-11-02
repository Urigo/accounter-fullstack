---
'@accounter/client': patch
---

Searchable selects (`ComboBox`, the currency picker and `MultiSelect`) now match case-insensitively
on option labels and descriptions only (no longer fuzzy-matching internal ids), rank prefix matches
first, and scroll back to the top of the list as you type. Financial entities are sorted
case-insensitively.
