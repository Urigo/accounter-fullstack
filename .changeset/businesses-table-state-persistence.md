---
'@accounter/client': patch
---

Persist the businesses table's column selection, sorting and row selection.

Column visibility and sorting were plain component state, so both were lost on a page refresh. Row
selection had two separate problems: it lived in the component, so navigating away from the screen
and back dropped it, and `selectedIds` was derived from the *filtered* rows, so a row selected under
one filter disappeared from the batch-action buttons as soon as the filters changed.

Column visibility and sorting now persist to `localStorage` and survive a refresh. Stored values are
revived defensively, since an entry may have been written by an older build: sorting is accepted only
when every entry has the `{ id, desc }` shape, and column visibility is merged over the current
defaults so a column added since the value was stored keeps its default rather than disappearing.

Row selection is instead kept in a module-level store — it survives navigation and filter changes,
but a page refresh starts from a clean slate (`sessionStorage` would have survived the refresh too).
`selectedIds` now derives from the unfiltered row set, so a selection made under one filter is still
there after the filter changes; ids of rows that no longer exist drop out on their own.

Adds two reusable hooks for this: `usePersistentState` (`useState` mirrored to `localStorage`, with a
`revive` callback to validate and merge a stored value, and re-hydration when the storage key
changes) and `useEphemeralState` (`useState` backed by a module-level store, surviving unmount but
not a page load). Both guard every storage access, so a disabled or full `localStorage` degrades to
the fallback instead of crashing the screen.
