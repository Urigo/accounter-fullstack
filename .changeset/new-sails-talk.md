---
'@accounter/client': patch
---

- **Transaction Download Feature**: Introduced a new `DownloadCSV` component and integrated it into
  the `TransactionsSection` and `ExtendedTransactionsCard` to allow users to download transaction
  data as a CSV file.
- **GraphQL Query Enhancements**: Updated GraphQL queries in relevant components to include a new
  `TransactionToDownloadForTransactionsTableFields` fragment, ensuring all necessary data is
  available for CSV export.
- **Financial Account Type Refactoring**: Standardized the handling of financial account types by
  transitioning from `__typename` to the explicit `type` field in GraphQL queries and component
  logic (e.g., `EditTransaction`, `SimilarTransactionsModal`).
- **Improved Account Display**: Enhanced the display of account types in transaction tables
  (`cells-legacy/account.tsx`, `cells/account.tsx`) by using helper functions
  (`getAccountTypeLabel`, `getAccountIcon`) and adding tooltips for better user experience.
