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

### S9: Vitest Hooks (Deferred - Manual Setup Pattern)

- [x] ~~Create `packages/server/src/__tests__/helpers/test-hooks.ts`~~ (Deferred)
  - Note: Using manual `beforeAll` setup in each test file for flexibility
  - Tests call `connectTestDb()` and `seedAdminOnce()` directly
- [x] ~~Implement `setupDbHooks()`~~ (Deferred)
  - Note: Individual tests use `withTestTransaction` wrapper instead
- [x] ~~Create/update `packages/server/scripts/vitest-setup.ts`~~ (Not needed)
- [x] ~~Update root `vitest.config.ts` if needed~~ (Not needed)
  - Current approach works with existing vitest config

### S10: Smoke Test

- [x] Create `packages/server/src/__tests__/db-bootstrap.test.ts`
  - [x] Connect DB
  - [x] ~~Run migrations~~ (Assumes migrations already run via `yarn db:init`)
  - [x] Seed admin once
  - [x] Query `user_context`
  - [x] Assert data exists
  - [x] Verify migrations table (100+ migrations)
  - [x] Verify admin business creation
  - [x] Verify 3 authority businesses (VAT, Tax, Social Security)
  - [x] Verify 19 tax categories
  - [x] Verify user_context structure
  - [x] Verify transaction isolation (withTestTransaction rollback)
  - [x] Verify idempotency of seedAdminOnce
- [x] Smoke test passes ✅ (9/9 tests passing)
- [x] Transaction isolation test passes ✅ **Milestone 2 Complete:** DB test harness implemented
      with connection pooling, migration runner, and admin seeding ✅ **Total Tests:** 55 passing
      (46 from Milestone 1 + 9 db-bootstrap smoke tests) **Test Execution Time:** ~1 second

**Key Deliverables:**

- `db-setup.ts`: Connection pool management, migration runner integration, admin seeding with locks
- `db-bootstrap.test.ts`: Comprehensive smoke tests verifying full pipeline
- Added `slonik@48.4.1` dependency for migration runner
- Re-exported transaction wrappers for convenience

**Architecture Decision:** Migrations assumed to be run via `yarn db:init` before tests rather than
programmatically in each test run to avoid FK constraint violations with existing data.

**Note:** Running migrations programmatically in tests can cause FK constraint violations if
database has existing data. Current implementation assumes migrations are run once via
`yarn db:init` before tests.

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

**Result:** Harness now enforces external migration step, isolates environment writes, provides
precise schema drift detection, and surfaces diagnostics without introducing flakiness.

---

---

## Milestone 3: Factories

### S11: Factory Scaffolding

- [ ] Create folder `packages/server/src/__tests__/factories/`
- [ ] Create `ids.ts`
  - [ ] Implement `makeUUID(seed?: string): string`
  - [ ] Add tests for deterministic behavior with seed
- [ ] Create `dates.ts`
  - [ ] Implement `iso(date: string): Date`
  - [ ] Add tests
- [ ] Create `money.ts`
  - [ ] Implement helpers to format numeric for pgtyped (string)
  - [ ] Add tests
- [ ] All helper tests pass ✅

### S12: Business/Tax/Account Factories

- [ ] Create `packages/server/src/__tests__/factories/business.ts`
  - [ ] Implement `createBusiness(overrides?)`
  - [ ] Return minimal shape for insert
  - [ ] Add unit tests (defaults, overrides, required fields)
- [ ] Create `packages/server/src/__tests__/factories/tax-category.ts`
  - [ ] Implement `createTaxCategory(overrides?)`
  - [ ] Add unit tests
- [ ] Create `packages/server/src/__tests__/factories/financial-account.ts`
  - [ ] Implement `createFinancialAccount(overrides?)`
  - [ ] Support type enum
  - [ ] Add unit tests
- [ ] All factory tests pass ✅

### S13: Charge/Transaction/Document Factories

- [ ] Create `packages/server/src/__tests__/factories/charge.ts`
  - [ ] Implement `createCharge({ owner_id, tax_category_id, user_description? }, overrides?)`
  - [ ] Add unit tests
- [ ] Create `packages/server/src/__tests__/factories/transaction.ts`
  - [ ] Implement
        `createTransaction({ charge_id, business_id, amount, currency, event_date, is_fee? }, overrides?)`
  - [ ] Use string for numeric types (pgtyped)
  - [ ] Add unit tests
- [ ] Create `packages/server/src/__tests__/factories/document.ts`
  - [ ] Implement
        `createDocument({ charge_id, creditor_id, debtor_id, type, total_amount, currency_code, date }, overrides?)`
  - [ ] Add unit tests
- [ ] All factory tests pass ✅

### S14: Factory Integration

- [ ] Review all factory tests
- [ ] Ensure type safety across all factories
- [ ] Verify sensible defaults
- [ ] Verify override behavior works correctly
- [ ] All tests pass ✅

---

## Milestone 4: Fixture Loader

### S15: Fixture Interfaces

- [ ] Create `packages/server/src/__tests__/helpers/fixture-types.ts`
  - [ ] Define `FixtureBusinesses` interface
  - [ ] Define `FixtureTaxCategories` interface
  - [ ] Define `FixtureAccounts` interface
  - [ ] Define `FixtureCharges` interface
  - [ ] Define `FixtureTransactions` interface
  - [ ] Define `FixtureDocuments` interface
  - [ ] Define `Fixture` aggregating all lists + optional expectations

### S16: Fixture Validation

- [ ] Create `packages/server/src/__tests__/helpers/fixture-validation.ts`
- [ ] Implement `validateFixture(fixture)`
  - [ ] Return `{ ok: true }` or `{ ok: false; errors: string[] }`
  - [ ] Validate referential integrity (transaction.charge_id exists, etc.)
  - [ ] Validate required keys present
- [ ] Create validation unit tests
  - [ ] Test: valid fixture passes
  - [ ] Test: missing charge_id fails
  - [ ] Test: invalid references fail
- [ ] Tests pass ✅

### S17: Fixture Insertion

- [ ] Create `packages/server/src/__tests__/helpers/fixture-loader.ts`
- [ ] Implement `insertFixture(client, fixture): Promise<Map<string, string>>`
  - [ ] Validate fixture first
  - [ ] Insert in order: entities → businesses → tax_categories → accounts → charges → transactions
        → documents
  - [ ] Use SAVEPOINT/ROLLBACK TO SAVEPOINT per section
  - [ ] Throw `FixtureValidationError` with context on error
  - [ ] Return id mapping
- [ ] Create insertion tests using `withTransaction`
  - [ ] Test: successful insertion
  - [ ] Test: rollback on error
  - [ ] Test: order enforcement
- [ ] Tests pass ✅

### S18: clearData Utility

- [ ] Add `clearData(client, tables[])` to `fixture-loader.ts`
  - [ ] Use TRUNCATE ... RESTART IDENTITY CASCADE
  - [ ] Handle dependencies correctly
- [ ] Add unit tests
  - [ ] Test: clear specific tables
  - [ ] Test: data actually removed
- [ ] Tests pass ✅

---

## Milestone 5: Expense Scenario A + Integration Test

### S19: Expense Scenario A Fixture

- [ ] Create folder `packages/server/src/__tests__/fixtures/expenses/`
- [ ] Create `expense-scenario-a.ts`
  - [ ] Define admin owner (from seed)
  - [ ] Define supplier business "Local Supplier Ltd"
  - [ ] Define charge (owner_id = admin, tax_category = expense category)
  - [ ] Define transaction (ILS negative amount, business_id = supplier)
  - [ ] Define document (Receipt in ILS, matching transaction)
  - [ ] Define expectations: ledger (debit expense, credit bank)
  - [ ] Export as `expenseScenarioA`
- [ ] Create validation test for fixture
  - [ ] Test: fixture compiles
  - [ ] Test: fixture validates
- [ ] Validation test passes ✅

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
