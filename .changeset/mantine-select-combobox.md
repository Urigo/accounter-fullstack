---
'@accounter/client': patch
---

Replace Mantine's `Select` with the existing `ComboBox` across 20 call sites in 11 files.

`ComboBox` already matched Mantine's shape — same `data` / `value` / `onChange` / `error` /
`placeholder` / `disabled` — and is always searchable, so most of this is prop removal rather than
translation. Three props were added to it for parity:

- `label`, which Mantine's `Select` rendered itself.
- `form`, to associate the trigger with a form element rendered outside it (the depreciation rows).
- `required`, expressed as `aria-required` since the trigger is a `<button>`.

Props dropped, with reasons:

- `maxDropdownHeight` — `ComboBox`'s list sizes itself.
- `searchable` — `ComboBox` always is.
- **`withinPortal` and `zIndex={1002}`** — `ComboBox` portals through `usePortalContainer`, so the
  stacking workaround added when the depreciation dialog became a Radix dialog is no longer needed.
  Those were the last `zIndex` overrides in the client.
- `error` at sites already inside a `FormControl`, where `FormMessage` renders the message and
  `ComboBox` would have duplicated it. The now-unused `fieldState` bindings went with it.

Two call sites needed real changes rather than prop edits:

- `charts/monthly-income-expense/chart-filter.tsx` passed a bare `Currency[]`; `ComboBox` takes
  `{ value, label }`. Its `defaultValue={Currency.Usd}` moved onto the `Controller`, since
  `ComboBox` is controlled and would otherwise have lost the default.
- `common/forms/edit-charge.tsx` used `rightSection` to place an "insert business trip" modal beside
  the field. `ComboBox` has no such slot, so the modal is now a sibling in a flex row.

`components/charts` is Mantine-free and joins the ESLint rule's `error` list.

`ComboBox`'s standalone error message is also now wired up: the trigger carries `aria-invalid` and
an `aria-describedby` pointing at the message, matching `NumberInput` and the period pickers. Inside
`formPart` the surrounding `FormControl` already does this, which is why `error` is not passed there.

`ComboBox`'s trigger is also realigned to match the Mantine `Select` it replaces: the selected
value sits on the left and the chevron on the right, rather than both centred together.

The trigger already asked for `justify-start`, but never got it. `Trigger` left `className` inside
`...triggerProps`, spread *after* its own `className` — and both `PopoverTrigger` and
`DrawerTrigger` pass a `className` down through `asChild`. The trigger's layout classes were
therefore replaced on every render, and the Button fell back to its base `justify-center`.
`className` is now destructured and merged with `cn()`, the value renders in a truncating span so a
long option cannot push the chevron off the edge, and the layout is covered by tests.

Mantine imports: 75 → 68, across 74 → 67 files.
