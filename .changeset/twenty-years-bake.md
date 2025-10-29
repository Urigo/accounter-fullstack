---
'@accounter/client': patch
'@accounter/server': patch
---

- **Renaming and Restructuring**: Key components and routes related to "Business Transactions" have
  been renamed to "Business Ledger Records" and moved into a new `business-ledger` directory,
  improving clarity and organization.
- **New Business Detail Tabs**: The business detail page now features new dedicated tabs for
  "Ledger" and "Balance", providing a more structured view of financial data.
- **Enhanced Ledger and Transaction Tables**: Both the `LedgerTable` and `TransactionsTable`
  components have been updated with pagination, improved sorting capabilities, and clearer column
  headers for better user experience.
- **API Expansion**: New GraphQL queries and resolvers have been introduced on the server-side to
  support fetching ledger records and transactions specifically by financial entity, catering to the
  new UI structure.
