---
'@accounter/client': patch
'@accounter/server': patch
---

- **New Charge Matching UI**: A comprehensive frontend has been introduced for displaying and
  interacting with charge matches, including dedicated cell components for various data types like
  business, date, tags, tax category, and charge type.
- **Charge Matches Table Implementation**: A new `ChargeMatchesTable` component has been implemented
  using `@tanstack/react-table`, featuring sorting, column visibility, and integration with a
  `MergeChargesButton`.
- **Integration with Extended Charge Info**: The new charge matches table is now conditionally
  displayed within the `ChargeExtendedInfo` component, appearing when a charge is missing accounting
  documents or transactions.
- **GraphQL Schema and Resolver Updates**: The `ChargeMatch` GraphQL type has been extended to
  include the full `Charge` object, and a corresponding resolver was added on the backend to fetch
  this related charge data.
- **Reusable UI Components**: New generic `DataTableColumnHeader` and `Score` components were
  developed to standardize table headers and score visualizations across the application, promoting
  consistency and reusability.
- **Improved Merge Charges UX**: The `MergeChargesButton` now requires at least two charges to be
  selected for merging and utilizes a more modern Shadcn `Dialog` component with tooltips for better
  user guidance and clarity.
