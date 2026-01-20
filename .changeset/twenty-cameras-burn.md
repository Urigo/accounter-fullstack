---
'@accounter/client': patch
'@accounter/server': patch
---

- **VAT Report Summary UI**: Introduced a new summary section at the top of the VAT monthly report,
  providing a high-level overview of key financial figures such as Taxable Sales Total, Taxable
  Sales VAT, Zero/Exempt Sales, Equipment Inputs, and Total VAT Amount.
- **Detailed/Summarized View Toggle**: Added a toggle functionality to the Income and Expenses
  tables, allowing users to switch between a detailed table view and a summarized view grouped by
  'Record Type'.
- **Record Type Column**: Integrated a new 'Record Type' column into the detailed Income and
  Expenses tables, displaying both the raw record type code and its human-readable name.
- **UI Component Refactoring**: Refactored several report components (Business Trips, Expenses,
  Income, Misc, Missing Info) to wrap their content within a `Card` component, enhancing visual
  consistency and structure across the report.
- **Backend and GraphQL Updates**: Extended the GraphQL schema and resolvers to include `recordType`
  and `isProperty` fields for VAT report charges, supporting the new summary and detailed views.
