---
'@accounter/client': patch
---

- **UI/UX Enhancement for Accountant Approval**: The `UpdateAccountantStatus` component has been
  significantly refactored from a basic Mantine `Select` to a more interactive and visually
  appealing `DropdownMenu` with custom icons and styling, improving the user experience for changing
  approval statuses.
- **Logic Centralization**: The state update logic for accountant approval, previously handled by
  the parent `AccountantApproval` cell component, has been moved directly into the
  `UpdateAccountantStatus` component. This makes the component more self-contained and simplifies
  its usage.
- **Consistent Filter Display**: The `ChargesFilters` component has been updated to utilize the new
  `accountantApprovalOptions` data structure and a custom `AccountantStatusMultiSelectItem` for
  rendering options within its multi-select filter, ensuring a consistent visual representation
  across the application.
