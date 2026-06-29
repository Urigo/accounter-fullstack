# Business Management Screen

## Context

Businesses (`accounter_schema.businesses` + `financial_entities`) accumulate over time — many are
auto-generated from transactions (`batchGenerateBusinessesOutOfTransactions`), some are duplicates,
some are missing essential categorization (sort code, tax category, IRS code), and some are never
used. The current `/businesses` screen is a simple card list that only shows the business header and
supports name-search + merge selection. It gives no way to audit completeness, spot unused
businesses, batch-fix details, or delete dead records.

This plan adds a table-based **Business Management Screen** to review every business, see which
essential fields are filled, track usage across transactions/documents/misc-expenses/ledger, and
merge / delete / batch-update from one place.

## Decisions (defaults — adjust at approval)

- **Placement:** replace the existing card list at `/businesses` with the table screen (single
  source of truth). The detail route (`/businesses/:id`) is untouched.
- **Usage counts:** lazy / opt-in. Usage columns are hidden by default; counts are fetched via a
  separate batched query only when the user enables them. Keeps the default table fast.
- **Mutations:** reuse existing `mergeBusinesses`; add a new `batchUpdateBusinesses` mutation and
  expose a `deleteBusiness` mutation wrapping the existing `deleteBusinessById` provider.

## Column groups (visibility toggle; default = Core + Main + Extension tags)

- **Core:** name + hebrewName, link to business page (`ROUTES.BUSINESSES.DETAIL(id)`)
- **Main:** locality (country/city/zip), governmentId (VAT), createdAt, updatedAt
- **Categorization:** sortCode, taxCategory, irsCode, pcn874RecordType
- **Extension tags:** isClient, isAdminOwner, isInactive (badges)
- **Suggestion defaults:** description, tags
- **Usage (lazy):** totalTransactions, totalDocuments, totalMiscExpenses, totalLedgerRecords

---

## Server changes (`packages/server/src/modules/financial-entities/`)

All edits in the `financial-entities` module. Run `yarn generate` after schema edits.

### 1. Expose missing fields on `LtdFinancialEntity` / `Business`

`typeDefs/businesses.graphql.ts` already exposes most fields. **Add what the table needs but is
missing:**

- `sortCode: Int` on `LtdFinancialEntity` — field resolver returns `sort_code` from
  `financial_entities` (already on the DB row joined in `getBusinessesByIds`).
- `taxCategory: TaxCategory` (or its `id`/`name`) — resolve via
  `TaxCategoriesProvider.taxCategoryByBusinessIDsLoader` (already exists).
- `isClient: Boolean!` — resolve via `ClientsProvider.getClientByIdLoader` (non-null ⇒ true).
- Owner/admin flag (`isAdminOwner`): derive from `owner_id` / admin-business presence
  (`AdminBusinessesProvider.getAdminBusinessByIdLoader`). Confirm exact semantics during
  implementation; `isActive` already exists for the inactive badge.

Add field resolvers in `resolvers/businesses.resolver.ts` (or `common.ts` where the other
`LtdFinancialEntity` field resolvers live), following the existing batched-loader pattern.

### 2. Usage counts (lazy, batched)

Add a usage type + query in a new typeDef file (e.g. `typeDefs/businesses-usage.graphql.ts`) or
extend `businesses.graphql.ts`:

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

Add a `BusinessUsageProvider` (`providers/businesses-usage.provider.ts`, `@Injectable()`, inject
`TenantAwareDBClient`) with one grouped query per source table, returning counts per id. Where a
business id can appear in multiple columns, project each id-bearing column into a common
`business_id` via `UNION ALL` before grouping (a single `OR ... GROUP BY business_id` would not
attribute counts to the correct id):

- `transactions` → `WHERE business_id = ANY($ids) GROUP BY business_id`
- `documents` → `UNION ALL` of `debtor_id` and `creditor_id` rows (each `WHERE <col> = ANY($ids)`),
  then `GROUP BY business_id`
- `misc_expenses` → same `debtor_id`/`creditor_id` `UNION ALL` pattern
- `ledger_records` → `UNION ALL` of `debit_entity1/2` and `credit_entity1/2` rows, then `GROUP BY
  business_id`

(Table/column names confirmed by the `replaceBusiness` merge query in `businesses.provider.ts`.)
Resolver assembles the four maps into `BusinessUsage` rows.

### 3. `deleteBusiness` mutation

`BusinessesOperationProvider.deleteBusinessById(businessId)` already exists with guards (employee /
pension fund / trip attendee / dividends) and cleans up `clients`,
`business_tax_category_match`, etc. Expose it:

```graphql
extend type Mutation {
  deleteBusiness(businessId: UUID!): Boolean!
    @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
}
```

Resolver in `businesses.resolver.ts` calls the provider and surfaces its guard errors. The
"only-if-unused" rule (no transactions/docs/misc/ledger) is enforced client-side by disabling delete
when usage > 0; the provider remains the hard backstop.

### 4. `batchUpdateBusinesses` mutation

Add a batch variant of the existing `updateBusiness` for the shared, batch-safe fields only
(locality, categorization, suggestion description/tags):

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
    @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
}
```

Resolver reuses the existing single-business update logic (`BusinessesProvider.updateBusiness`,
`FinancialEntitiesProvider.updateFinancialEntity`, `TaxCategoriesProvider.updateBusinessTaxCategory`)
applied per id. Extract the per-business update body of the current `updateBusiness` resolver into a
shared helper so both mutations call it.

---

## Client changes (`packages/client/src/`)

### Files

- `components/businesses/index.tsx` — rewrite as the table screen (replaces card list).
- `components/businesses/columns.tsx` — `ColumnDef[]` incl. selection checkbox + grouped columns.
- `components/businesses/businesses-table.tsx` — `useReactTable` wiring + render (optional split).
- `components/businesses/batch-update-dialog.tsx` — form for batch fields.
- `components/businesses/businesses-filters.tsx` — extend existing filters (sort-code / tax-category
  / flags / "unused only").
- `hooks/use-delete-business.ts`, `hooks/use-batch-update-businesses.ts` — new mutation hooks.
  (`use-merge-businesses` / `MergeBusinessesButton` already exist — reuse.)

### Patterns to reuse

- **Table:** `@tanstack/react-table` with `getCoreRowModel` + `getSortedRowModel` +
  `getFilteredRowModel`, `VisibilityState`, `RowSelectionState`. Closest example to copy:
  `components/charge-matches/index.tsx` (selection column, merge button, column-visibility dropdown
  at lines ~186-209) and `components/documents-table/` (sorting/visibility). Sortable headers:
  `components/common/data-table-column-header.tsx`. Base table primitives: `components/ui/table.js`.
- **Query:** replace the `AllBusinessesForScreen` document in `index.tsx` — add the new fields
  (`sortCode`, `taxCategory`, `isClient`, owner/admin flag, `suggestions { description tags }`) to
  the `LtdFinancialEntity` selection. The `allBusinesses` query already supports `page/limit/name`;
  rich filtering/sorting is done client-side over the loaded page (pagination optional per request).
- **Usage:** second `useQuery` against `businessesUsage(ids: …)`, run with `pause: true` until the
  user enables a usage column; merge counts into rows by id.
- **Mutations:** wrap each in a `src/hooks/` hook (`useMutation` + `handleCommonErrors` + `sonner`
  toast), per `hooks/use-merge-charges.ts` and the client CLAUDE.md rule (never call `useMutation`
  in a component).
- **Column visibility default:** Core + Main + Extension tags visible; Categorization, Suggestion
  defaults, and Usage hidden initially (persisted in component state).
- **Row actions:** checkbox selection drives the existing `MergeBusinessesButton`, a batch-update
  button (opens dialog), and per-row delete (disabled when usage > 0, with an `alert-dialog`
  confirm).
- **Layout:** keep `PageLayout` with `headerActions` (InsertBusiness) and the `FiltersContext`
  footer, as in the current `index.tsx`.

---

## Verification

1. `yarn generate` — schema/codegen succeeds; new types appear in `src/gql/` and server
   `__generated__/types.ts`.
2. `yarn workspace @accounter/server build` and `yarn lint`.
3. Server unit/integration: add a test for `BusinessUsageProvider` counts and the `deleteBusiness`
   guard path (`yarn test` / `yarn test:integration`).
4. Manual (GraphQL at `:4000/graphql`): run `businessesUsage(ids:[…])`, `batchUpdateBusinesses`,
   `deleteBusiness` (confirm guard error when the business has transactions); verify
   `allBusinesses` returns the new fields.
5. Manual UI (`yarn client:dev` + `yarn server:dev`): open `/businesses` — toggle column groups,
   sort/filter, filter "unused only", select rows → merge, batch-update, and delete an unused
   business; confirm toasts and that the table refetches.
