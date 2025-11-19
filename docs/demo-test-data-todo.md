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

- [ ] Create `packages/server/scripts/seed-admin-context.ts`
- [ ] Implement `seedAdminCore(client)` function
  - [ ] Create admin business entity
  - [ ] Create authorities (VAT, Tax, Social Security)
  - [ ] Create general tax categories (DEFAULT, Exchange Rates, Income Exchange Rates, etc.)
  - [ ] Create cross-year categories
  - [ ] Create tags (if needed)
  - [ ] Upsert `user_context` row with ILS default currency
  - [ ] Use `writeEnvVar` to set `DEFAULT_FINANCIAL_ENTITY_ID`
  - [ ] Return `{ adminEntityId }`
- [ ] Create `packages/server/src/__tests__/seed-admin-context.integration.test.ts`
  - [ ] Connect DB, BEGIN transaction
  - [ ] Call `seedAdminCore`
  - [ ] Assert `user_context` exists
  - [ ] Assert mandatory entities referenced
  - [ ] ROLLBACK
- [ ] Integration test passes ✅

### S6: CLI Wrapper (Deferred to Prompt 18)

- [ ] Add package.json script (covered in Milestone 6)

---

## Milestone 2: DB Test Harness

### S7: connectTestDb

- [ ] Create `packages/server/src/__tests__/helpers/db-setup.ts`
- [ ] Implement `connectTestDb(): Promise<Pool>`
  - [ ] Read env variables (POSTGRES\_\*)
  - [ ] Return pooled client
  - [ ] Handle connection errors gracefully

### S8: runMigrationsIfNeeded & seedAdminOnce

- [ ] Add `runMigrationsIfNeeded(pool)` to `db-setup.ts`
  - [ ] Invoke migrations runner with env
  - [ ] Handle already-applied migrations
- [ ] Add `seedAdminOnce(pool)` to `db-setup.ts`
  - [ ] Implement lock mechanism (table or in-memory flag)
  - [ ] Call `seedAdminCore` only once per test run
- [ ] Add `withTransaction<T>(pool, fn)` to `db-setup.ts`
  - [ ] BEGIN transaction
  - [ ] Execute function
  - [ ] ROLLBACK regardless of success/failure

### S9: Vitest Hooks

- [ ] Create `packages/server/src/__tests__/helpers/test-hooks.ts`
- [ ] Implement `setupDbHooks()`
  - [ ] beforeAll: connect pool, run migrations, seedAdminOnce
  - [ ] beforeEach: BEGIN transaction
  - [ ] afterEach: ROLLBACK transaction
  - [ ] afterAll: end pool
- [ ] Create/update `packages/server/scripts/vitest-setup.ts`
  - [ ] Import and call `setupDbHooks()`
- [ ] Update root `vitest.config.ts` if needed
  - [ ] Include vitest-setup.ts in setupFiles

### S10: Smoke Test

- [ ] Create `packages/server/src/__tests__/smoke/db-bootstrap.test.ts`
  - [ ] Connect DB
  - [ ] Run migrations
  - [ ] Seed admin once
  - [ ] Query `user_context`
  - [ ] Assert data exists
- [ ] Smoke test passes ✅
- [ ] Dummy isolation test: insert row, verify not visible in next test ✅

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
- [ ] Coverage reporting
- [ ] Performance benchmarks

---

## Notes

- Check off items as they are completed
- Add sub-items if tasks need to be broken down further
- Link to PRs or commits for traceability
- Update this file as the project evolves

**Last Updated:** [Date of completion]
