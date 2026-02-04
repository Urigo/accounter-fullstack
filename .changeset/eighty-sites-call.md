---
'@accounter/client': patch
'@accounter/server': patch
---

- **Swift Code Integration**: This PR introduces the 'swiftCode' field to financial bank accounts,
  enhancing the system's ability to manage international banking details.
- **Schema and UI Updates**: The changes include updates to the financial account schema, UI
  components, and database migrations to accommodate the new 'swiftCode' field.
- **Database Migration**: A new migration script is added to update the 'financial_bank_accounts'
  table with a 'swift_code' column.
