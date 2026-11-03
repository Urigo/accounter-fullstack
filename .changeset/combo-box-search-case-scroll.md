---
'@accounter/client': patch
---

Searchable selects (`ComboBox`, the currency picker and `MultiSelect`) now match case-insensitively
on option labels and descriptions only (no longer fuzzy-matching internal ids), rank prefix matches
first, and scroll back to the top of the list as you type. Results keep a stable order: equally good
matches stay in the original list order regardless of earlier searches, and clearing the search
restores the full list in its original order. While searching, `MultiSelect` hides "Select All",
since it would also select options hidden by the search. In `NegatableMultiSelect`, "Select All" /
"Select all visible" is now a toggle: its checkbox is checked when every visible option is
selected, unchecks as soon as one of them is, and clicking it again deselects all visible options.
Financial entities are sorted case-insensitively.
