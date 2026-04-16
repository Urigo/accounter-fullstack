---
'@accounter/client': patch
---

- **Date Picker Input Refactoring**: The `DatePickerInput` component has been significantly
  refactored to improve its internal state management, ensuring proper propagation of selected dates
  and correct display upon reopening the calendar. It now uses `InputGroup` components for better
  structure and accessibility.
- **Standardized Form Field Usage**: Across numerous components, date input fields and other form
  elements have been migrated to use `shadcn/ui`'s `FormItem`, `FormLabel`, `FormControl`, and
  `FormMessage` components. This standardizes form rendering, enhances accessibility, and improves
  maintainability.
- **Consolidated Date Picker Component**: The custom `DatePickerInput` component has been moved and
  is now consistently used across various forms, replacing previous implementations that sometimes
  relied on `@mantine/dates` directly. This centralizes date input logic and styling.
