---
'@accounter/client': patch
---

Replace Mantine's `MonthPickerInput` and `YearPickerInput` with local Tailwind pickers, removing
`@mantine/dates` entirely.

Unlike the previous cluster, there was nothing to swap to: `ui/calendar.tsx` wraps react-day-picker,
which selects **days** and has no month-only or year-only mode. So this adds the two grids:

- `ui/period-picker.tsx` — `MonthPicker` (twelve months, year navigation) and `YearPicker` (a page of
  twelve years, page navigation), plus the `startOfMonth` / `startOfYear` normalisers.
- `common/inputs/period-picker-input.tsx` — the input-and-popover shell both pickers share. It
  mirrors `date-picker-input.tsx`, including the `usePortalContainer` handling, without which the
  grid is unusable inside a `PopUpDrawer` (the popover would portal outside the drawer's focus
  scope). `common/inputs/{month,year}-picker-input.tsx` are thin wrappers over it.

All three Mantine selection modes are carried over as a discriminated union on `type`: single,
`multiple` (the reference-years filters) and `range` (the salaries filter). Values stay as `Date`
rather than the `TimelessDateString` used by `DatePickerInput`, because every call site already
thinks in `Date` — converting at the boundary would have rewritten a dozen unrelated handlers.

Behavioural notes:

- **Six `onChange` handlers were silently unsound and are now fixed.** They were typed
  `(date: Date) => void` and dereferenced `date.getFullYear()` immediately; Mantine's own typings
  admitted `null` when the field is cleared, so each was a latent crash. The new props type is
  `(value: Date | null) => void`, which surfaced all six at compile time — they now guard.
- The field is **read-only**: a month or year is quicker to click than to type, and free text would
  need a separate parser per granularity. `DatePickerInput` remains typeable.
- `popoverProps={{ withinPortal: true }}` is dropped from all 14 call sites — that was Mantine
  portal plumbing, and `usePortalContainer` handles it now. `numberOfColumns={2}` is dropped too:
  the month grid always shows one year.

Date bounds are compared at each grid's own granularity: `YearPicker` collapses `minDate`/`maxDate`
with `startOfYear`, `MonthPicker` with `startOfMonth`. Using month granularity for both would have
disabled the year 2010 for a `minDate` of 15 June 2010, even though that year still contains
selectable dates. Covered by `ui/__tests__/period-picker.test.tsx`.

Mantine imports: 91 → 77, across 84 → 76 files. `@mantine/dates` is uninstalled; `@mantine/core`,
`@mantine/dropzone` and `@mantine/carousel` remain.
