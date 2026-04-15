---
'@accounter/client': patch
'@accounter/server': patch
---

- **Database Schema Refactoring**: Introduced a dedicated `bank_deposits` table to centralize
  deposit information, moving fields like `account_id` out of the `charges_bank_deposits` junction
  table.
- **GraphQL API Updates**: Updated GraphQL queries and mutations to support the new `bank_deposits`
  structure, including new fields for deposit metadata and improved deposit creation flows.
- **Enhanced Deposit Management**: Added new hooks and logic to better handle relevant deposits for
  charges, including conflict detection and improved assignment workflows.
