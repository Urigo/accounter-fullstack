# Demo / Staging Test Data & Integration Testing - TODO Checklist

This checklist tracks the implementation of the demo/staging data and integration testing
infrastructure for `@accounter/server`. Each item corresponds to prompts in
`demo-test-data-prompt-plan.md`.

---

## Milestone 1: Seed Admin Context (Idempotent)

### S1: writeEnvVar Helper

- [x] Create `packages/server/src/__tests__/helpers/env-file.ts`
- [x] Implement `writeEnvVar(filePath, key, value)` function
  - [x] If key exists, replace its value
  - [x] If key doesn't exist, append `\nkey=value`
  - [x] Preserve other lines untouched
- [x] Create `packages/server/src/__tests__/helpers/env-file.test.ts`
  - [x] Test: create new variable
  - [x] Test: update existing variable
  - [x] Test: no extra trailing whitespace
  - [x] Test: idempotent when value unchanged
  - [x] Use temp file (fs.mkdtemp + os.tmpdir)
- [x] Run tests: `vitest run packages/server/src/__tests__/helpers/env-file.test.ts`
- [x] All tests pass ✅

### S2: ensureFinancialEntity

- [x] Create `packages/server/src/__tests__/helpers/seed-helpers.ts`
- [x] Implement `ensureFinancialEntity(client, {name, type, ownerId?})`
  - [x] Check existence by (name, type, owner_id)
  - [x] Return existing id if found
  - [x] Insert and return id if not found
  - [x] Use SELECT before INSERT or ON CONFLICT
- [x] Create `packages/server/src/__tests__/helpers/seed-helpers.financial-entity.test.ts`
  - [x] Setup: open transaction (BEGIN)
  - [x] Test: call helper twice with same input
  - [x] Assert: same id returned, only one insert
  - [x] Test: handle entities with owner_id
  - [x] Test: distinguish entities by type
  - [x] Test: distinguish entities by owner_id
  - [x] Test: NULL vs undefined owner_id handling
  - [x] Test: no data leakage between tests
  - [x] Teardown: ROLLBACK
- [x] Tests pass and don't leak data ✅

### S3: ensureBusinessForEntity

- [x] Add `ensureBusinessForEntity(client, entityId, options?)` to `seed-helpers.ts`
  - [x] Check if business exists by id
  - [x] Insert if missing
  - [x] Support `noInvoicesRequired` option
- [x] Create `packages/server/src/__tests__/helpers/seed-helpers.business.test.ts`
  - [x] Test: first insert creates row
  - [x] Test: repeated calls are idempotent
  - [x] Test: noInvoicesRequired option works
  - [x] Test: default value when option not specified
  - [x] Test: existing business not modified on subsequent calls
  - [x] Test: no data leakage between tests
  - [x] Use transactional tests
- [x] Tests pass ✅

### S4: ensureTaxCategoryForEntity

- [x] Add `ensureTaxCategoryForEntity(client, entityId, options?)` to `seed-helpers.ts`
  - [x] Check if tax category exists by id
  - [x] Insert if missing
  - [x] Support optional `sortCode`
- [x] Create `packages/server/src/__tests__/helpers/seed-helpers.tax-category.test.ts`
  - [x] Test: first insert creates row
  - [x] Test: idempotent behavior
  - [x] Use transaction isolation
- [x] Tests pass ✅

### S5: seedAdminCore Composition

- [x] Create `packages/server/scripts/seed-admin-context.ts`
- [x] Implement `seedAdminCore(client)` function
  - [x] Create admin business entity
  - [x] Create authorities (VAT, Tax, Social Security)
  - [x] Create general tax categories (DEFAULT, Exchange Rates, Income Exchange Rates, etc.)
  - [x] Create cross-year categories
  - [x] Create tags (if needed)
  - [x] Upsert `user_context` row with ILS default currency
  - [x] Use `writeEnvVar` to set `DEFAULT_FINANCIAL_ENTITY_ID`
  - [x] Return `{ adminEntityId }`
- [x] Create `packages/server/src/__tests__/seed-admin-context.integration.test.ts`
  - [x] Connect DB, BEGIN transaction
  - [x] Call `seedAdminCore`
  - [x] Assert `user_context` exists
  - [x] Assert mandatory entities referenced
  - [x] ROLLBACK
- [x] Integration test passes ✅

### S6: CLI Wrapper (Deferred to Prompt 18)

- [ ] Add package.json script (covered in Milestone 6)

**Milestone 1 Complete:** All seed helpers and admin context seeding implemented and tested ✅
**Total Tests:** 46 passing (11 env-file + 11 financial-entity + 8 business + 8 tax-category + 3
concurrent + 5 integration)

---

## Milestone 2: DB Test Harness

### S7: connectTestDb

- [x] Create `packages/server/src/__tests__/helpers/db-setup.ts`
- [x] Implement `connectTestDb(): Promise<Pool>`
  - [x] Read env variables (POSTGRES\_\*)
  - [x] Return pooled client
  - [x] Handle connection errors gracefully
- [x] All tests pass ✅

### S8: runMigrationsIfNeeded & seedAdminOnce

- [x] Add `runMigrationsIfNeeded(pool)` to `db-setup.ts`
  - [x] Invoke migrations runner with env via slonik
  - [x] Handle already-applied migrations
  - [x] Process-level flag to prevent redundant runs
- [x] Add `seedAdminOnce(pool)` to `db-setup.ts`
  - [x] Implement lock mechanism (in-memory flag + database idempotency)
  - [x] Call `seedAdminCore` only once per test run
- [x] Add `withTransaction<T>(pool, fn)` re-export to `db-setup.ts`
  - [x] Re-export from test-transaction.ts for convenience
  - [x] BEGIN transaction
  - [x] Execute function
  - [x] ROLLBACK regardless of success/failure
- [x] Add `closeTestDb()` for cleanup
- [x] All helpers implemented ✅

### S9: Vitest Hooks (Implemented - Transactional Isolation)

- [x] Create `packages/server/src/__tests__/helpers/test-hooks.ts`
  - [x] Implement `beforeAll` hook: create TEST_ENV_FILE, connect pool
  - [x] Implement `beforeEach` hook: BEGIN transaction
  - [x] Implement `afterEach` hook: ROLLBACK transaction
  - [x] Implement `afterAll` hook: close pool
  - [x] Support optional `seedAdmin` parameter for idempotent admin seeding in transaction
  - [x] Dynamic import of seedAdminCore to avoid circular dependencies
- [x] Create `packages/server/src/__tests__/transaction-isolation.dummy.test.ts`
  - [x] Test: insert visible during transaction
  - [x] Test: data rolled back between tests (isolation verified)
- [x] Update `scripts/vitest-global-setup.ts`
  - [x] Create isolated TEST_ENV_FILE in temp directory
  - [x] Set ENFORCE_LATEST_MIGRATION=1 by default
  - [x] Ensure countries reference data (ISR) exists for FK constraints
  - [x] Return teardown function for shared pool cleanup
- [x] All transactional hooks tests pass ✅

### S10: Smoke Test

- [x] Create `packages/server/src/__tests__/db-bootstrap.test.ts`
  - [x] Connect DB
  - [x] ~~Run migrations~~ (Assumes migrations already run via `yarn db:init`)
  - [x] Seed admin once (transactionally per test)
  - [x] Query `user_context`
  - [x] Assert data exists
  - [x] Verify latest migration by name (LATEST_MIGRATION_NAME guard)
  - [x] Verify admin business creation
  - [x] Verify 3 authority businesses (VAT, Tax, Social Security)
  - [x] Verify 19 tax categories
  - [x] Verify user_context structure
  - [x] Verify transaction isolation (withTestTransaction rollback)
  - [x] Verify manual business insert with rollback
- [x] Smoke test passes ✅ (7/7 tests passing)
- [x] Transaction isolation test passes ✅ (2/2 tests in dummy suite)

**Milestone 2 Complete:** DB test harness implemented with connection pooling, transactional
isolation hooks, and admin seeding ✅

**Total Tests:** 9 passing (7 db-bootstrap + 2 transaction-isolation.dummy)

**Test Execution Time:** ~180ms (bootstrap suite)

**Key Deliverables:**

- `db-setup.ts`: Modular harness with `db-connection.ts`, `db-migrations.ts`, `db-fixtures.ts`,
  `diagnostics.ts`, `errors.ts`, `test-database.ts`
- `test-hooks.ts`: Optional per-suite transactional isolation hooks (beforeEach BEGIN, afterEach
  ROLLBACK)
- `transaction-isolation.dummy.test.ts`: Verification tests for hook-based isolation
- `db-bootstrap.test.ts`: Comprehensive smoke tests with migration guard and rollback verification
- `vitest-global-setup.ts`: Env isolation (TEST_ENV_FILE), default migration enforcement, countries
  reference data seeding
- Added `slonik@48.4.1` dependency for migration runner
- Exported `LATEST_MIGRATION_NAME` from migrations for precise schema guard

**Architecture Decisions:**

1. **External Migrations**: Migrations run once via
   `yarn workspace @accounter/migrations migration:run` before tests; test harness validates schema
   via `LATEST_MIGRATION_NAME` assertion
2. **Transactional Isolation**: Optional hooks provide per-test BEGIN/ROLLBACK for zero data
   persistence; seeding idempotent within transactions
3. **Environment Isolation**: Global setup creates isolated temp `.env` file to prevent pollution of
   repo root
4. **Countries FK Constraints**: New migrations introduced `businesses.country` and
   `user_context.locality` FKs; global setup and seed script ensure 'ISR' country exists
5. **Default Enforcement**: `ENFORCE_LATEST_MIGRATION=1` set by default in global setup to catch
   schema drift locally

---

## Milestone 2.5: Harness Hardening (Completed)

### H1: Modular Refactor & Diagnostics

- [x] Split monolithic `db-setup.ts` responsibilities into modules (`db-connection.ts`,
      `db-migrations.ts`, `db-fixtures.ts`, `diagnostics.ts`, `errors.ts`, `test-database.ts`)
- [x] Added pool health snapshot & metrics emission (conditional via `DEBUG=accounter:test`)
- [x] Implemented `TestDatabase` wrapper exposing connection, seeding, transaction helpers, and
      teardown

### H2: Precise Migration Guard

- [x] Exported `MIGRATIONS` and `LATEST_MIGRATION_NAME` from migrations runner
- [x] Replaced brittle migration count assertions with exact latest migration name lookup
- [x] Added test that intentionally fails when schema not at latest migration (acts as safety net)
- [x] Added standalone CI step verifying latest migration presence independent of test suite

### H3: Environment Isolation

- [x] Added `TEST_ENV_FILE` support in global vitest setup to create a temp `.env` per test run
- [x] Updated `seed-admin-context.ts` to atomically write `DEFAULT_FINANCIAL_ENTITY_ID` to isolated
      env file
- [x] Prevented pollution of repo root `.env` during tests

### H4: Transactional Seeding & Idempotency

- [x] Converted integration tests to seed inside per-test transactions (`withTestTransaction`) with
      automatic rollback
- [x] Ensured admin entities/tax categories/user_context are idempotent across repeated seeds

### H5: CI Workflow

- [x] Added GitHub Actions workflow spinning up Postgres service container
- [x] Run migrations, then test suite with coverage collection
- [x] Independent schema guard script validates `LATEST_MIGRATION_NAME`
- [x] Stores coverage artifact for inspection
- [x] Environment isolation verified via TEST_ENV_FILE logging

### H6: Countries FK Support

- [x] Updated `seedAdminCore` to upsert 'ISR' country within transaction
- [x] Global setup ensures countries table contains 'ISR' for FK defaults
- [x] Fixed `businesses.country` and `user_context.locality` FK constraint violations
- [x] Migration tooling (db-connection-string.cjs) updated to disable SSL locally
- [x] Added `db:reset` script to migrations package for clean DB resets

**Result:** Harness now enforces external migration step, isolates environment writes, provides
precise schema drift detection, surfaces diagnostics without introducing flakiness, and satisfies
new country FK constraints introduced in latest migrations.

---

---

## Milestone 3: Factories

### S11: Factory Scaffolding

- [x] Create folder `packages/server/src/__tests__/factories/`
- [x] Create `ids.ts`
  - [x] Implement `makeUUID(seed?: string): string`
  - [x] Add tests for deterministic behavior with seed
  - [x] Tests verify random UUIDs without seed, deterministic with seed
  - [x] Edge cases: empty string seed, complex strings, consistency checks
- [x] Create `dates.ts`
  - [x] Implement `iso(dateString: string): Date` - UTC-aware date parsing
  - [x] Implement `isoToday(): string` - current date in YYYY-MM-DD format
  - [x] Implement `addDays(dateString: string, days: number): string` - date arithmetic
  - [x] Add tests for leap years, timezone handling, month/year boundaries
- [x] Create `money.ts`
  - [x] Implement `formatNumeric(amount): string` - generic numeric formatting for pgtyped
  - [x] Implement `formatMoney(amount): string` - convenience wrapper
  - [x] Implement `formatDecimal(amount, decimals): string` - fixed precision formatting
  - [x] Implement `parseNumeric(value: string): number` - string to number with validation
  - [x] Add tests with round-trip validation, edge cases (-0, Infinity, NaN)
- [x] All helper tests pass ✅ (62/62 tests passing)

**Test Results:**

- `ids.test.ts`: 9 tests - UUID format validation, deterministic seeding, empty string edge case
- `dates.test.ts`: 22 tests - ISO parsing, invalid date detection, leap year validation, addDays
  boundaries
- `money.test.ts`: 31 tests - formatNumeric/Money/Decimal, parseNumeric with validation, round-trip
  conversion

**Key Implementation Details:**

- `makeUUID`: Hash-based deterministic UUID v4 generation when seed provided; treats empty string as
  valid seed (hash=0)
- `iso`: Validates date components match input to catch invalid dates (e.g., 2023-02-29)
- `parseNumeric`: Normalizes -0 to +0, validates numeric format with regex to reject malformed
  strings like '12.34.56'

### S12: Business/Tax/Account Factories

- [x] Create `packages/server/src/__tests__/factories/business.ts`
  - [x] Implement `createBusiness(overrides?)`
  - [x] Return minimal shape for insert
  - [x] Add unit tests (defaults, overrides, required fields)
- [x] Create `packages/server/src/__tests__/factories/tax-category.ts`
  - [x] Implement `createTaxCategory(overrides?)`
  - [x] Add unit tests
- [x] Create `packages/server/src/__tests__/factories/financial-account.ts`
  - [x] Implement `createFinancialAccount(overrides?)`
  - [x] Support type enum (BANK_ACCOUNT, CREDIT_CARD, CRYPTO_WALLET, etc.)
  - [x] Add unit tests
- [x] All factory tests pass ✅ (93/93 tests passing)

**Test Results:**

- `business.test.ts`: 8 tests - defaults, overrides, contact info, government ID scenarios
- `tax-category.test.ts`: 9 tests - defaults, Hashavshevet integration, tax-excluded categories
- `financial-account.test.ts`: 14 tests - all account types (BANK_ACCOUNT, CREDIT_CARD,
  CRYPTO_WALLET, BANK_DEPOSIT_ACCOUNT, FOREIGN_SECURITIES), ownership scenarios

**Key Implementation Details:**

- `createBusiness`: Generates UUID by default; supports all business fields including exemptDealer,
  isReceiptEnough, country; typed via `IInsertBusinessesParams`
- `createTaxCategory`: Minimal shape with id, hashavshevetName, taxExcluded; typed via
  `IInsertTaxCategoryParams`
- `createFinancialAccount`: Supports 5 account types via enum; generates unique account number by
  default; typed via `IInsertFinancialAccountsParams`
- All factories accept partial overrides and preserve pgtyped type safety
- Factories use existing constants (UUID_REGEX) and helpers (makeUUID) from previous milestones

### S13: Charge/Transaction/Document Factories

- [x] Create `packages/server/src/__tests__/factories/charge.ts`
  - [x] Implement `createCharge({ owner_id, tax_category_id, user_description? }, overrides?)`
  - [x] Add unit tests
- [x] Create `packages/server/src/__tests__/factories/transaction.ts`
  - [x] Implement
        `createTransaction({ charge_id, business_id, amount, currency, event_date, is_fee? }, overrides?)`
  - [x] Use string for numeric types (pgtyped)
  - [x] Add unit tests
- [x] Create `packages/server/src/__tests__/factories/document.ts`
  - [x] Implement
        `createDocument({ charge_id, creditor_id, debtor_id, type, total_amount, currency_code, date }, overrides?)`
  - [x] Add unit tests
- [x] All factory tests pass ✅ (126/126 tests passing)

**Test Results:**

- `charge.test.ts`: 9 tests - required fields, tax_category_id, user_description, overrides, param
  combinations
- `transaction.test.ts`: 12 tests - required fields, numeric amount conversion, Date conversion,
  is_fee flag, currency types, negative/positive amounts
- `document.test.ts`: 12 tests - required fields, document types (INVOICE, RECEIPT, CREDIT_INVOICE),
  Date handling, VAT amounts, file/image URLs, negative amounts

**Key Implementation Details:**

- `createCharge`: Minimal shape based on generateCharge SQL from charges.provider.ts; fields:
  owner_id (required), type, accountant_status, user_description, tax_category_id, optional_vat,
  documents_optional_flag
- `createTransaction`: Based on transactions table schema from migrations; amount/current_balance
  use string for PostgreSQL numeric; accepts string or Date for event_date; converts numeric amount
  to string via formatNumeric
- `createDocument`: Based on documents table schema; total_amount is number (double precision in
  DB); accepts string or Date for date field; supports all document types; includes VAT, serial
  number, file URLs
- All factories follow S11-S12 pattern: minimal required params, partial overrides, pgtyped types,
  deterministic UUIDs
- Factories use helpers from S11: makeUUID, formatNumeric for type-safe database insertion

**Milestone 3 Complete:** All factory scaffolding and core data factories implemented and tested ✅
**Total Tests:** 133 passing (9 ids + 22 dates + 31 money + 8 business + 9 tax-category + 14
financial-account + 9 charge + 12 transaction + 12 document + 7 integration)

**Milestone 4 Progress:** Fixture types, validation, and loader with transaction support complete ✅
**Total Tests (Milestone 4):** 28 passing (18 fixture-validation + 10 fixture-loader) **Total Tests
(Milestone 5 - S19):** 11 passing (expense-scenario-a validation) **Total Tests (All):** 213 passing
(factories + helpers + fixtures)

### S14: Factory Integration

- [x] Review all factory tests
- [x] Ensure type safety across all factories
- [x] Verify sensible defaults
- [x] Verify override behavior works correctly
- [x] Create centralized export module (`index.ts`)
- [x] Create integration tests demonstrating factory composition
- [x] All tests pass ✅ (133/133 tests passing)

**Integration Test Coverage:**

- `index.test.ts`: 7 tests - import validation, complete expense scenario, deterministic UUIDs, all
  account types, numeric conversions, document types, partial overrides

**Key Deliverables:**

- `index.ts`: Centralized exports for all factories and helpers with comprehensive JSDoc examples
- `index.test.ts`: Integration tests proving factories work together to create complete scenarios
- All factories type-safe via pgtyped interfaces
- Consistent override pattern across all factories
- Deterministic UUID generation via makeUUID with seeds
- Proper numeric handling for PostgreSQL (string for numeric, number for double precision)

**Factory Design Patterns Verified:**

1. **Type Safety**: All factories use pgtyped-generated types for compile-time validation
2. **Minimal Defaults**: Required fields enforced; optional fields default to null/sensible values
3. **Partial Overrides**: All factories accept `Partial<T>` for flexible customization
4. **Deterministic IDs**: UUID seeds produce consistent IDs for reproducible tests
5. **Composition**: Factories can be combined to create complete data scenarios (charge +
   transaction + document)

---

## Milestone 4: Fixture Loader ✅

### S15: Fixture Interfaces

- [x] Create `packages/server/src/__tests__/helpers/fixture-types.ts`
  - [x] Define `FixtureBusinesses` interface
  - [x] Define `FixtureTaxCategories` interface
  - [x] Define `FixtureAccounts` interface
  - [x] Define `FixtureCharges` interface
  - [x] Define `FixtureTransactions` interface
  - [x] Define `FixtureDocuments` interface
  - [x] Define `Fixture` aggregating all lists + optional expectations
  - [x] Define `LedgerExpectation` interface for expected outcomes
- [x] All fixture types defined ✅

**Key Implementation Details:**

- `FixtureBusinesses`: Array of `IInsertBusinessesParams['businesses']` entries
- `FixtureTaxCategories`: Array of `IInsertTaxCategoryParams` entries
- `FixtureAccounts`: Array of `IInsertFinancialAccountsParams['bankAccounts']` entries
- `FixtureCharges`: Array of `ChargeInsertParams` from charge factory
- `FixtureTransactions`: Array of `TransactionInsertParams` from transaction factory
- `FixtureDocuments`: Array of `DocumentInsertParams` from document factory
- `Fixture`: Aggregates all fixture types with optional `expectations` for assertions
- `LedgerExpectation`: Defines expected ledger records (count, debit/credit entities, amounts,
  balanced)
- All interfaces use pgtyped-compatible types from factories and generated types

### S16: Fixture Validation

- [x] Create `packages/server/src/__tests__/helpers/fixture-validation.ts`
- [x] Implement `validateFixture(fixture)`
  - [x] Return `{ ok: true }` or `{ ok: false; errors: string[] }`
  - [x] Validate referential integrity (transaction.charge_id exists, etc.)
  - [x] Validate required keys present
  - [x] Detect duplicate IDs
  - [x] Validate business references (charges, transactions, documents)
  - [x] Validate charge references (transactions, documents)
  - [x] Validate tax category references (charges)
  - [x] Validate account owner references
- [x] Implement `assertValidFixture(fixture)` helper that throws on validation failure
- [x] Create validation unit tests
  - [x] Test: valid complete fixture passes
  - [x] Test: valid minimal fixture passes
  - [x] Test: missing charge_id fails
  - [x] Test: invalid business reference fails
  - [x] Test: invalid tax category reference fails
  - [x] Test: invalid charge reference fails (transactions and documents)
  - [x] Test: missing required fields fails
  - [x] Test: duplicate IDs detected
  - [x] Test: financial account owner validation
  - [x] Test: assertValidFixture throws with formatted message
- [x] All tests pass ✅ (18/18 tests passing)

**Test Results:**

- `fixture-validation.test.ts`: 18 tests - complete fixture validation, minimal fixture, referential
  integrity checks, missing required fields, duplicate ID detection, assertValidFixture behavior

**Key Implementation Details:**

- `validateFixture`: Comprehensive validation covering all fixture entity types
- Builds ID sets for quick lookup (businessIds, taxCategoryIds, accountIds, chargeIds)
- Validates foreign key references before they would cause DB constraint violations
- Collects all errors before returning (doesn't fail fast) for better developer experience
- Special handling for account_id: only validates presence, not reference (accounts use
  accountNumber not UUID)
- `assertValidFixture`: Throws Error with formatted multi-line error message for test clarity
- Validation catches: missing IDs, duplicate IDs, invalid references, missing required fields

### S17: Fixture Insertion

- [x] Create `packages/server/src/__tests__/helpers/fixture-loader.ts`
- [x] Implement `insertFixture(client, fixture): Promise<Map<string, string>>`
  - [x] Validate fixture first
  - [x] Insert in order: entities → businesses → tax_categories → accounts → charges → transactions
        → documents
  - [x] Use SAVEPOINT/ROLLBACK TO SAVEPOINT per section
  - [x] Throw `FixtureInsertionError` with context on error
  - [x] Return id mapping
- [x] Create insertion tests using `withTransaction`
  - [x] Test: successful insertion (complete minimal fixture)
  - [x] Test: successful insertion with transactions and documents
  - [x] Test: rollback on error (savepoint-based)
  - [x] Test: order enforcement (businesses → tax_categories → accounts → charges → transactions →
        documents)
  - [x] Test: validation before insertion
  - [x] Test: idempotent insertion (ON CONFLICT handling)
  - [x] Test: empty fixture sections handled gracefully
  - [x] Test: multiple entities insertion
  - [x] Test: transactions with generated source_id
- [x] Tests pass ✅ (10/10 tests passing)

**Implementation Details:**

- `insertFixture` performs ordered insertion across 6 sections with savepoint-based rollback
- Transaction insertion bypasses creditcard triggers by using `etherscan_id` in
  `transactions_raw_list`
- Account UUID lookup: resolves `account_number` strings to UUID `id` for transaction FK references
- Required NOT NULL fields handled: `source_reference`, `source_origin`, `origin_key`
- Each transaction gets unique etherscan source ID to prevent collisions
- Source ID always generated from raw list insert (ignores factory default)
- Financial accounts return both `account_number` and auto-generated UUID `id`
- Custom error type `FixtureInsertionError` with savepoint context for debugging

### S18: clearData Utility

- [ ] Add `clearData(client, tables[])` to `fixture-loader.ts`
  - [ ] Use TRUNCATE ... RESTART IDENTITY CASCADE
  - [ ] Handle dependencies correctly
- [ ] Add unit tests
  - [ ] Test: clear specific tables
  - [ ] Test: data actually removed
- [ ] Tests pass ✅

**Milestone 4 Summary:**

- ✅ S15: Fixture type interfaces defined for all entity types
- ✅ S16: Comprehensive fixture validation with 18 tests (referential integrity, duplicate IDs,
  required fields)
- ✅ S17: Complete fixture loader with transaction support (10 tests, savepoint-based rollback)
- ⏳ S18: clearData utility (deferred - not critical for current test isolation strategy using
  transactions)

**Key Achievements:**

- Ordered insertion pipeline: businesses → tax_categories → accounts → charges → transactions →
  documents
- Trigger avoidance: transactions use etherscan_id to bypass auto-charge creation
- Account reference resolution: automatic UUID lookup for account_number strings
- Transaction isolation: all tests use withTestTransaction for automatic rollback
- Comprehensive error handling: FixtureInsertionError with savepoint context
- Full test coverage: 202/202 tests passing across all factories and helpers

---

## Milestone 5: Expense Scenario A + Integration Test

### S19: Expense Scenario A Fixture ✅

- [x] Create folder `packages/server/src/__tests__/fixtures/expenses/`
- [x] Create `expense-scenario-a.ts`
  - [x] Define admin owner (from seed)
  - [x] Define supplier business "Local Supplier Ltd"
  - [x] Define charge (owner_id = admin, tax_category = expense category)
  - [x] Define transaction (ILS negative amount, business_id = supplier)
  - [x] Define document (Receipt in ILS, matching transaction)
  - [x] Define expectations: ledger (debit expense, credit bank)
  - [x] Export as `expenseScenarioA`
- [x] Create validation test for fixture
  - [x] Test: fixture compiles
  - [x] Test: fixture validates
  - [x] Test: structure verification (2 businesses, 2 tax categories, 1 charge, 1 transaction, 1
        document)
  - [x] Test: referential integrity (IDs match between charge/transaction/document)
  - [x] Test: amount matching (transaction -500 ILS, document 500 ILS)
  - [x] Test: currency matching (both ILS)
  - [x] Test: date matching (both 2024-01-15)
  - [x] Test: ledger expectations defined
- [x] Validation test passes ✅ (11/11 tests passing)

**Implementation Details:**

- Created complete expense fixture with admin business + local supplier
- Transaction: -500 ILS (expense/outflow) on 2024-01-15
- Document: Receipt for 500 ILS matching transaction date
- Tax categories: General Expenses (debit) + Bank Account (credit)
- Ledger expectations: 2 records, balanced at 500 ILS debit/credit
- All factories used: createBusiness, createTaxCategory, createCharge, createTransaction,
  createDocument
- Deterministic UUIDs via makeUUID for reproducible tests

### S20: Ledger Integration Test for Scenario A

- [ ] Create `packages/server/src/modules/ledger/__tests__/ledger-scenario-a.integration.test.ts`
- [ ] Use `setupDbHooks()`
- [ ] Implement test
  - [ ] Insert Scenario A via `insertFixture`
  - [ ] Trigger ledger generation for created charge
  - [ ] Query `ledger_records`
  - [ ] Normalize to simplified view
  - [ ] Assert: record count matches expectation
  - [ ] Assert: balanced debit/credit sums
  - [ ] Assert: correct entity IDs
  - [ ] Assert: amounts match expectations
- [ ] Test passes ✅
- [ ] Test repeats deterministically ✅

### S21: Pretty Diff on Failure

- [ ] Add diff helper to test
  - [ ] Show expected vs actual ledger entries
  - [ ] Highlight differences clearly
- [ ] Test failure messages are helpful ✅

---

## Milestone 6: Expense Scenario B (USD) + Integration Test

### S22: Exchange Rate Mock Strategy

- [ ] Create `packages/server/src/__tests__/helpers/exchange-mock.ts`
- [ ] Implement function to override `ExchangeProvider.getExchangeRates`
  - [ ] Return specified rate (e.g., USD→ILS)
  - [ ] Wire into admin context/injector
- [ ] Create test proving mock works
  - [ ] Test: `getExchangeRates` returns mocked value
- [ ] Test passes ✅

### S23: Expense Scenario B Fixture

- [ ] Create `packages/server/src/__tests__/fixtures/expenses/expense-scenario-b.ts`
  - [ ] Define supplier "US Vendor LLC"
  - [ ] Define charge (owner_id = admin, tax_category = expense category)
  - [ ] Define transaction (USD negative amount, business_id = supplier)
  - [ ] Define document (Invoice in USD)
  - [ ] Define expectations: ledger with local currency conversion + exchange record (if applicable)
  - [ ] Export as `expenseScenarioB`
- [ ] Create validation test
  - [ ] Test: fixture compiles
  - [ ] Test: fixture validates
- [ ] Validation test passes ✅

### S24: Ledger Integration Test for Scenario B

- [ ] Create `packages/server/src/modules/ledger/__tests__/ledger-scenario-b.integration.test.ts`
- [ ] Use `setupDbHooks()` and `insertFixture`
- [ ] Mock exchange rate (e.g., 3.5 ILS per USD)
- [ ] Implement test
  - [ ] Insert Scenario B
  - [ ] Trigger ledger generation
  - [ ] Fetch `ledger_records`
  - [ ] Assert: totals in local currency
  - [ ] Assert: balance correct
  - [ ] Assert: entity correctness
  - [ ] Assert: conversion within tolerance
- [ ] Test passes ✅
- [ ] Test is deterministic ✅

---

## Final Polish & Documentation

### Prompt 18: Scripts and Docs

- [ ] Add to `packages/server/package.json`:
  - [ ] `"seed:admin": "tsx packages/server/scripts/seed-admin-context.ts"`
  - [ ] `"test:integration": "vitest --run --dir packages/server/src/modules/ledger/__tests__"`
- [ ] Update `docs/demo-test-data-plan.md` with any path corrections
- [ ] Verify scripts execute in local dev environment
  - [ ] Test: `yarn workspace @accounter/server seed:admin`
  - [ ] Test: `yarn workspace @accounter/server test:integration`
- [ ] Scripts run successfully ✅

---

## Environment Setup Checklist

### Prerequisites

- [ ] Docker installed and running
- [ ] PostgreSQL container available via docker-compose
- [ ] Node.js and Yarn installed
- [ ] Dependencies installed (`yarn install`)

### Environment Configuration

- [ ] `.env` file exists in repo root
- [ ] `.env.test` created with test database config:
  ```
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=postgres
  POSTGRES_HOST=localhost
  POSTGRES_PORT=5432
  POSTGRES_DB=accounter_test
  POSTGRES_SSL=0
  DEFAULT_LOCAL_CURRENCY=ILS
  ```

### Environment Isolation & Schema Guard (New)

- [x] Global test setup creates isolated temp env (`TEST_ENV_FILE`) and points writes there
- [x] `seed-admin-context.ts` performs atomic env var write (temp file + rename)
- [x] Test suite asserts latest migration name (`LATEST_MIGRATION_NAME`) present rather than relying
      on counts
- [x] CI job includes separate migration name guard step

### Database Setup

- [ ] Start PostgreSQL: `docker compose -f docker/docker-compose.dev.yml up -d postgres`
- [ ] Run migrations: `yarn workspace @accounter/migrations migration:run`
- [ ] Verify migrations applied successfully

---

## Verification & Quality Checks

### Code Quality

- [ ] All TypeScript files have proper types (no `any` where avoidable)
- [ ] All functions have JSDoc comments
- [ ] Error handling is comprehensive
- [ ] Logging is informative but not verbose

### Test Quality

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Tests are deterministic (no flaky tests)
- [ ] Test coverage is adequate (factories, validators, loaders all covered)
- [ ] Transactional isolation works correctly

### Documentation

- [ ] README updated with new test commands
- [ ] `demo-test-data-plan.md` is accurate and up-to-date
- [ ] `demo-test-data-prompt-plan.md` reflects actual implementation
- [ ] All TODO items in this file are completed

---

## Future Enhancements (Phase 2+)

### Income Scenarios

- [ ] Income Scenario A (ILS Invoice, later payment)
- [ ] Income Scenario B (Foreign currency invoice, partial payments)
- [ ] Exchange revaluation scenario

### Advanced Testing

- [ ] Matching logic tests (autoMatchCharges)
- [ ] Negative tests (missing tax category, unbalanced ledger)
- [ ] Multi-currency scenarios
- [ ] Partial payment scenarios

### Source Ingestion (Phase 3)

- [ ] Raw scraper table insertion utilities
- [ ] End-to-end: raw → transaction → charge → match → ledger
- [ ] Gmail listener simulation
- [ ] Document upload flow simulation

### CI/CD

- [ ] GitHub Actions workflow
- [ ] Automated test runs on PR
- [x] Coverage reporting (artifact uploaded; threshold enforcement pending)
- [ ] Performance benchmarks
- [x] Latest migration guard step (schema version enforcement)
- [x] Environment isolation verified in CI logs

---

## Notes

- Check off items as they are completed
- Add sub-items if tasks need to be broken down further
- Link to PRs or commits for traceability
- Update this file as the project evolves

**Last Updated:** [Date of completion]
