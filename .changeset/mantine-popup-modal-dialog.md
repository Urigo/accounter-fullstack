---
'@accounter/client': patch
---

Replace Mantine's `Modal` with the shadcn `Dialog` behind `PopUpModal`, migrating all twelve filter
dialogs plus three screens that used Mantine's `Modal` directly.

`common/modals/modal.tsx` now wraps `ui/dialog.tsx`. Because every `*-filters.tsx` screen goes
through this wrapper, one file change moves all twelve; the three direct users
(`charges/charge-actions-menu.tsx` with two dialogs, `common/modals/edit-tag-modal.tsx`,
`common/merge-businesses/index.tsx`) now go through it too, which clears Mantine from those files
entirely.

Notes:

- **Dismissal was the risk, and is preserved.** `withCloseButton` defaults to `false`, so most
  filter dialogs offer no visible close control and rely on Escape and outside-click — both of which
  Radix's `Dialog` provides. The prop maps onto `DialogContent`'s existing `showCloseButton`.
- **Radix requires an accessible name.** No call site passes a title, and an unnamed dialog makes
  Radix warn at runtime, so the wrapper renders an `sr-only` header when no `title` is given.
- `modalSize` is kept and translated from Mantine's size vocabulary to a max-width class
  (`xl` → `sm:max-w-3xl`, `auto`/`fit-content` → `sm:max-w-fit`). Three filter dialogs use `xl`.
- The wrapper gains `children`, `onClick` and `description`. `children` was previously declared but
  never rendered — the three newly-migrated files pass children rather than `content`, and
  `charge-actions-menu.tsx` needs `onClick` to stop click-through to the row beneath.
- Mantine's `centered` and `withinPortal` props are dropped: Radix dialogs are centred and portaled
  by default.

`PopUpModal` takes its body as `children` only — the old wrapper declared both `content` and
`children`, which were two names for the same slot (and `children` was never actually rendered). All
thirteen call sites now pass children.

**Nested dialogs restack correctly.** Radix's `DialogContent` sits at `z-1001` while Mantine v6's
`Modal` defaults far below it, so any Mantine modal opened *from inside* a converted dialog rendered
behind it. That affected the Depreciation dialog, whose `AddDepreciationRecord` child is a Mantine
`Modal` — it is now a `PopUpModal` too, and nested Radix dialogs stack by portal order. The same
applies to Mantine dropdowns portaled to the body: the four `withinPortal` `Select`s under
`common/depreciation/` now pass `zIndex={1002}`, matching the fix already present in
`charge-spread-input.tsx`.

The dialog now carries `max-h-[90vh] overflow-y-auto`, matching the 17 other `DialogContent` sites
that do — several filter forms are taller than the viewport, and Mantine's `Modal` scrolled its body
by default. `merge-businesses` gains an explicit title so it is not announced as "Filters", and
`edit-tag-modal`'s title is corrected from "Insert Business Trip" (a pre-existing mislabel) to
"Edit Tag".

Mantine imports: 101 → 97, across 94 → 90 files. The remaining `Modal` users all sit in
`business-trip-report/buttons/` and `depreciation/`, which carry other Mantine imports too and
belong to their own cluster.
