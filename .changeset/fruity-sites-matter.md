---
'@accounter/client': patch
---

- **Refactored Actions Column**: The logic for displaying action buttons (edit, charge) in the
  transactions table has been extracted from the main `columns` array into a new, dedicated
  `actionsColumn` definition, improving modularity.
- **Conditional Actions Column Rendering**: The newly created `actionsColumn` is now conditionally
  added to the transactions table. It will only appear if either `enableEdit` or `enableChargeLink`
  props are true, making the table more dynamic and adaptable.
