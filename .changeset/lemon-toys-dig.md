---
'@accounter/client': patch
'@accounter/server': patch
---

- **Introduced Annual Audit Flow UI**: A new, comprehensive 'Annual Audit Flow' user interface has
  been added, providing a structured, multi-step process for managing yearly financial operations
  and compliance. This includes a progress overview, filtering capabilities, and dedicated steps for
  various audit tasks.
- **New GraphQL API Endpoints for Audit Operations**: New GraphQL queries and mutations were
  implemented on the server-side to support the annual audit flow, including fetching accountant
  approval status for charges, retrieving annual financial charges, and locking ledger records.
- **Enhanced Confirmation Modal and New Hooks**: The `ConfirmationModal` component was enhanced to
  allow external control of its open state, and new React hooks (`useGenerateFinancialCharge`,
  `useLedgerLock`) were introduced to streamline financial charge generation and ledger locking
  operations with integrated toast notifications.
- **Updated Navigation and Routing**: The application's sidebar navigation and routing configuration
  were updated to include the new 'Workflows' section and the 'Annual Audit' page, making the new
  feature accessible.
