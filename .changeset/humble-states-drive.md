---
'@accounter/client': patch
---

- The `modify-financial-account-dialog.tsx` component has been updated to use a simplified
  `taxCategoryId` in its schema, replacing a nested `taxCategory` object.
- A new helper function, `convertToFinancialAccountForm`, was added to correctly map financial
  account data to the form's structure, ensuring proper handling of `taxCategory.id` to
  `taxCategoryId` conversion during editing.
- The `useGetTaxCategories` hook is now integrated to fetch available tax categories, which are then
  presented to the user via a `ComboBox` component for selection, improving user experience and data
  validation.
