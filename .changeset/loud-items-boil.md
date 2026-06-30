---
'@accounter/server': patch
---

- **A1 — `sortCode: Int`**: new field on `LtdFinancialEntity`. The value already rides on the joined
  `financial_entities` row (`sort_code`), so the resolver is a direct mapping.
- **A2 — `taxCategory` returns `null` when unmatched**: the field is nullable, but the resolver
  previously threw a `GraphQLError` when a business had no tax category match. The management screen
  lists every business (including uncategorized, auto-generated ones), so one missing match would
  fail the whole query. Now returns `null`.
- **A3 — `isClient: Boolean!` and `isAdmin: Boolean!`**: simple boolean columns for the client and
  admin/owner extension tags, reusing the loaders that already back `clientInfo`
  (`ClientsProvider.getClientByIdLoader`) and `adminInfo`
  (`AdminBusinessesProvider.getAdminBusinessByIdLoader`).

- **B1 — `BusinessUsageProvider`**: new `@Injectable()` provider
  (`providers/businesses-usage.provider.ts`) exposing
  `getUsageByBusinessIds(ids): Map<id, { transactions, documents, miscExpenses, ledgerRecords }>`.
  One grouped count query per source. For sources where a business can appear in more than one
  column, each id-bearing column is projected into a common `business_id` via `UNION ALL` before
  grouping, so counts attribute to the correct id (a single `OR … GROUP BY business_id` would not):
  - `transactions` → `business_id`
  - `documents` → `debtor_id` ∪ `creditor_id`
  - `misc_expenses` → `debtor_id` ∪ `creditor_id`
  - `ledger_records` → `debit_entity1/2` ∪ `credit_entity1/2`

  Every requested id defaults to zero so unused businesses are represented. Column names confirmed
  against the `replaceBusiness` merge query and the misc-expenses provider.

- **B2 — `businessesUsage` query**: new typeDef + resolver returning `[BusinessUsage!]!`, wired into
  the financial-entities module (typeDef, resolver, provider registration, pgtyped types re-export).

```graphql
type BusinessUsage {
  businessId: UUID!
  totalTransactions: Int!
  totalDocuments: Int!
  totalMiscExpenses: Int!
  totalLedgerRecords: Int!
}
extend type Query {
  businessesUsage(ids: [UUID!]!): [BusinessUsage!]! @requiresAuth
}
```

- **C1 — `deleteBusiness` mutation**: exposes `deleteBusiness(businessId: UUID!): Boolean!`
  (`@requiresAuth`, `@requiresAnyRole(["business_owner", "accountant"])`) wrapping the existing
  `BusinessesOperationProvider.deleteBusinessById`. That provider already validates the business is
  not an employee / pension-or-training fund / business-trip attendee / dividends receiver (throwing
  per case) and cleans up its dependent rows (unbalanced-ledger businesses, balance-cancellation,
  green-invoice client, tax-category match) before deleting the `businesses` row.

  The resolver returns `true` on success; the provider's guard errors propagate as
  GraphQL errors with their original messages. No new guards are added — the provider
  is the hard backstop, and the screen disables delete when usage > 0 (Phase I).

- **D1 — extract `updateSingleBusiness` helper** (refactor, no schema change): the per-business body
  of the `updateBusiness` mutation (core financial-entity fields, business fields, suggestions,
  tax-category match, green-invoice sync) moves into `helpers/update-business.helper.ts`. It returns
  the refreshed business and throws on failure. The `updateBusiness` resolver now wraps the helper
  and maps thrown errors to `CommonError`, preserving observable behavior (the success path is
  byte-for-byte the same; failures keep the `Failed to update business ID="…": …` format).

- **D2 — `batchUpdateBusinesses` mutation**:

  ```graphql
  input BatchUpdateBusinessInput {
    country: CountryCode
    city: String
    zipCode: String
    sortCode: Int
    taxCategory: UUID
    irsCode: Int
    pcn874RecordType: Pcn874RecordType
    suggestions: SuggestionsInput
  }
  extend type Mutation {
    batchUpdateBusinesses(businessIds: [UUID!]!, fields: BatchUpdateBusinessInput!): [Business!]!
      @requiresAuth
      @requiresAnyRole(roles: ["business_owner", "accountant"])
  }
  ```

  The input is the subset of fields safe to apply to many businesses at once (locality,
  categorization, suggestions). The resolver resolves the owner from the admin context and applies
  `updateSingleBusiness` to each id, returning the updated businesses; a failure on any id rejects
  the whole mutation. `BatchUpdateBusinessInput` is a strict structural subset of
  `UpdateBusinessInput`, so it is passed straight to the shared helper.
