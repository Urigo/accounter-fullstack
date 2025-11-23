# Demo / Staging Test Data – TDD Implementation Prompts

## Overview

This document contains a detailed, step-by-step blueprint for building the demo/staging data and
integration testing infrastructure for `@accounter/server`. The prompts are designed for a
code-generation LLM to implement incrementally in a test-driven manner, with each step building on
the previous one, ensuring no orphaned code and strong test coverage.

## Plan Summary

Build a robust, DB-backed test and demo data layer for `@accounter/server`, starting from
already-matched charges, focusing first on happy-path expense flows and ledger generation. Use
Vitest, PostgreSQL migrations, modular seed, factories, a fixture loader, and transactional test
isolation to ensure stability and speed. Defer ingestion (scrapers, Gmail) until Phase 3.

### High-Level Steps

1. Extract and harden admin seeding into a modular, idempotent script (reusing `scripts/seed.ts`
   logic).
2. Add a DB test harness for Vitest with transactional isolation and migration bootstrapping.
3. Implement factories for businesses, tax categories, accounts, charges, transactions, documents.
4. Add a fixture loader that validates and inserts in correct order within a transaction.
5. Create Expense Scenario A (ILS receipt expense) fixtures and a ledger generation integration
   test.
6. Create Expense Scenario B (USD invoice expense) fixtures + deterministic exchange rates + ledger
   test.

---

## Milestones & Chunks

### Milestone 1: Seed Admin Context (Idempotent)

- **Chunk 1.1**: Create `seed-admin-context` script split from `scripts/seed.ts`.
- **Chunk 1.2**: Add idempotency (existence checks / ON CONFLICT).
- **Chunk 1.3**: Minimal CLI and logging; write `.env` variables (e.g.,
  `DEFAULT_FINANCIAL_ENTITY_ID`).
- **Chunk 1.4**: Unit test the pure helpers (e.g., env update, SQL builder); smoke test script with
  a local DB.

### Milestone 2: DB Test Harness

- **Chunk 2.1**: Add `db-setup.ts` (connect, seed admin context idempotently).
- **Chunk 2.2**: Add transactional isolation helpers (`withTestTransaction`,
  `withConcurrentTransactions`).
- **Chunk 2.3**: Modularize harness into discrete helper files (`db-connection`, `db-migrations`,
  `db-fixtures`, `diagnostics`, `errors`, `test-database`).
- **Chunk 2.4**: Add diagnostics (pool health snapshot, connection retry/backoff).
- **Chunk 2.5**: Export `MIGRATIONS` & `LATEST_MIGRATION_NAME` from migrations package (schema
  version precision).
- **Chunk 2.6**: Add exact latest migration name assertion test (fails if schema outdated;
  migrations NOT auto-run in test harness).
- **Chunk 2.7**: Introduce isolated env file via `TEST_ENV_FILE` in global setup for atomic,
  sandboxed env var writes.
- **Chunk 2.8**: CI workflow: migrations step (external), test run, independent schema guard script,
  coverage artifact.
- **Chunk 2.9**: Transactional isolation hooks (optional per-suite `test-hooks.ts`).
- **Chunk 2.10**: Countries FK support and migration tooling fixes (SSL handling, db:reset).

### Milestone 3: Factories

- **Chunk 3.1**: Factory scaffolding (UUID helper, date helper).
- **Chunk 3.2**: Business, tax category, financial account factories.
- **Chunk 3.3**: Charge, transaction, document factories.
- **Chunk 3.4**: Factory unit tests with type safety.

### Milestone 4: Fixture Loader

- **Chunk 4.1**: Define fixture interfaces and validation.
- **Chunk 4.2**: Insert order resolver (entities → businesses → categories → accounts → charges →
  transactions → documents).
- **Chunk 4.3**: Transactional insertion with rollback and detailed errors.
- **Chunk 4.4**: Tests for validation errors + happy path.

### Milestone 5: Expense Scenario A + Integration Test

- **Chunk 5.1**: Define Scenario A fixture (ILS receipt).
- **Chunk 5.2**: Load fixture in test; call ledger generation resolver.
- **Chunk 5.3**: Assert balanced entries and correct entities/amounts.
- **Chunk 5.4**: Add compact diff on mismatch.

### Milestone 6: Expense Scenario B (USD) + Integration Test

- **Chunk 6.1**: Deterministic exchange rate injection (mock provider).
- **Chunk 6.2**: Define Scenario B fixture (USD invoice).
- **Chunk 6.3**: Test ledger foreign→local conversion and optional exchange record.
- **Chunk 6.4**: Assert balance and conversion tolerance.

---

## Micro-Steps (Right-Sized Tasks)

### Milestone 1

- **S1**: Implement `writeEnvVar(path, key, value)` with tests.
- **S2**: Implement `ensureFinancialEntity(client, { name, type, ownerId? })`.
- **S3**: Implement `ensureBusinessForEntity(client, entityId, options)`.
- **S4**: Implement `ensureTaxCategoryForEntity(client, entityId, options)`.
- **S5**: Implement `seedAdminCore(client, options)` composition + log outcomes.
- **S6**: CLI wrapper `scripts/seed-admin-context.ts` (connect, call, exit codes).

### Milestone 2

- **S7**: Implement `connectTestDb()` that uses env, returns pooled client.
- **S8**: Implement `runMigrationsIfNeeded()` and `seedAdminOnce()` with a lock table/flag.
- **S9**: Vitest hooks `beforeAll/afterAll` (connect/disconnect), `beforeEach/afterEach`
  (BEGIN/ROLLBACK), migration enforcement, countries seeding.
- **S10**: Smoke test "can query user_context", latest migration guard, rollback verification.

### Milestone 3

- **S11**: `makeUUID(seed?)`, `iso(x)`, money helpers.
- **S12**: `createBusiness`, `createTaxCategory`, `createFinancialAccount`.
- **S13**: `createCharge`, `createTransaction`, `createDocument`.
- **S14**: Factory tests (shape correctness, defaults, override behavior).

### Milestone 4

- **S15**: Define `Fixture` interfaces: lists + expectations.
- **S16**: Implement `validateFixture(fixture)`; unit tests.
- **S17**: Implement `insertFixture(client, fixture)` with strict order; unit tests using
  transactional harness.
- **S18**: Implement `clearData(client, tables[])`; unit tests.

### Milestone 5

- **S19**: Implement fixture `expense-scenario-a.ts`.
- **S20**: Integration test loads fixture, invokes ledger resolver, validates balance and entities.
- **S21**: Add pretty diff on failure.

### Milestone 6

- **S22**: Add exchange provider mock strategy (context injector override).
- **S23**: Implement fixture `expense-scenario-b.ts` with USD amounts and fixed rate.
- **S24**: Integration test for Scenario B (conversion correctness, balance).

---

## Architectural Improvements (Implemented in S1-S3)

The following infrastructure improvements were implemented ahead of schedule during the S1-S3
hardening phase. See `docs/architectural-improvements-s1-s3.md` for complete details.

### Shared Configuration (`test-db-config.ts`)

- `testDbConfig`: Centralized database configuration with environment variable support
- `testDbSchema`: Configurable schema name (defaults to 'accounter_schema')
- `qualifyTable()`: Helper for schema-qualified table names

**Benefits**: Eliminates hardcoded credentials, enables schema-per-test-run patterns, single source
of truth.

### Custom Error Hierarchy (`seed-errors.ts`)

- `SeedError`: Base class with structured context and `toJSON()` serialization
- `EntityValidationError`: Input validation failures with detailed error lists
- `EntityNotFoundError`: Missing entity references
- `ConstraintViolationError`: Database constraint violations
- `SeedConfigurationError`: Configuration issues

**Benefits**: Specific error types for different failure modes, rich debugging context, better error
handling via `instanceof` checks.

### Transaction Wrappers (`test-transaction.ts`)

- `withTestTransaction<T>(pool, fn)`: Single transaction with auto-rollback
- `withConcurrentTransactions<T>(pool, fns)`: Parallel transactions for race testing

**Benefits**: Eliminates boilerplate, guaranteed rollback on errors, enables functional test
patterns, simplifies concurrent access testing.

### Test Coverage

- **Concurrent Access Tests**: 3 race condition scenarios in `seed-helpers.concurrent.test.ts`
- **Validation Tests**: 5 new validation tests across S1-S3
- **Total Test Suite**: 33 tests, 100% passing in ~400ms

---

## TDD Prompts for Code-Generation LLM

Each prompt builds on the previous, tests first, no orphan code, and wires into the suite.

**Note**: Prompts 1-7 have been completed with architectural enhancements and transactional
isolation. Continue from Prompt 8 (Factory Scaffolding).

---

### Prompt 1: writeEnvVar helper

```text
Task: Create a pure helper to set/update an env var in a file, with tests.

Context:
- Repo root has `.env` used by scripts.
- We need a helper to ensure `DEFAULT_FINANCIAL_ENTITY_ID` and others are written/updated.

Requirements:
- Add a new file: `packages/server/src/__tests__/helpers/env-file.ts` exporting `writeEnvVar(filePath: string, key: string, value: string): Promise<void>`.
- Behavior:
  - If `key` exists, replace its value.
  - Else append `\nkey=value`.
  - Preserve other lines untouched.
  - Use atomic writes (temp file + rename) to prevent corruption on crash.
  - Add JSDoc with security warnings about plaintext storage.
- Add tests in `packages/server/src/__tests__/helpers/env-file.test.ts` using a temp file.
- Use Vitest.
- Do not modify global `.env` in tests. Use `fs.mkdtemp` and `os.tmpdir`.

Acceptance:
- Tests cover: create new var; update existing var; no extra trailing whitespace; idempotent when value unchanged.

Run:
- vitest run packages/server/src/__tests__/helpers/env-file.test.ts

Status: ✅ COMPLETED (S1) - Enhanced with atomic writes and comprehensive documentation.
```

---

### Prompt 2: ensureFinancialEntity

```textconfigurable via `testDbSchema`from`test-db-config.ts`.

- Table: `financial_entities (id uuid pk, name text, type text, owner_id uuid nullable, ...)`.
- Use pg `Client` (or `Pool`) and run inside a transaction opened by test harness (to rollback).
- Shared DB config: Import from `packages/server/src/__tests__/helpers/test-db-config.ts`.

Requirements:

- File: `packages/server/src/__tests__/helpers/seed-helpers.ts` export
  `ensureFinancialEntity(client, {name, type, ownerId?}) -> Promise<{id: string}>`.
- Type-safe: Use `FinancialEntityType` union type: 'business' | 'tax_category' | 'tag'.
- Input validation: Reject empty names, invalid types with `EntityValidationError`.
- If exists by `(name, type, owner_id)`, return it; otherwise insert and return.
- Use `SELECT ... LIMIT 1` before `INSERT` with NULL-safe comparison for owner_id.
- Import `qualifyTable()` for schema-qualified table names.
- Wrap in try/catch, throw `SeedError` with rich context on failure.
- Add tests: `packages/server/src/__tests__/helpers/seed-helpers.financial-entity.test.ts`
  - Import `testDbConfig` for connection.
  - Setup: open transaction (BEGIN), call helper twice with same input.
  - Expect: same id; inserts only once.
  - Test validation: empty name, invalid type, whitespace-only name.
  - Teardown: ROLLBACK.

Acceptance:

- Tests pass (11 tests) and do not leak data (transaction rolled back).

Status: ✅ COMPLETED (S2) - Enhanced with validation, error handling, and shared configt delta or
rely on not throwing).

- Teardown: ROLLBACK.

Acceptance:

- Tests pass and do not leak data (transaction rolled back).

```

---
- Use shared config from `test-db-config.ts` for schema qualification.

Requirements:
- Add `ensureBusinessForEntity(client, entityId, options?: { noInvoicesRequired?: boolean }): Promise<void>` in `seed-helpers.ts`.
- UUID validation: Check entityId format with regex, throw `EntityValidationError` if invalid.
- Foreign key validation: Check that financial entity exists before insert, throw clear error if not found.
- If `SELECT 1 FROM ${qualifyTable('businesses')} WHERE id=$1`, do nothing; else `INSERT`.
- Wrap in try/catch, throw `SeedError` with context on failure.
- Comprehensive JSDoc documenting idempotency behavior: "preserves existing values, does not update".
- Tests: `seed-helpers.business.test.ts` covering:
  - First-insert creates row
  - Idempotency (repeated calls)
  - noInvoicesRequired option
  - Default values
  - Preservation of existing values
  - Invalid UUID format rejection
  - Non-existent entity rejection
  - Use transactional tests with shared `testDbConfig`.

Acceptance:
- Tests pass (8 tests), table returns single row for repeated calls.

Status: ✅ COMPLETED (S3) - Enhanced with FK validation, UUID checks, and comprehensive tests.
```

---

### Prompt 4: ensureTaxCategoryForEntity

```text
Task: Ensure a `tax_categories` row for a given financial entity id, idempotently.

Context:
- `tax_categories(id uuid pk fk->financial_entities.id, name text, ...)`.
- Name lives on the financial entity; table ensures linkage row existence.

Requirements:
- Implement `ensureTaxCategoryForEntity(client, entityId, options?: { sortCode?: number }): Promise<void>` in `seed-helpers.ts`.
- Idempotent check by id.
- Tests in `seed-helpers.tax-category.test.ts`.

Acceptance:
- Tests pass under transaction isolation.

Status: ✅ COMPLETED (S4) - Implemented with FK validation and comprehensive tests.
```

---

### Prompt 5: seedAdminCore composition

```text
Task: Implement `seedAdminCore(client)` to create admin context: admin business, mandatory businesses and tax categories, tags, and user_context.

Context:
- Reuse logic from `scripts/seed.ts` (reference existing lists like authorities/general/crossYear/salaries/etc.).
- Keep it minimal for Phase 1: authorities (VAT, Tax, Social Security), general tax categories (DEFAULT (missing), Exchange Rates, Income Exchange Rates, Exchange Revaluation, Fee, General Fee), cross-year categories, and any specific ids required by ledger.

Requirements:
- File: `packages/server/scripts/seed-admin-context.ts`
  - Export `seedAdminCore(client): Promise<{ adminEntityId: string }>`
  - Compose using helpers from `seed-helpers.ts`
  - Upsert countries reference data ('ISR') for FK constraints
  - Upsert `user_context` row with default currencies `ILS` and necessary foreign keys.
  - Use `writeEnvVar` to set `DEFAULT_FINANCIAL_ENTITY_ID` in isolated env file.
- Add unit tests for smaller pure pieces (optional), and an integration test `packages/server/src/__tests__/seed-admin-context.integration.test.ts` that:
  - Connects DB, BEGIN, calls `seedAdminCore`, asserts `user_context` exists and references mandatory entities, then ROLLBACK.

Acceptance:
- Integration test passes consistently.

Status: ✅ COMPLETED (S5) - Implemented with countries FK support and env isolation.
```

---

### Prompt 6: DB test harness (connect/migrate/seed)

```text
Task: Add a DB test harness for Vitest.

Context:
- Vitest root config exists; no DB bootstrap.
- We need helpers to connect, run migrations (via migrations package), and seed admin once globally.

Updated Requirements (Refactored Harness):
- File: `packages/server/src/__tests__/helpers/db-setup.ts` (aggregator only; underlying logic split into dedicated modules)
  - `connectTestDb(): Promise<Pool>` with retry/backoff + health check
  - `assertLatestMigrationApplied(pool): Promise<void>` (checks last applied migration name vs `LATEST_MIGRATION_NAME`; does NOT run migrations)
  - `seedAdminCoreTransactional(pool): Promise<void>` executed inside per-test transactions (no global persistent seed)
  - Re-export `withTestTransaction`, `withConcurrentTransactions`
- Modular architecture: `db-connection.ts`, `db-migrations.ts`, `db-fixtures.ts`, `diagnostics.ts`, `errors.ts`, `test-database.ts`
- Smoke test: verifies presence of `user_context`, admin entities, and latest migration name; fails if outdated.

Acceptance:
- Smoke test passes when schema current; intentional failure when schema behind.

Status: ✅ COMPLETED (S7-S8, H1-H6) - Implemented with modular architecture, diagnostics, and countries FK support.
```

---

### Prompt 7: Transaction hooks for tests

```text
Task: Provide beforeEach/afterEach hooks for transactional isolation.

Updated Requirements:
- Global setup script creates temp env file (`TEST_ENV_FILE`) and initializes pool.
- Implement optional `test-hooks.ts` with beforeEach/afterEach transactional isolation.
- Global setup sets ENFORCE_LATEST_MIGRATION=1 by default.
- Global setup ensures countries reference data ('ISR') exists for FK constraints.
- Migrations not invoked here; schema guard test verifies currency.

Acceptance:
- Dummy isolation test plus env isolation log confirms setup.
- Bootstrap tests pass with migration guard enforced.

Status: ✅ COMPLETED (S9) - Implemented with transactional hooks, migration enforcement, and countries FK support.
```

---

### Prompt 8: Factory scaffolding

```text
Task: Create factory helpers.

Requirements:
- Folder: `packages/server/src/__tests__/factories/`
- Files:
  - `ids.ts`: `makeUUID(seed?: string): string`
  - `dates.ts`: `iso(date: string): Date`
  - `money.ts`: helpers to format numeric for pgtyped (string)
- Tests for each helper to ensure deterministic behavior when seeded.

Acceptance:
- Helper tests pass.
```

---

### Prompt 9: Business/Tax/Account factories

```text
Task: Implement basic factories.

Requirements:
- Files in factories:
  - `business.ts`: `createBusiness(overrides?)` -> minimal shape for insert
  - `tax-category.ts`: `createTaxCategory(overrides?)`
  - `financial-account.ts`: `createFinancialAccount(overrides?)` with type enum
- Unit tests: default values, overrides applied, required fields present.

Acceptance:
- Tests pass.
```

---

### Prompt 10: Charge/Transaction/Document factories

```text
Task: Implement core data factories.

Requirements:
- Files:
  - `charge.ts`: `createCharge({ owner_id, tax_category_id, user_description? }, overrides?)`
  - `transaction.ts`: `createTransaction({ charge_id, business_id, amount, currency, event_date, is_fee? }, overrides?)`
  - `document.ts`: `createDocument({ charge_id, creditor_id, debtor_id, type, total_amount, currency_code, date }, overrides?)`
- Respect pgtyped numeric types (string for numeric). Provide sensible defaults.
- Unit tests.

Acceptance:
- Tests pass.
```

---

### Prompt 11: Fixture interfaces + validation

```text
Task: Define fixture model and validation.

Requirements:
- File: `packages/server/src/__tests__/helpers/fixture-types.ts`:
  - Interfaces for lists: `FixtureBusinesses`, `FixtureTaxCategories`, `FixtureAccounts`, `FixtureCharges`, `FixtureTransactions`, `FixtureDocuments`
  - `Fixture` aggregating all lists and optional `expectations`
- File: `packages/server/src/__tests__/helpers/fixture-validation.ts`
  - `validateFixture(fixture): { ok: true } | { ok: false; errors: string[] }`
  - Validate referential integrity: `transaction.charge_id` exists; `document.charge_id` exists; required keys present.

Tests:
- Validation unit tests for good/bad cases.

Acceptance:
- Tests pass.
```

---

### Prompt 12: Fixture insertion (ordered + transactional)

```text
Task: Implement ordered insertion with rollback.

Requirements:
- File: `packages/server/src/__tests__/helpers/fixture-loader.ts`
  - `insertFixture(client, fixture): Promise<Map<string, string>>` returning id mapping
  - Ensure order: entities → businesses → tax_categories → accounts (+ any join tables) → charges → transactions → documents
  - Wrap in SAVEPOINT/ROLLBACK TO SAVEPOINT per section for better error messages
  - On error, throw `FixtureValidationError` with context

Tests:
- Use `withTransaction` to test insertion and rollback on error.

Acceptance:
- Tests pass; order and rollback verified.
```

---

### Prompt 13: Expense Scenario A fixture

```text
Task: Create Scenario A: ILS receipt expense.

Requirements:
- File: `packages/server/src/__tests__/fixtures/expenses/expense-scenario-a.ts`
  - Businesses: admin owner (from seed), supplier "Local Supplier Ltd"
  - Charge: owner_id = admin, tax_category = a reasonable expense category (from seed), description optional
  - Transaction: ILS negative amount; business_id = supplier
  - Document: Receipt in ILS matching the transaction (date near transaction date)
  - expectations: ledger simplified expectations (debit expense, credit bank)

Tests:
- Fixture compiles and validates.

Acceptance:
- Validation test passes.
```

---

### Prompt 14: Ledger integration test for Scenario A

```text
Task: Add integration test that loads Scenario A and asserts ledger.

Context:
- Ledger generation entry: `ledgerGenerationByCharge(...)` or specific resolver for charge type.
- Use injector wiring from server modules if required, else call provider functions directly.

Requirements:
- File: `packages/server/src/modules/ledger/__tests__/ledger-scenario-a.integration.test.ts`
  - Use `setupDbHooks()`
  - Insert Scenario A via `insertFixture`
  - Trigger ledger generation for the created charge
  - Query `ledger_records` and normalize to simplified view
  - Assert: record count, balanced debit/credit sums, correct entity IDs, amounts match expectations

Acceptance:
- Test passes; repeats deterministically.
```

---

### Prompt 15: Exchange rate provider mock strategy

```text
Task: Provide a way to fix exchange rate for tests.

Requirements:
- File: `packages/server/src/__tests__/helpers/exchange-mock.ts`
  - Export a function to override `ExchangeProvider.getExchangeRates` to return a specified rate for (USD→ILS)
- Wire mock in the test by setting the admin context/injector as needed (follow existing DI in ledger resolvers)

Acceptance:
- A tiny test proves `getExchangeRates` returns the mocked value.
```

---

### Prompt 16: Expense Scenario B fixture (USD)

```text
Task: Create Scenario B: USD invoice expense, deterministic rate.

Requirements:
- File: `packages/server/src/__tests__/fixtures/expenses/expense-scenario-b.ts`
  - Supplier "US Vendor LLC"
  - Charge: owner_id = admin, tax_category = expense category
  - Transaction: USD negative amount; business_id = supplier
  - Document: Invoice in USD
  - expectations: simplified ledger with local currency conversion result, and (if applicable) an exchange record

Acceptance:
- Validation test passes.
```

---

### Prompt 17: Ledger integration test for Scenario B

```text
Task: Add integration test for Scenario B using exchange rate mock.

Requirements:
- File: `packages/server/src/modules/ledger/__tests__/ledger-scenario-b.integration.test.ts`
  - Use `setupDbHooks()`, `insertFixture`
  - Mock exchange rate (e.g., 3.5 ILS per USD)
  - Trigger ledger generation; fetch `ledger_records`
  - Assert: totals in local currency, balance, entity correctness, conversion within tolerance

Acceptance:
- Test passes; deterministic.
```

---

### Prompt 18: Scripts and docs polish

```text
Task: Add convenience scripts and summarize in docs.

Updated Requirements:
- Add scripts:
  - `"seed:admin": "tsx packages/server/scripts/seed-admin-context.ts"`
  - `"test": "vitest run"` (full suite including schema guard)
- Update `docs/demo-test-data-plan.md` for external migrations + env isolation + latest migration guard.
- Confirm CI workflow includes independent migration name guard and coverage artifact.

Acceptance:
- Scripts run locally; CI passes with schema guard succeeding when migrations applied.

Status: ✅ COMPLETED (2025-11-23)
- Added `seed:admin` script to root and server package.json
- Added `test` script to root package.json (runs full suite with schema guard)
- Updated demo-test-data-plan.md with:
  - CountryCode and Currency enum usage conventions
  - Recent improvements section documenting enum standardization and countries normalization
  - Simplified developer workflow commands
- CI workflow verified: includes migration guard and coverage artifact upload
```

---

### Prompt 19: Precise Migration Name Guard

```text
Task: Add exact latest migration name assertion.

Requirements:
- Export `MIGRATIONS` and `LATEST_MIGRATION_NAME` from migrations runner module.
- Add test `db-bootstrap.test.ts` asserting last applied migration name equals `LATEST_MIGRATION_NAME`.
- Deliberately allow failure when schema is behind to surface drift.
- Add CI step running a lightweight Node script that loads migrations index and checks DB state independently from test suite.

Acceptance:
- Guard test passes on current schema; fails on drift.
- CI step exits non-zero if mismatch.

Status: ✅ COMPLETED (Milestone 2, H2)
- `LATEST_MIGRATION_NAME` exported from migrations package
- `db-bootstrap.test.ts` includes migration name guard test
- CI workflow includes independent "Fail if Latest Migration Missing" step
- Uses inline Node script with ES module support to verify migration
```

### Prompt 20: Environment Isolation for Tests

```text
Task: Prevent `.env` pollution during test runs.

Requirements:
- Global test setup creates a temp directory & file for env (`TEST_ENV_FILE`).
- Update seeding script to write `DEFAULT_FINANCIAL_ENTITY_ID` to that file using atomic pattern (temp write + rename).
- Log path in setup for debugging.

Acceptance:
- Test run logs isolated env path.
- Root `.env` remains unchanged after tests.

Status: ✅ COMPLETED (Milestone 2, H3)
- `vitest-global-setup.ts` creates temp env file in `os.tmpdir()`
- Sets `TEST_ENV_FILE` environment variable
- Logs isolated path: `[test-setup] Using isolated TEST_ENV_FILE: /tmp/...`
- Root `.env` protected from test pollution
```

### Prompt 21: Diagnostics & Error Taxonomy Documentation

```text
Task: Surface harness observability & structured errors.

Requirements:
- Add diagnostics module: pool health snapshot, connection attempt metrics.
- Introduce custom error classes (`TestDbConnectionError`, `TestDbMigrationError`, `TestDbSeedError`).
- Document usage in `architectural-improvements-milestone2.md` & reference in prompt plan.

Acceptance:
- Errors thrown carry contextual properties; diagnostics only emitted when `DEBUG` flag set.

Status: ✅ COMPLETED (Milestone 2, H1)
- Created `diagnostics.ts` with pool health snapshots
- Created `errors.ts` with custom error hierarchy
- Diagnostics conditional on `DEBUG=accounter:test`
- Documented in architectural improvements
```

### Prompt 22: CountryCode and Currency Enum Consistency

```text
Task: Standardize currency and country values using TypeScript enums.

Requirements:
- Replace all string literals for currencies with `Currency` enum from `@shared/enums`
- Replace all string literals for countries with `CountryCode` enum from `packages/server/src/modules/countries/types.ts`
- Update fixtures, factories, and tests to use enum values
- Ensure compile-time type safety prevents invalid values

Files to Update:
- Fixtures: expense-scenario-a.ts, expense-scenario-b.ts
- Factories: business.ts (default country)
- Tests: expense-scenario-a.test.ts, expense-scenario-b.test.ts, business.test.ts, ledger integration tests

Acceptance:
- All currency/country string literals replaced with enum values
- All tests pass (238+ tests)
- IDE autocomplete works for currency/country values
- No magic strings in test code

Status: ✅ COMPLETED (2025-11-23)
- All fixtures updated: `Currency.Ils`, `Currency.Usd`, `CountryCode.Israel`, `CountryCode['United States of America (the)']`
- Factory defaults use enums: `business.ts` defaults to `CountryCode.Israel`
- All test assertions use enums for currency and country comparisons
- Test results: 24/24 expense scenario tests, 8/8 ledger integration tests, 37/37 business factory tests
- Benefits: Type safety, autocomplete, consistency, eliminates magic strings
```

### Prompt 23: Countries Table Normalization

```text
Task: Use CountryCode enum as single source of truth for countries table population.

Requirements:
- Create `seed-countries.ts` utility module with:
  - `getAllCountries()`: Extract all countries from CountryCode enum
  - `seedCountries(client, schema)`: Dynamically build INSERT from enum with ON CONFLICT DO NOTHING
  - `getCountryByCode(code)`: Lookup helper
- Update `seed.ts` to use utility instead of hardcoded INSERT
- Update `vitest-global-setup.ts` to populate all countries from enum
- Use parameterized queries to prevent SQL injection

Acceptance:
- Seed script and test setup use same utility
- CountryCode enum is single source of truth
- All 249 countries seeded consistently
- Tests pass with countries populated from enum

Status: ✅ COMPLETED (2025-11-22)
- Created `packages/server/src/modules/countries/utils/seed-countries.ts` with 3 exported functions
- Updated `scripts/seed.ts` to use `seedCountries(client)` utility
- Updated `scripts/vitest-global-setup.ts` to seed all countries from enum
- Test output confirms: `[test-setup] Ensured all countries populated from enum`
- Benefits: DRY principle, maintainability (single place to update), consistency, parameterized SQL
```

---

## Notes

- Each prompt assumes previous prompts have been completed and their code is integrated.
- All tests use Vitest with transactional isolation for DB-backed tests.
- Factory functions and helpers are reusable across scenarios.
- Fixtures are TypeScript modules for type safety.
- Ledger assertions validate double-entry balance and correct entity assignments.
- Exchange rates are mocked deterministically to avoid flaky external API calls.

---

This document will evolve as additional scenarios (income flows, multi-currency, partial payments)
are added in future phases.

## Milestone 7: Ledger Coverage Hardening (Planned)

Focus on closing identified test gaps to ensure comprehensive ledger correctness before broad
scenario expansion.

### Chunks

- **Chunk 7.1 Duplicate Prevention**: Implement guard preventing duplicate ledger record insertion
  when `insertLedgerRecordsIfNotExists: true` is used repeatedly.
- **Chunk 7.2 VAT Scenario**: Add VAT-inclusive expense fixture + VAT assertion helper verifying tax
  entity placement and VAT amount correctness.
- **Chunk 7.3 Foreign Multi-Leg Scenario**: Introduce foreign expense with fee & FX adjustment legs;
  extend foreign assertions to validate aggregate foreign sum and local reconciliation.
- **Chunk 7.4 Exchange Rate Date Alignment**: Mock multiple dated rates; assert ledger selects rate
  matching invoice/value date.
- **Chunk 7.5 Locked Charge Behavior**: Fixture for locked charge; test retrieval path returns
  immutable records (no new inserts, `updated_at` unchanged, `locked=true`).
- **Chunk 7.6 Secondary Entity Logic**: Tests ensuring only allowed secondary entities (fee, VAT, FX
  adjustment) appear; fail on unexpected entity.
- **Chunk 7.7 Period Boundary Validation**: Scenario spanning month/year boundary; assert period
  tagging (stub if not yet implemented).
- **Chunk 7.8 Description & Reference Semantics**: Assertions requiring non-empty meaningful
  `description` / `reference1` for multi-leg/complex entries.
- **Chunk 7.9 Unbalanced Business Exceptions**: Business trip & salary charge tests validating
  allowed temporary unbalanced entities via `ledgerUnbalancedBusinessesByCharge`.
- **Chunk 7.10 Post-Lock Immutability**: Attempt mutation after lock; assert failure and unchanged
  audit fields.

### Acceptance Criteria

- New fixtures (VAT, foreign multi-leg, locked charge) insert and validate.
- Repeated generation with insertion enabled does not create duplicates.
- Foreign/local reconciliation passes (total local ≈ foreign × rate across all legs within
  tolerance).
- Correct exchange rate picked by date.
- Locked charge tests confirm immutability.
- Secondary entity logic and description semantics enforced.
- Unbalanced exceptions covered for special charge types.

### Follow-Up Prompts (25.x)

- **Prompt 25.1**: Implement duplicate prevention guard.
- **Prompt 25.2**: Create VAT expense scenario + VAT assertions.
- **Prompt 25.3**: Add foreign multi-leg scenario + aggregate reconciliation assertions.
- **Prompt 25.4**: Exchange rate date alignment test with multiple mocked rates.
- **Prompt 25.5**: Locked charge scenario ensuring immutability.
- **Prompt 25.6**: Secondary entity logic enforcement tests.
- **Prompt 25.7**: Period boundary validation scenario (month-end).
- **Prompt 25.8**: Description/reference semantic assertion enhancements.
- **Prompt 25.9**: Unbalanced business exceptions for business trip & salary charges.
- **Prompt 25.10**: Post-lock immutability and audit trail stability test.
