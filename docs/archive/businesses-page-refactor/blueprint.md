# Business Management Screen — Implementation Blueprint & Prompt Plan

This document turns [`plan.md`](./plan.md) into an executable, test-driven sequence of steps for a
code-generation LLM. It is organized in three passes:

1. **High-level blueprint** — the major phases.
2. **Iterative chunks** — each phase split into small, safe, build-on-each-other units.
3. **Right-sized steps + prompts** — each chunk decomposed into the smallest steps that still move
   the project forward, with a ready-to-use prompt per step.

Guiding constraints (from the repo + the task):

- Server-first, then client. Schema changes drive codegen, so every server step ends with
  `yarn generate` and a passing build/test.
- No orphaned code: each step wires its output into something already present, and the final steps
  wire the screen together.
- TDD where the repo supports it: provider/resolver logic gets unit/integration tests; UI gets a
  render/interaction test where practical.
- Reuse before building: existing providers (`BusinessesProvider`, `FinancialEntitiesProvider`,
  `TaxCategoriesProvider`, `ClientsProvider`, `AdminBusinessesProvider`,
  `BusinessesOperationProvider`) and existing client patterns (`charge-matches`,
  `data-table-column-header`, `MergeBusinessesButton`, mutation hooks).
- Always run `yarn lint` and `yarn generate` before committing (per CLAUDE.md).

---

## Pass 1 — High-Level Blueprint

| Phase                                     | Outcome                                                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **A. Server: read fields**                | `LtdFinancialEntity` exposes `sortCode`, `taxCategory`, `isClient`, owner/admin flag so the table can render categorization + tags. |
| **B. Server: usage query**                | `businessesUsage(ids)` returns transaction/document/misc-expense/ledger counts, batched.                                            |
| **C. Server: delete mutation**            | `deleteBusiness(businessId)` wraps the existing guarded provider.                                                                   |
| **D. Server: batch update**               | `batchUpdateBusinesses(ids, fields)` reuses extracted single-update logic.                                                          |
| **E. Client: table shell**                | New `@tanstack/react-table` screen replaces the card list with Core/Main columns + selection.                                       |
| **F. Client: column groups + visibility** | Categorization, Extension tags, Suggestion defaults columns + visibility toggle with the right defaults.                            |
| **G. Client: usage columns (lazy)**       | Opt-in usage columns backed by a paused `businessesUsage` query.                                                                    |
| **H. Client: filters & sorting**          | Sortable headers + filters incl. "unused only".                                                                                     |
| **I. Client: actions**                    | Merge (reuse), per-row delete (guarded by usage), batch-update dialog.                                                              |
| **J. Polish**                             | Loading/empty/error states, docs, final lint/generate/build.                                                                        |

Each phase is independently shippable and leaves `main` green.

---

## Pass 2 — Iterative Chunks

- **A1** `sortCode` field + resolver + test.
- **A2** `taxCategory` field + resolver + test.
- **A3** `isClient` + owner/admin flag fields + resolvers + test.
- **B1** `BusinessUsageProvider` with the four counts (provider + integration test).
- **B2** `businessesUsage` typeDef + resolver wiring + test.
- **C1** `deleteBusiness` typeDef + resolver over existing provider + test.
- **D1** Extract per-business update into a shared helper (pure refactor, existing tests stay
  green).
- **D2** `batchUpdateBusinesses` typeDef + resolver calling the helper + test.
- **E1** Table scaffold: query update + columns file (Core/Main) + table component, replacing the
  card list, no actions yet.
- **E2** Row selection column wired to existing `MergeBusinessesButton`.
- **F1** Categorization + Extension tags + Suggestion-defaults columns.
- **F2** Column-visibility dropdown with default-visible groups.
- **G1** Paused `businessesUsage` query + usage columns that trigger fetch on enable.
- **H1** Sortable headers via `data-table-column-header`.
- **H2** Filters: sort-code / tax-category / flags / "unused only".
- **I1** `use-delete-business` hook + guarded per-row delete with confirm dialog.
- **I2** `use-batch-update-businesses` hook + batch-update dialog.
- **J1** States + docs + final verification.

---

## Pass 3 — Right-Sized Steps & Prompts

Conventions for every prompt: work in `packages/server` or `packages/client`; follow the module/
component conventions in the nearest `CLAUDE.md`; use `.js` import suffixes; access providers via
`injector.get(...)`; never edit generated files; run `yarn generate` after any `*.graphql.ts`
change; end each step with `yarn lint` and the relevant tests passing.

---

### Step A1 — `sortCode` field on `LtdFinancialEntity`

```text
In packages/server/src/modules/financial-entities, add a `sortCode: Int` field to the
`LtdFinancialEntity` type in typeDefs/businesses.graphql.ts.

The DB row returned by BusinessesProvider.getBusinessesByIds already joins financial_entities, so
`sort_code` is present on the parent object. Add a field resolver (next to the other
LtdFinancialEntity field resolvers — check resolvers/common.ts and resolvers/businesses.resolver.ts
to find where `country`, `governmentId`, etc. are defined) returning `DbBusiness.sort_code ?? null`.

Run `yarn generate`. Add/extend a resolver unit test asserting sortCode maps from sort_code.
Finish with `yarn workspace @accounter/server build` and `yarn lint` passing.
```

### Step A2 — `taxCategory` field

```text
Add a `taxCategory` field to `LtdFinancialEntity` in
packages/server/src/modules/financial-entities/typeDefs/businesses.graphql.ts. Reuse the existing
`TaxCategory` GraphQL type (check typeDefs/tax-categories.graphql.ts for the exact name/shape).

Resolve it with TaxCategoriesProvider.taxCategoryByBusinessIDsLoader (it already batches by business
id) — load by the business id and return null when none. Place the resolver alongside the other
LtdFinancialEntity field resolvers.

Run `yarn generate`, add a resolver test (loader returns a category vs. undefined), then build and
lint.
```

### Step A3 — `isClient` + owner/admin flag

```text
Add two boolean-ish fields to `LtdFinancialEntity` for the management table:
- `isClient: Boolean!` — true when ClientsProvider.getClientByIdLoader.load(id) resolves to a row.
- an owner/admin flag (e.g. `isAdminOwner: Boolean!`) — derive from admin-business presence via
  AdminBusinessesProvider.getAdminBusinessByIdLoader and/or the owner_id column. First inspect
  admin-businesses.provider.ts and the businesses table's owner_id usage to choose the correct
  semantics, and note the choice in a code comment.

Use the existing batched loaders (no new DB queries). `isActive` already exists for the inactive
badge — do not duplicate it.

Run `yarn generate`, add resolver tests for both flags (present/absent), then build and lint.
```

### Step B1 — `BusinessUsageProvider`

```text
Create packages/server/src/modules/financial-entities/providers/businesses-usage.provider.ts, an
`@Injectable()` provider that injects TenantAwareDBClient (mirror an existing provider's constructor,
e.g. businesses.provider.ts).

Expose `getUsageByBusinessIds(ids: string[]): Promise<Map<string, {transactions, documents,
miscExpenses, ledgerRecords}>>`. Implement four COUNT queries (one per source), each keyed by
business id. Note: for sources where a business id can appear in more than one column, a single
`... OR ... GROUP BY business_id` cannot attribute the count to the right id — project each
id-bearing column into a common `business_id` column with `UNION ALL`, then group:
- transactions: `WHERE business_id = ANY($ids) GROUP BY business_id`
- documents: `UNION ALL` of debtor_id and creditor_id rows, then `GROUP BY business_id`
- misc_expenses: same debtor_id/creditor_id `UNION ALL` pattern
- ledger_records: `UNION ALL` of debit_entity1/2 and credit_entity1/2 rows, then `GROUP BY
  business_id`

Each `UNION ALL` branch filters `WHERE <column> = ANY($ids)`. Confirm exact table/column names from
the `replaceBusiness` UPDATE statements in businesses.provider.ts. Default missing ids to 0. Merge
the four results into one map. (A row touching the same business in two columns is counted once per
column — acceptable for a usage indicator; note it in a code comment.)

Add an integration test (packages/server, integration project) seeding a business with known
counts and asserting the map. Run the integration test, build, and lint.
```

### Step B2 — `businessesUsage` query

```text
Add to packages/server/src/modules/financial-entities the GraphQL surface for usage:

type BusinessUsage { businessId: UUID! totalTransactions: Int! totalDocuments: Int!
  totalMiscExpenses: Int! totalLedgerRecords: Int! }
extend type Query { businessesUsage(ids: [UUID!]!): [BusinessUsage!]! @requiresAuth }

Put it in a new typeDefs file (businesses-usage.graphql.ts) and register it in the module's index.ts
typeDefs array (follow how other typeDefs are registered). Add a resolver that calls
BusinessUsageProvider.getUsageByBusinessIds and maps the entries to BusinessUsage rows (id order
need not match input). Register the provider in the module's providers array.

Run `yarn generate`, add a resolver test (mock provider), then build and lint.
```

### Step C1 — `deleteBusiness` mutation

```text
Expose deletion in packages/server/src/modules/financial-entities. Add to
typeDefs/businesses.graphql.ts:

extend type Mutation {
  deleteBusiness(businessId: UUID!): Boolean!
    @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
}

Add a Mutation resolver in businesses.resolver.ts that calls
BusinessesOperationProvider.deleteBusinessById(businessId), returns true on success, and lets the
provider's existing guard errors (employee / pension fund / trip attendee / dividends) propagate as
GraphQL errors. Do not add new guards here.

Run `yarn generate`. Add a resolver test: success path returns true; guarded path rejects. Build and
lint.
```

### Step D1 — Extract single-business update helper (pure refactor)

```text
Refactor only: in packages/server/src/modules/financial-entities, extract the body of the existing
`updateBusiness` Mutation resolver (the part that updates financial_entities, businesses,
business_tax_category_match, and Green Invoice) into a reusable helper function, e.g.
helpers/update-business.helper.ts exporting `updateSingleBusiness(injector, {businessId, ownerId,
fields})`.

Rewrite the existing updateBusiness resolver to call the helper so behavior is unchanged. Do not
change the schema. Existing updateBusiness tests must still pass unchanged. Build and lint.
```

### Step D2 — `batchUpdateBusinesses` mutation

```text
Add batch update in packages/server/src/modules/financial-entities. In
typeDefs/businesses.graphql.ts:

input BatchUpdateBusinessInput { country: CountryCode city: String zipCode: String sortCode: Int
  taxCategory: UUID irsCode: Int pcn874RecordType: Pcn874RecordType suggestions: SuggestionsInput }
extend type Mutation {
  batchUpdateBusinesses(businessIds: [UUID!]!, fields: BatchUpdateBusinessInput!): [Business!]!
    @requiresAuth @requiresAnyRole(roles: ["business_owner", "accountant"])
}

Resolver maps each id through the `updateSingleBusiness` helper from Step D1 (resolve ownerId the
same way updateBusiness does) and returns the updated businesses. Run `yarn generate`, add a resolver
test asserting the helper is called per id, then build and lint.
```

### Step E1 — Table scaffold replaces card list

```text
In packages/client/src/components/businesses, replace the card-based list in index.tsx with a
@tanstack/react-table table. Model the structure on components/charge-matches/index.tsx and
components/documents-table.

1. Update the AllBusinessesForScreen GraphQL document to also select, on LtdFinancialEntity:
   sortCode, taxCategory { id name }, isClient, the owner/admin flag, isActive, governmentId, country,
   city, zipCode, createdAt, updatedAt, hebrewName, suggestions { description tags { ... } }.
   Run `yarn generate`.
2. Create columns.tsx exporting ColumnDef[] with Core (name+hebrewName as a link to
   ROUTES.BUSINESSES.DETAIL(id)) and Main (locality, governmentId, createdAt, updatedAt) columns
   only.
3. Render with useReactTable + getCoreRowModel using the ui/table.js primitives, inside the existing
   PageLayout with the InsertBusiness headerAction. Keep the name filter + pagination behavior.

No selection/actions yet. Add a render test mounting the screen with a mocked query (one business)
and asserting the name renders. Lint.
```

### Step E2 — Selection column + merge

```text
Add a leading selection checkbox column to packages/client/src/components/businesses/columns.tsx
(header select-all + per-row), wiring useReactTable RowSelectionState, mirroring
components/charge-matches/columns.tsx.

Feed the selected business ids into the existing MergeBusinessesButton (from
components/common/index.js) rendered in the FiltersContext footer, matching the current index.tsx
merge wiring. Reset selection after a successful merge/refetch.

Add a test toggling a row checkbox and asserting the merge button reflects the selection. Lint.
```

### Step F1 — Categorization, Extension tags, Suggestion-defaults columns

```text
Extend packages/client/src/components/businesses/columns.tsx with three more groups:
- Categorization: sortCode, taxCategory (name), irsCode, pcn874RecordType.
- Extension tags: isClient, the owner/admin flag, and isInactive (derive from isActive) rendered as
  shadcn Badge components (reuse the badge styling from components/business/business-header.tsx).
- Suggestion defaults: suggestions.description and suggestions.tags (render tag names).

Add column ids/meta so these can be grouped for the visibility toggle in the next step. Update the
render test to assert a categorization cell renders. Lint.
```

### Step F2 — Column visibility with group defaults

```text
Add a column-visibility dropdown to the businesses table, modeled on
components/charge-matches/index.tsx (the DropdownMenuCheckboxItem block). Initialize
VisibilityState so Core + Main + Extension tags are visible and Categorization + Suggestion defaults
are hidden by default.

Group the checkboxes by the column groups from Step F1 (label each group). Persist visibility in
component state for the session. Add a test toggling a hidden group on and asserting its column
appears. Lint.
```

### Step G1 — Lazy usage columns

```text
Add opt-in usage columns to the businesses screen.

1. Add a second urql query document `BusinessesUsage($ids: [UUID!]!)` selecting businessId and the
   four totals. Use useQuery with `pause: true`; un-pause only once any usage column is enabled,
   passing the currently loaded business ids.
2. Add Usage columns (totalTransactions, totalDocuments, totalMiscExpenses, totalLedgerRecords),
   hidden by default and grouped under "Usage" in the visibility dropdown. Merge usage results into
   rows by id; show a small spinner/placeholder while fetching.

Add a test: enabling a usage column triggers the (mocked) usage query and renders a count. Lint.
```

### Step H1 — Sortable headers

```text
Wire sorting into the businesses table using getSortedRowModel and SortingState, and render sortable
column headers with components/common/data-table-column-header.tsx for the text/number/date columns
(name, locality, createdAt, updatedAt, sortCode, irsCode, and usage columns). Leave badge/action
columns unsortable.

Add a test sorting by name and asserting row order. Lint.
```

### Step H2 — Filters incl. "unused only"

```text
Extend packages/client/src/components/businesses/businesses-filters.tsx with client-side filters over
the loaded rows: sort-code, tax-category, and the boolean flags (isClient, owner/admin, inactive),
plus an "unused only" toggle.

"Unused only" depends on usage data, so enabling it should un-pause the usage query (reuse the Step
G1 trigger) and filter to rows whose four totals are all 0. Keep the existing name filter. Apply
filters via getFilteredRowModel / column filter state.

Add a test for the flag filter and for "unused only" (with mocked usage). Lint.
```

### Step I1 — Delete action

```text
Create packages/client/src/hooks/use-delete-business.ts wrapping useMutation(DeleteBusinessDocument)
with handleCommonErrors + sonner toasts (loading → success/error), following
hooks/use-merge-charges.ts. Add the DeleteBusiness mutation document.

In the businesses table add a per-row delete action (in an actions column or row menu) that:
- is disabled when the row's usage totals are unknown or > 0 (require usage loaded; if not loaded,
  trigger the usage fetch),
- opens a shadcn alert-dialog confirm,
- on confirm calls the hook and refetches the list on success.

Add a test: delete is disabled for a used business and calls the hook for an unused one. Lint.
```

### Step I2 — Batch update dialog

```text
Create packages/client/src/hooks/use-batch-update-businesses.ts wrapping
useMutation(BatchUpdateBusinessesDocument) with handleCommonErrors + toasts. Add the mutation
document.

Create components/businesses/batch-update-dialog.tsx — a shadcn Dialog + react-hook-form/zod form
(per .claude/rules/client-components.md) with optional fields: country, city, zipCode, sortCode,
taxCategory, irsCode, pcn874RecordType, suggestions.description, suggestions.tags. Only submit
fields the user set. Trigger it from a footer button enabled when rows are selected; on success
refetch and clear selection.

Add a test submitting one field for two selected rows and asserting the hook is called with those
ids/field. Lint.
```

### Step J1 — States, docs, final verification

```text
Finalize the businesses management screen:
- Loading (Loader2), empty (ui/empty.js), and error (Alert variant="destructive") states.
- Confirm column-visibility defaults (Core + Main + Extension tags) and that hidden groups don't
  fetch usage until enabled.
- Update docs/businesses-page-refactor/plan.md "Verification" if any step diverged.

Run the full local verification: `yarn generate`, `yarn lint`, `yarn workspace @accounter/server
build`, `yarn workspace @accounter/client build`, `yarn test` (and `yarn test:integration` for the
usage provider). Fix any fallout. This is the integration/wiring checkpoint — ensure no column,
hook, or query is left unreferenced.
```

---

## Sequencing & Dependency Notes

- **Order:** A → B → C → D server-side (each independent and shippable), then E → … → J client-side.
  Client steps assume the server schema from A–D is generated.
- **No orphans:** E1 immediately replaces the card list (the screen is always live); every later
  client step adds columns/actions onto that live screen. D1 is a no-behavior-change refactor that
  D2 consumes immediately.
- **Testing cadence:** server steps gate on resolver/provider tests + build; client steps gate on a
  render/interaction test + lint. J1 runs the full suite as the final wiring checkpoint.
- **Reuse checklist:** `MergeBusinessesButton`, `InsertBusiness`, `data-table-column-header`,
  `business-header` badges, `handleCommonErrors`, sonner toasts, and the existing
  `updateBusiness`/delete/merge providers are all reused rather than rebuilt.
