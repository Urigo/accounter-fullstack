---
'@accounter/client': patch
'@accounter/server': patch
---

- **Table Refactoring**: The VAT report's expenses and income tables have been refactored to utilize
  the `@tanstack/react-table` library, replacing custom table rendering logic.
- **New Column Definitions**: Dedicated `columns.tsx` files were introduced for both expenses and
  income sections, centralizing column configurations and enabling features like sorting and row
  expansion.
- **Improved Table Functionality**: The refactoring introduces advanced table features such as
  sorting, column visibility management, and expandable rows for detailed charge information.
- **GraphQL Schema Update**: The `VatReportRecord` GraphQL type and its resolver were updated to
  include an `allocationNumber` field, which is now displayed in the tables.
- **Code Simplification**: The previous `expenses-row.tsx` and `income-row.tsx` components have been
  removed, as their rendering logic is now handled directly within the `expenses-table.tsx` and
  `income-table.tsx` components using `react-table`'s `flexRender`.
