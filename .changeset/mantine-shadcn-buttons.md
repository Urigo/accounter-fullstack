---
'@accounter/client': patch
---

Replace the last remaining Mantine button-role components with shadcn equivalents. The charge
actions menu and the business trip toggle menu now use a shadcn `DropdownMenu` with a ghost icon
`Button` trigger instead of Mantine's `Menu` + `Burger`, matching the existing
`ChargesBatchActionsMenu`. Deleting a charge from the menu now opens a controlled
`ConfirmationModal` rather than wrapping the menu item in a dialog trigger. `ChargeLink` renders a
router `Link` styled with `Button asChild variant="link"` in place of Mantine's `NavLink`, keeping
proper link semantics for screen readers, middle-click and context menus.
