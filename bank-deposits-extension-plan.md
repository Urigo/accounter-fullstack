# Bank Deposits Feature Extension Plan

## Overview

Add comprehensive bank deposits management with specialized transaction tables, deposits listing
screen, and deposit assignment capabilities.

## Implementation Steps

### 1. Create Dedicated Bank Deposits Transaction Table Component

**File**: `packages/client/src/components/bank-deposits/deposits-transactions-table.tsx`

**Features**:

- Columns: date, deposit/withdrawal indicator, origin currency amount, origin currency cumulative
  balance, local currency amount, local currency cumulative balance
- Calculate cumulative balances client-side by iterating through sorted transactions
- Convert to local currency per-row using transaction's exchange rate data

---

### 2. Extend Server-Side GraphQL Schema

**File**: `packages/server/src/modules/bank-deposits/typeDefs/bank-deposits.graphql.ts`

**New Query**:

```graphql
allDeposits: [BankDeposit!]! @auth(role: ACCOUNTANT)
```

**Extended BankDeposit Type**:

- `id: ID!`
- `currency: Currency!`
- `openDate: TimelessDate!` (first transaction eventDate)
- `closeDate: TimelessDate` (last transaction eventDate where running balance reaches zero, null if
  open)
- `currentBalance: FinancialAmount!`
- `isOpen: Boolean!`
- `currencyError: [UUID!]!` (transaction IDs violating single-currency rule)
- `transactions: [Transaction!]!`
- `balance: FinancialAmount!`

**New Mutations**:

```graphql
createDeposit(currency: Currency!): BankDeposit! @auth(role: ACCOUNTANT)
assignTransactionToDeposit(transactionId: UUID!, depositId: String!): BankDeposit! @auth(role: ACCOUNTANT)
```

---

### 3. Implement Server Resolvers and Providers

**Files**:

- `packages/server/src/modules/bank-deposits/providers/bank-deposit-transactions.provider.ts`
- `packages/server/src/modules/bank-deposits/resolvers/bank-deposit-transactions.resolver.ts`

**New Provider Methods**:

- `getAllDepositsWithMetadata()`: Aggregate from `transactions_bank_deposits` joined with
  `transactions`
  - Validate single currency per deposit
  - Identify violating transaction IDs
  - Calculate derived dates and balances
- `createDeposit(currency)`: Insert unique deposit_id with currency metadata

- `assignTransactionToDeposit(transactionId, depositId)`:
  - Update transaction's deposit_id
  - **Validate**: Block reassignment if transaction currency conflicts with target deposit currency
  - Return GraphQL error with descriptive message on conflict
  - **Auto-recalculate**: After successful assignment, automatically recalculate and return updated
    deposit metadata (dates, balances, isOpen status)

**Resolver Updates**:

- Wire up new query/mutations in `bankDepositTransactionsResolvers`
- Leverage existing `ExchangeProvider` for per-transaction local currency conversion

---

### 4. Create Deposits List Screen

**File**: `packages/client/src/components/bank-deposits/deposits-screen.tsx`

**Features**:

- Use `@tanstack/react-table` with expandable rows pattern (similar to `documents-table`)
- **Columns**: deposit ID, currency, status (open/closed badge using `Badge` from `ui/badge.js`),
  open date, close date, current balance
- **Currency Error Display**: Show `Alert` banner with `variant="destructive"`,
  `AlertTitle: "Currency Conflict"`, `AlertDescription` listing affected transaction IDs if
  `currencyError.length > 0`
- **Row Expansion**: Render shared deposits transactions table on expansion

**Route Configuration**:

- Add to `packages/client/src/router/routes.ts`:
  ```typescript
  BANK_DEPOSITS: {
    ROOT: '/bank-deposits',
    ALL: '/bank-deposits'
  }
  ```
- Create loader in `packages/client/src/router/loaders/`

**Navigation**:

- Update main navigation sidebar
- Add Bank Deposits link under "Financial Accounts" parent section

---

### 5. Update ChargeBankDeposit Component

**File**: `packages/client/src/components/charges/extended-info/bank-deposit.tsx`

**Changes**:

- Replace `TransactionsTable` with shared deposits transactions table

**No Deposit Found Case**:

- Add `Select` component (from `ui/select.js`) populated via `allDeposits` query filtered by
  `isOpen=true`
- Add `Button` "Create New Deposit" triggering `Dialog` with:
  - Currency selector using `Select` with `Currency` enum values
  - Calls `createDeposit` mutation
- New deposits remain unassigned until user explicitly picks from dropdown
- Confirm assignment via `assignTransactionToDeposit` mutation
- Show success/error toast notifications using existing toast patterns
- Display server-side validation errors when currency conflicts occur

---

### 6. Add Shared Deposits Transactions Component

**File**: `packages/client/src/components/bank-deposits/shared-deposits-transactions-table.tsx`

**Props**:

- `depositId: string` (required)
- `enableReassign?: boolean` (optional)
- `refetchDeposits?: () => void` (optional)

**Features**:

- Query enhanced `BankDeposit.transactions` including:
  - `amount`, `currency`, `eventDate`
  - Embedded exchange rate data (reuse `TransactionForTransactionsTableFields` fragment pattern)
- Calculate cumulative origin and local balances in `useMemo`
- Apply per-transaction currency conversion
- Use `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` from `ui/table.js`
- Show `Loader2` with `animate-spin` while `fetching`

**Reassignment Feature** (when `enableReassign=true`):

- Add actions column with `Button` to trigger reassignment dialog
- Show deposit selector in dialog
- Handle server validation errors gracefully
- Refresh both source and target deposits on success

---

## Technical Decisions

### Currency Handling

- **Single currency per deposit**: Each deposit can hold only one currency
- **Validation**: System treats multiple currencies in a single deposit as an error
- **Display**: Show both origin currency and local currency in tables

### Date Derivation

- **Open date**: Derived from first transaction date
- **Close date**: Derived from last transaction date where balance reaches zero
- **Auto-calculation**: No manual date management required

### Transaction Reassignment

- **Allowed**: Transactions can be reassigned between deposits
- **Validation**: Block reassignment if currency conflicts with target deposit
- **Auto-recalculation**: Server automatically recalculates deposit metadata after reassignment
- **No audit trail**: No historical tracking of reassignments needed

### Authorization

- **Role**: All deposit management operations require `ACCOUNTANT` role
- **Applied to**: `allDeposits` query, `createDeposit` mutation, `assignTransactionToDeposit`
  mutation

### Deposit Lifecycle

- **Creation**: Deposits created empty, await explicit transaction assignment
- **Deletion**: Not supported - deposits remain in system as historical records
- **Status**: Automatically derived from transaction balances

---

## Component Patterns to Follow

### UI Components

- Use shadcn/ui components (`Button`, `Select`, `Dialog`, `Table`, `Alert`, `Badge`)
- Prefer core Tailwind utility classes
- Follow existing patterns from `documents-table` and `transactions-table`

### Error Handling

- Loading states: `Loader2` with `animate-spin`
- Error states: `Alert` with `variant="destructive"`
- Toast notifications for mutation results

### GraphQL Integration

- Use `useQuery` for data fetching
- Use `useMutation` for mutations
- Follow fragment patterns from existing tables

### Performance

- Use `useMemo` for expensive calculations (cumulative balances)
- Use `useCallback` for event handlers

---

## Database Schema Reference

**Table**: `accounter_schema.transactions_bank_deposits`

- `id` (UUID, references transactions)
- `deposit_id` (text, nullable)

**Key Operations**:

- Join with `transactions` table for full transaction data
- Group by `deposit_id` for aggregation
- Validate currency consistency within groups
- Calculate running balances for open/close status
