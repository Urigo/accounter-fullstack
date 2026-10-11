---
'@accounter/client': patch
---

Fix back / forward on the businesses page filter. Going back to the entry the page was loaded on now
restores that entry's filter; it used to keep showing the newer one. Opening a link whose filter is
spelled differently from the page's own (another key order, `null` values, an invalid parameter) now
tidies the URL in place instead of adding a duplicate history entry.

The URL filter handling behind it is now shared, so other pages can adopt it: `decodeFilters` next
to `encodeFilters`, `normalizeFilter` / `areFiltersEqual` for comparing filters regardless of key
order or unset values, and a `useUrlFilterState(param, schema)` hook.
