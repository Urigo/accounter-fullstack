---
'@accounter/client': patch
---

Fix the crash ("Minified React error #185 — Maximum update depth exceeded") that made the tax
categories and sort codes screens unusable, and that the yearly ledger and all documents screens were
one step away from hitting.

Every screen that publishes a pagination bar into `FiltersContext` listed the `useTable` handle — and,
on the tax categories and sort codes screens, `table.getPageOptions()` — in its footer effect's
dependency array. TanStack Table v9's `useTable` memoizes on the options object literal passed at the
call site, so it hands back a fresh object on every render, and `getPageOptions()` allocates a fresh
array on every call. The effect therefore re-ran on every render, and because `setFiltersContext` is
state owned by the dashboard layout, each run re-rendered the screen — an unbreakable loop.

Those effects now depend on the pagination primitives the bar actually renders from (page index, page
size, page count) rather than on the per-render handles.
