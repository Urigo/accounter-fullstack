# Demo / Staging Test Data & Server Integration Testing Specification

## 1. Overview

This specification defines the architecture, data handling, tooling, and rollout plan for
introducing reusable demo/staging data and an integration testing framework for the
`@accounter/server` package. The immediate focus is on: (1) seeding foundational admin context
(business, tax categories, tags, user_context), (2) creating already–matched expense charge
scenarios (happy paths), (3) validating ledger generation, and (4) preparing extensible factories
for future flows (income, foreign currency, partial payments, etc.).

## 2. Goals

- Provide deterministic, scriptable demo/staging datasets deployable to any ephemeral environment.
- Enable integration tests (Vitest) that exercise DB + GraphQL + ledger generation for core
  financial flows.
- Establish data factories for rapid scenario expansion.
- Minimize flakiness: rely on real Postgres with migrations; avoid brittle timing/order assumptions.
- Offer clear DX: one command to bootstrap test DB + seed + run integration tests.

## 3. Non‑Goals (Initial Phase)

- Scraper ingestion simulation (raw origin tables) — deferred.
- Gmail listener / file system ingestion — deferred.
- Performance / load testing.
- Full coverage of all charge types (only common expense + basic income next phase).

## 4. High‑Level Architecture

Component Layers:

1. Migration Runner (existing in `packages/migrations`).
2. Seed Layer (enhanced version of `scripts/seed.ts` + new modular seed helpers).
3. Fixture Factories (`packages/server/src/__tests__/factories/*`).
4. Fixture Loader / Inserter (`packages/server/src/__tests__/helpers/fixture-loader.ts`).
5. Test DB Harness (`packages/server/src/__tests__/helpers/db-setup.ts`).
6. Integration Test Suites (`packages/server/src/modules/*/__tests__/*.integration.test.ts`).
7. CI Orchestration (GitHub Actions / pipeline commands).

Execution Flow (local or CI):

```
docker-compose -f docker-compose.dev.yml up -d postgres
yarn migrations:run (existing runner)
yarn seed:admin-context (new script) -> foundational entities
yarn test:integration (Vitest invoking DB-backed tests)
```

Updated Execution Flow (Current Harness):

```
docker compose -f docker/docker-compose.dev.yml up -d postgres
# Run migrations explicitly (not inside tests)
yarn workspace @accounter/migrations migration:run
# (Optional) seed admin context for non-test environments; tests seed idempotently inside transactions
# Run full test suite (includes schema guard asserting LATEST_MIGRATION_NAME applied)
yarn workspace @accounter/server vitest run
```

Notes:

- Tests DO NOT run migrations automatically; they assert the latest migration name
  (`LATEST_MIGRATION_NAME`) is present.
- Seeding occurs transactionally per test where needed, ensuring rollback and no persistent test
  data.

## 5. Data Domain Summary (Core Tables)

| Table                             | Purpose                                                      | Key Relationships                                                                                           |
| --------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| financial_entities                | Base entity for businesses & tax categories                  | Referenced by `businesses`, `tax_categories`, ledger debit/credit entities                                  |
| businesses                        | Operating entities                                           | Linked to charges (owner_id) & transactions (business_id)                                                   |
| tax_categories                    | Categorization for ledger & classification                   | Assigned via charges or derived from financial accounts                                                     |
| financial_accounts                | Bank / credit / crypto accounts                              | Feed transactions; mapped to tax categories for ledger                                                      |
| financial_accounts_tax_categories | Maps accounts to tax categories by currency                  | financial_account_id → financial_accounts, tax_category_id → tax_categories, required for ledger generation |
| charges                           | Aggregation anchor for documents + transactions + ledger     | owner_id → business; referenced by transactions/documents/ledger_records                                    |
| transactions                      | Monetary events from bank/cc feeds                           | charge_id, business_id, currency, amount                                                                    |
| documents                         | Financial documents (invoice, receipt, etc.)                 | charge_id (new), creditor_id, debtor_id                                                                     |
| ledger_records                    | Double-entry–like entries per charge                         | debit_entity*, credit_entity*, charge_id                                                                    |
| user_context                      | Admin configuration (default currency, mandatory categories) | owner_id (admin business)                                                                                   |

## 6. Foundational Seed Requirements

Enhance `scripts/seed.ts` by splitting responsibilities:

1. `seedAdminCore()` – create admin business entity, mandatory tax categories, tags, and
   user_context row.
2. Expose environment overrides via `.env` for optional multi-account seeding.
3. Idempotency: each insert must check existence (SELECT) or rely on ON CONFLICT DO NOTHING where
   feasible.
4. Output: write `DEFAULT_FINANCIAL_ENTITY_ID` & others into `.env` if missing.

New Script Commands (added to package.json):

**Root package.json:**

```
"seed:admin": "yarn workspace @accounter/server seed:admin",
"test": "vitest run"
```

**packages/server/package.json:**

```
"seed:admin": "tsx scripts/seed-admin-context.ts"
```

**Implementation Progress (S1-S5)**:

- ✅ `writeEnvVar()` helper with atomic file writes (temp + rename pattern)
- ✅ `ensureFinancialEntity()` with type-safe validation and NULL handling
- ✅ `ensureBusinessForEntity()` with FK validation and UUID format checks
- ✅ `ensureTaxCategoryForEntity()` with idempotent insert behavior
- ✅ `seedAdminCore()` composition creating complete admin context

See `docs/architectural-improvements-s1-s3.md` for detailed implementation status and
`docs/demo-test-data-todo.md` for complete checklist.

## 7. Initial Demo Scenarios (Phase 1)

### Expense Scenario A (Local Currency)

- Supplier business (e.g. "Local Supplier Ltd").
- Charge (type: common financial) with one transaction (ILS negative -> expense) and one receipt
  document.
- VAT present (transaction amount equals total document amount; ledger should reflect expense + VAT
  logic if applicable).
- Expected ledger: debit expense tax category, credit cash/bank tax category.

### Expense Scenario B (Foreign Currency)

- Supplier business ("US Vendor LLC") with USD invoice.
- Transaction in USD, document in USD, system calculates local currency via exchange rate provider
  (mockable or seeded static rate).
- Ledger entries convert foreign to local; include exchange rate validation.

Both scenarios start with already–matched charges (transactions + documents share same charge_id).
Matching logic tests deferred.

## 8. Roadmap for Income (Phase 2)

After expense tests validated:

1. Income Scenario A (ILS Invoice, later payment transaction).
2. Income Scenario B (Foreign currency invoice, partial payments). Partial payments introduce
   multiple transactions referencing one charge.
3. Validate exchange revaluation ledger entries if currency diff flag set.

## 9. Fixture Factory Design

Location: `packages/server/src/__tests__/factories/` Factories return plain objects typed with
existing pgtyped types (import from `__generated__/types.ts`). Each factory accepts an override
object.

Factories:

- `makeUUID()` helper (deterministic optional mode via seeded RNG for snapshot stability).
- `createBusiness({ name, can_settle_with_receipt? })`.
- `createTaxCategory({ name })`.
- `createFinancialAccount({ account_number, type })` plus mapping function to tax category.
- `createCharge({ owner_id, tax_category_id, user_description? })`.
- `createTransaction({ charge_id, business_id, amount, currency, event_date, is_fee? })`.
- `createDocument({ charge_id, creditor_id, debtor_id, type, total_amount, currency_code, date })`.
- `createLedgerExpectation({ scenarioId })` – derived structure describing expected entries (for
  assertion layer).

Conventions:

- Date strings use ISO `YYYY-MM-DD` converted to `Date` at insertion.
- Numeric values stored as string when required by pgtyped types (e.g. `numeric` in transactions).
- **Currency and Country enums**: Use `Currency` enum from `packages/server/src/shared/enums.js` and
  `CountryCode` enum from `packages/server/src/modules/countries/types.ts` instead of string
  literals for type safety and consistency.
  - Example: `Currency.Ils`, `Currency.Usd` instead of `'ILS'`, `'USD'`
  - Example: `CountryCode.Israel`, `CountryCode['United States of America (the)']` instead of
    `'ISR'`, `'USA'`

## 10. Fixture Format & Storage

Use TypeScript modules exporting structured fixture sets:

```
export const expenseScenarioA = {
  businesses: [...],
  taxCategories: [...],
  financialAccounts: [...],
  charges: [...],
  transactions: [...],
  documents: [...],
  expectations: { ledger: [...] }
};
```

Pros: type safety, IDE autocompletion, easy programmatic mutation.

## 11. Fixture Insertion Pipeline

`fixture-loader.ts` responsibilities:

1. Validate referential integrity (e.g., each `transaction.charge_id` exists).
2. Insert in deterministic order: financial_entities → businesses → tax_categories →
   financial_accounts (+ join tables) → charges → transactions → documents.
3. Wrap each top-level fixture load in a transaction; rollback on any failure.
4. Provide `clearTestData()` to truncate involved tables (except migration tracking) between test
   suites. Use `TRUNCATE ... RESTART IDENTITY CASCADE` where safe.
5. Return inserted IDs mapping to facilitate assertions.

## 12. Test Database Strategy

Approach: **External migrations + transactional test isolation**.

Workflow:

1. Migrations applied once outside the test process (local dev or CI step).
2. Global test setup creates isolated temp env file (`TEST_ENV_FILE`) and initializes connection
   pool.
3. Each test opens a transaction via helper (`withTestTransaction`); seeding (admin core, tax
   categories) performed idempotently inside transaction when needed.
4. Assertions executed; diagnostics emitted only when `DEBUG=accounter:test`.
5. Automatic rollback ensures zero data persistence across tests.

Benefits:

- Eliminates migration drift inside test harness and prevents FK conflicts.
- Guarantees clean state without TRUNCATE overhead.
- Precise schema version guard using `LATEST_MIGRATION_NAME`.

Helpers (unchanged): `withTestTransaction`, `withConcurrentTransactions` in `test-transaction.ts`.

Diagnostics: Pool health snapshots & connection retries logged when debugging enabled.

### Cross-Connection Integration Tests

For tests that span multiple database connections (e.g., fixture insertion in one connection, ledger
generation in another):

1. **Insert fixtures with explicit BEGIN/COMMIT** (not `withTestTransaction`) to ensure visibility
   across connections
2. **Use deterministic UUIDs** for all entities via `makeUUID('semantic-name')`
3. **Add `afterEach` cleanup** that deletes by ID:

```typescript
afterEach(async () => {
  const client = await pool.connect();
  try {
    const chargeId = makeUUID('charge-identifier');
    await client.query('DELETE FROM ledger_records WHERE charge_id = $1', [chargeId]);
    await client.query('DELETE FROM documents WHERE charge_id = $1', [chargeId]);
    await client.query('DELETE FROM transactions WHERE charge_id = $1', [chargeId]);
    await client.query('DELETE FROM charges WHERE id = $1', [chargeId]);
  } finally {
    client.release();
  }
});
```

4. **Separate client for business logic** - use a fresh client connection after committing fixture
   data
5. **AdminContext from DB** - query `user_context` joined with `financial_entities` to avoid env
   dependencies

**Pattern distinction:**

- **Unit-style tests**: Use `withTestTransaction` for automatic rollback (single connection)
- **Integration-style tests**: Use explicit COMMIT + `afterEach` cleanup (multiple connections)

## 13. Ledger Generation Test Strategy

Location: `packages/server/src/modules/ledger/__tests__/ledger-generation.integration.test.ts`.
Assertions:

- **Number of ledger records**: Assert **minimum expected count** (≥ N) to account for
  algorithm-generated balancing entries (exchange rate adjustments, VAT corrections, rounding)
- **Balanced totals**: Sum debit == sum credit in local currency with **tolerance** (delta < 0.01)
  for floating-point arithmetic
- **Correct entity assignments**: Check **presence** of required debit/credit entities, not
  exhaustive list (algorithm may add exchange rate or balancing entries)
- **Foreign amount validation**: Exchange rate within ±0.5% of seeded/mocked rate
- **Result structure**: Assert `result.errors` is empty array, `result.balance.isBalanced` is true,
  and `result.records.length` matches expected count
- **Type safety**: Guard against `CommonError` union variant before accessing result fields

Helper: `assertLedgerBalance(records, expectation)` with updated signature:

```typescript
function assertLedgerBalance(
  records: LedgerRecord[],
  expectation: {
    minRecords: number; // Minimum count (not exact)
    requiredDebitEntities: string[]; // Must be present
    requiredCreditEntities: string[]; // Must be present
    totalTolerance?: number; // Default 0.01
  },
): void;
```

**Key insight**: Ledger generation algorithms may produce additional balancing records beyond the
minimum expected entries. Tests should validate balance correctness and required entity presence
rather than exact record counts.

## 14. Error Handling Strategy

Seed Layer:

- Wrap inserts in try/catch; log succinct contextual error (entity type + name) and abort current
  transaction.
- Surface errors via thrown custom error hierarchy: `SeedError` (base), `EntityValidationError`,
  `EntityNotFoundError`, `ConstraintViolationError`, `SeedConfigurationError`.
- **Implementation**: Custom error types in `packages/server/src/__tests__/helpers/seed-errors.ts`
  provide structured context, `toJSON()` serialization, and enable `instanceof` checks for specific
  handling.

Fixture Loader:

- Validate foreign key relationships before insertion; throw `FixtureValidationError` listing
  missing references.
- On DB error, rollback and rethrow enriched error with scenario ID.

Tests:

- Fail fast: if ledger generation returns `CommonError` union variant, assert message and fail test.
- Provide diagnostics: on mismatch, print diff of expected vs actual ledger simplified view.

**Note**: Error handling infrastructure (custom error hierarchy) implemented ahead of schedule in
S1-S3 hardening phase. See `docs/architectural-improvements-s1-s3.md` for details.

## 15. CI Integration

Current Workflow (Implemented):

1. Checkout & install dependencies.
2. Start Postgres service container with test database env vars.
3. Run migrations: `yarn workspace @accounter/migrations migration:run`.
4. Execute test suite: `yarn workspace @accounter/server vitest run` (includes schema guard test for
   `LATEST_MIGRATION_NAME`).
5. Separate script asserts latest migration applied (independent of test suite outcome).
6. Collect and upload coverage artifact (threshold enforcement pending).
7. Environment isolation verified via log of created `TEST_ENV_FILE` path.

Optional future steps: add migration dry-run validation and coverage thresholds.

## 16. Configuration & Env

`.env.test` baseline example:

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=accounter_test
POSTGRES_SSL=0
DEFAULT_LOCAL_CURRENCY=ILS
```

Environment Isolation:

- Global test setup creates a temp file (e.g. `/tmp/accounter-env-XXXX/.env`) and sets
  `TEST_ENV_FILE`.
- `seed-admin-context.ts` writes `DEFAULT_FINANCIAL_ENTITY_ID` atomically to that isolated file.
- Prevents accidental mutation of project root `.env` during tests.

Shared Configuration:

- Centralized in `test-db-config.ts` (`testDbConfig`, `testDbSchema`, `qualifyTable`).
- Schema-qualified naming ensures portability and future multi-schema test strategies.

Schema Guard:

- Tests use exported `LATEST_MIGRATION_NAME` from migrations package to assert schema currency.
- Failing guard indicates need to run migrations before re-running tests.

## 17. Implementation Phases & Tasks

Phase 1 (Expense Happy Paths):

1. Refactor admin seed into modular script.
2. Create factories directory + base factories.
3. Implement fixture-loader + validation.
4. Build expense scenarios A & B fixtures.
5. Implement db-setup test harness with transactional isolation.
6. Write ledger integration tests for expense scenarios.
7. CI job draft.

Phase 2 (Income & Extensions):

1. Add income fixtures (delayed payments, foreign currency partial payments).
2. Introduce exchange revaluation scenario.
3. Add matching logic tests (autoMatchCharges) after scraper simulation phase.
4. Add negative tests (missing tax category, unbalanced ledger).

Phase 3 (Source Ingestion Simulation):

1. Build raw scraper table insertion utilities.
2. End-to-end: raw → transaction → charge → match → ledger.

## 18. Acceptance Criteria (Phase 1)

- Running `yarn seed:admin` creates all mandatory entities idempotently.
- Two expense fixtures insert successfully under transactional tests.
- Ledger generation tests pass with:
  - Balanced entries (debit == credit within 0.01 tolerance)
  - Minimum expected record count (accounts for balancing entries)
  - Required entities present (expense category, bank account category)
  - Empty errors array and `isBalanced: true` in result
  - Deterministic UUID-based cleanup in `afterEach`
- Foreign currency expense test validates exchange rate conversion (deterministic with mocked rate).
- Financial account tax category mappings created for all scenarios (required for ledger
  generation).
- CI pipeline completes within acceptable time (< 2m for integration suite).
- Developer can create a new scenario with ≤5 lines using factories + fixture loader.

## 19. Risks & Mitigations

| Risk                                | Mitigation                                                            |
| ----------------------------------- | --------------------------------------------------------------------- |
| Migrations drift between local & CI | External migration step + exact name guard (`LATEST_MIGRATION_NAME`). |
| Flaky exchange rate lookups         | Deterministic mock provider or seeded fixed rate table.               |
| Slow test startup                   | Transactional isolation avoids full reseed per test.                  |
| Foreign key insertion order errors  | Pre-validation & deterministic ordering in fixture-loader.            |
| Large fixture growth                | Modular scenario files + shared factories.                            |
| Env file pollution                  | Per-run `TEST_ENV_FILE` isolation + atomic writes.                    |
| Brittle migration count assertions  | Name-based schema version verification.                               |

## 20. Extension Hooks

- Add snapshot serialization for ledger record arrays to simplify diffing.
- Introduce feature flags in seed (e.g. ENABLE_DIVIDENDS) for selective context creation.
- Optional data export CLI: `yarn demo:export --scenario expenseA` to produce sanitized JSON for
  external demos.

## 21. Provider Harness Maintenance

The ledger test injector (`packages/server/src/test-utils/ledger-injector.ts`) requires ongoing
maintenance as ledger logic evolves.

**When to update:**

- New provider dependency added to ledger generation flow
- Provider constructor signature changes
- Context requirements expand

**Discovery process:**

1. Run test and observe error: "Unsupported provider requested by injector: XProvider"
2. Import provider class from appropriate module
3. Add case to injector factory switch
4. Instantiate with required dependencies (use stubs for non-critical deps)
5. Re-run test and repeat until green

**Provider list** (current as of 2025-11-21):

- **Core**: DBProvider, LedgerProvider
- **Entities**: BusinessesProvider, TaxCategoriesProvider, FinancialEntitiesProvider (+ stub for
  BusinessesOperationProvider)
- **Financial**: FinancialAccountsProvider, ChargesProvider, ChargeSpreadProvider
- **Data**: TransactionsProvider, DocumentsProvider
- **Business Logic**: ExchangeProvider (+ CryptoExchangeProvider, FiatExchangeProvider,
  CoinMarketCapProvider), VatProvider, MiscExpensesProvider, BusinessTripsProvider
- **Balancing**: UnbalancedBusinessesProvider, BalanceCancellationProvider

**Extensibility patterns:**

- **Exchange rate mocking**: Use `mockExchangeRate(from, to, rate)` from `exchange-mock.ts` and pass
  to injector:

  ```typescript
  import { mockExchangeRate } from '@/__tests__/helpers/exchange-mock.js';
  import { Currency } from 'packages/server/src/shared/enums.js';

  const context = createLedgerTestContext({
    pool,
    adminContext,
    mockExchangeRates: mockExchangeRate(Currency.Usd, Currency.Ils, 3.5),
  });
  ```

- For non-critical dependencies: inject minimal stubs with no-op methods
- For context-dependent providers: use `contextRef` pattern to inject context after creation

**Example stub pattern:**

```typescript
const businessesOperationStub = {
  deleteBusinessById: async (_businessId: string) => {},
  // Add other methods as needed
} as any;
```

## 22. Developer Workflow Summary

```bash
# Spin up DB
docker compose -f docker/docker-compose.dev.yml up -d postgres

# Apply migrations (must be done before tests)
yarn workspace @accounter/migrations migration:run

# (Optional) Seed admin for manual exploration
yarn seed:admin

# Run full test suite (includes schema guard + coverage)
yarn test

# Run specific test file
yarn workspace @accounter/server vitest run expense-scenario
```

## 23. Recent Improvements

### CountryCode and Currency Enum Consistency (2025-11-23)

**Problem**: Tests and fixtures used string literals for currencies and countries, risking typos and
inconsistency.

**Solution**: Standardized all test code to use enum values:

- `Currency` enum from `packages/server/src/shared/enums.js` (`Currency.Ils`, `Currency.Usd`)
- `CountryCode` enum from `packages/server/src/modules/countries/types.ts` (`CountryCode.Israel`,
  `CountryCode['United States of America (the)']`)

**Files Updated**:

- Fixtures: `expense-scenario-a.ts`, `expense-scenario-b.ts`
- Factories: `business.ts` (default country)
- Tests: `expense-scenario-a.test.ts`, `expense-scenario-b.test.ts`, `business.test.ts`,
  `ledger-scenario-a.integration.test.ts`, `ledger-scenario-b.integration.test.ts`

**Benefits**:

- Compile-time type safety prevents invalid currency/country codes
- IDE autocomplete for valid values
- Consistent with production code patterns
- Eliminates magic strings

**Test Results**: All 238+ tests passing with enum usage.

### Countries Table Normalization (2025-11-22)

**Problem**: Countries table population duplicated between seed script and vitest setup; USA added
manually.

**Solution**: Created `seed-countries.ts` utility using `CountryCode` enum as single source of
truth:

- `getAllCountries()`: Returns all 249 countries from enum
- `seedCountries(client, schema)`: Dynamically builds INSERT with ON CONFLICT DO NOTHING
- Updated both `seed.ts` and `vitest-global-setup.ts` to use utility

**Benefits**:

- DRY principle: enum is single source of truth
- Consistency across dev seeding and test setup
- Easier maintenance (add country to enum, automatically available everywhere)
- Parameterized queries prevent SQL injection

**Test Results**: Countries seeding verified in global setup logs; all integration tests passing.

## 24. Open Questions (To Address Before Phase 2)

- Standardized exchange rate seeding vs. runtime provider mock?
  - **Current approach**: Seed static rates in DB for determinism; use provider mocks for edge cases
- Preferred fixture diff tooling (custom vs. built-in expect diff)?
  - **Current approach**: Built-in Vitest expect with custom assertion helpers
- When to incorporate document upload flow simulation?
  - **Deferred to Phase 3**: Focus on already-matched charges first
- AdminContext construction complexity?
  - **Solution needed**: Extract `buildAdminContextFromDb(pool, businessName)` helper to eliminate
    ~100 lines of duplication per test

---

Prepared for implementation. This document will evolve with subsequent phases.

## 25. Ledger Test Coverage Gaps (Planned Enhancements)

The current ledger integration tests (Expense Scenarios A & B) establish a strong baseline. The
following gaps have been identified for hardening overall financial correctness and audit
robustness:

- Duplicate prevention: Re-running generation with `insertLedgerRecordsIfNotExists: true` currently
  allows duplicate inserts. Need uniqueness constraint or re-generation guard.
- VAT handling: Introduce scenarios with explicit VAT ledger legs and assertions validating tax
  entity presence and positioning.
- Rounding edge cases: Foreign currency conversions with > 2 decimal precision; verify rounding
  rules and tolerance.
- Exchange rate date alignment: Ensure rate selected corresponds to invoice/transaction value date;
  add test comparing mismatched dates.
- Secondary entity logic: Multi-leg charges (fees, taxes, FX adjustments) should assert acceptable
  secondary entity sets.
- Charge lock behavior: Add locked-charge scenario validating retrieval path vs generation path (no
  mutation).
- Description/reference semantics: Assert non-empty meaningful `description` / `reference1` fields
  where business logic requires them.
- Fiscal period boundaries: Validate ledger record dates fall within expected accounting period for
  given scenario (e.g., month-end tests).
- Post-lock immutability: After locking a charge, `updated_at` must remain unchanged and
  `locked=true`; test mutation attempts are rejected.
- Foreign/local reconciliation: Sum of local amounts must equal foreign × rate across all legs
  within tolerance (aggregate validation in addition to per-leg checks).
- Unbalanced-business exceptions: Special charge types (business trips, salaries) may allow
  temporary unbalanced entities; add explicit tests for allowed exceptions.

## 26. Recommended Next Steps (Execution Roadmap)

Priority actionable items to close the above gaps:

1. New fixtures: VAT expense, multi-leg foreign expense with fees, locked charge scenario.
2. Uniqueness / guard: Implement check preventing duplicate ledger insertion when generation is
   re-invoked with insertion enabled.
3. Foreign aggregation assertion: Extend `assertForeignExpenseScenario` to validate total foreign
   sum matches `expectedForeignAmount * legCount`.
4. VAT helper assertions: Add reusable helper asserting tax entity appears only on correct side and
   totals match expected VAT amount.
5. Exchange rate date test: Mock multiple dated rates; assert ledger picks correct rate based on
   charge or document date.
6. Lock scenario test: Generate ledger, lock charge, re-run generation verifying no changes and
   audit immutability.
7. Period boundary test: Introduce scenario straddling month-end to verify classification and period
   tagging (future extension).
8. Secondary leg logic: Add tests for fee & FX adjustment legs ensuring entity classification and
   zero orphan amounts.
9. Description/reference validation: Add assertions checking presence of human-readable description
   for non-system-generated entries.
10. Unbalanced exceptions: Implement tests for business trip and salary charges using
    `ledgerUnbalancedBusinessesByCharge` allowances.

These improvements should be scheduled as a "Ledger Coverage Hardening" milestone after initial demo
stability, enabling broader charge type confidence before expanding to income and partial payment
flows.
