---
'@accounter/server': patch
---

- **Database Schema Refactor**: A new table, `financial_bank_accounts`, has been introduced to
  specifically store bank account details, separating them from the general `financial_accounts`
  table. A migration is included to populate this new table with existing bank account data.
- **New GraphQL Module for Bank Accounts**: A dedicated GraphQL module, provider, and resolvers have
  been created for `financial-bank-accounts`, allowing for more granular management and querying of
  bank account-specific data.
- **Updated Financial Accounts Provider**: The existing `FinancialAccountsProvider` queries have
  been updated to explicitly select core financial account fields, as bank-specific details are now
  handled by the new `FinancialBankAccountsProvider`.
