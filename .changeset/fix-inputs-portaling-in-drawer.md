---
"@accounter/client": patch
---

Fix form inputs being unusable inside `PopUpDrawer` (e.g. the Edit Charge, Edit Transaction and Edit
Document modals). The drawer's underlying Radix Dialog is always modal and traps focus, so overlays
portaled to `document.body` could not be focused and clicking them was treated as an "outside"
interaction that closed the drawer.

Following the same portal-container approach already used by `ComboBox`, these inputs now portal
their overlays into the drawer's content element when one is present (and keep the default
`document.body` portaling everywhere else):

- `MultiSelect` — the tags input's options list and search were unclickable and clicking outside the
  options closed the drawer (fixes #4040); its overflow tooltip now portals into the layer too.
- `DatePickerInput` — the calendar's day buttons could not be clicked and closed the drawer.
- Currency inputs (`CurrencyCodeInput` / currency search) — the currency select and search popover.
- The financial-entity / document-type `Select`s in the Edit Transaction and document field forms.

The shared `Select` and `Tooltip` UI primitives now accept an optional `container` prop to enable
this.
