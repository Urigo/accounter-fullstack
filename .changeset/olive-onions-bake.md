---
'@accounter/client': patch
'@accounter/server': patch
---

- **Feature Plan Document**: A detailed `bank-deposits-extension-plan.md` is added, outlining the
  scope, implementation steps, technical decisions, and UI/GraphQL patterns for upcoming bank
  deposit management features.
- **Client-Side Transaction Table Components**: New React components are introduced to display bank
  deposit transactions, including individual cells for date, amount, cumulative balances (origin and
  local), and a deposit/withdrawal indicator, laying the groundwork for the UI.
- **Core Deposit Transactions Table**: A `DepositsTransactionsTable` component is added, leveraging
  `@tanstack/react-table` to render transactions for a given deposit, calculate cumulative balances,
  and display loading states.
- **GraphQL Schema Expansion**: The server's GraphQL schema for bank deposits is significantly
  extended with a new `allDeposits` query, `createDeposit` and `assignTransactionToDeposit`
  mutations, and enriched `BankDeposit` type fields (e.g., `currency`, `openDate`, `currentBalance`,
  `currencyError`).
- **Authorization and Error Handling**: All new GraphQL operations are secured with
  `@auth(role: ACCOUNTANT)`, and a minor improvement to error handling in the `deposit` resolver is
  included to re-throw `GraphQLError` instances directly.
- Added ledger generation logic for "breathing deposits" (multi-transaction deposits) with automatic foreign exchange revaluation
