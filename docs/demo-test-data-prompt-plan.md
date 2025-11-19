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
  (BEGIN/ROLLBACK).
- **S10**: Smoke test "can query user_context".

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

**Note**: Prompts 1-3 have been completed with architectural enhancements. Continue from Prompt 4.

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

Status: ✅ COMPLETED (S3) - Enhanced with FK validation, UUID checks, and comprehensive testseed convenience.

Requirements:
- Add `ensureBusinessForEntity(client, entityId, options?: { noInvoicesRequired?: boolean }): Promise<void>` in `seed-helpers.ts`.
- If `SELECT 1 FROM accounter_schema.businesses WHERE id=$1`, do nothing; else `INSERT`.
- Tests: `seed-helpers.business.test.ts` covering first-insert and idempotency.
- Use transactional tests.

Acceptance:
- Tests pass, table returns single row for repeated calls.
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
  - Upsert `user_context` row with default currencies `ILS` and necessary foreign keys.
  - Use `writeEnvVar` to set `DEFAULT_FINANCIAL_ENTITY_ID` in `.env` if missing.
- Add unit tests for smaller pure pieces (optional), and an integration test `packages/server/src/__tests__/seed-admin-context.integration.test.ts` that:
  - Connects DB, BEGIN, calls `seedAdminCore`, asserts `user_context` exists and references mandatory entities, then ROLLBACK.

Acceptance:
- Integration test passes consistently.
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
- Smoke test: verifies presence of `user_context`, admin entities, and latest migration name; fails if outdated.

Acceptance:
- Smoke test passes when schema current; intentional failure when schema behind.
```

---

### Prompt 7: Transaction hooks for tests

```text
Task: Provide beforeEach/afterEach hooks for transactional isolation.

Updated Requirements:
- Global setup script creates temp env file (`TEST_ENV_FILE`) and initializes pool.
- Per-test isolation achieved explicitly by wrapping logic with `withTestTransaction` (no mandatory hook file; optional utility retained).
- Migrations not invoked here; schema guard test verifies currency.

Acceptance:
- Dummy isolation test plus env isolation log confirms setup.
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

### Prompt 18: Scripts and docs polish (optional)

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

---

### Prompt 19: Precise Migration Name Guard

Task: Add exact latest migration name assertion.

Requirements:
- Export `MIGRATIONS` and `LATEST_MIGRATION_NAME` from migrations runner module.
- Add test `db-bootstrap.test.ts` asserting last applied migration name equals `LATEST_MIGRATION_NAME`.
- Deliberately allow failure when schema is behind to surface drift.
- Add CI step running a lightweight Node script that loads migrations index and checks DB state independently from test suite.

Acceptance:
- Guard test passes on current schema; fails on drift.
- CI step exits non-zero if mismatch.

### Prompt 20: Environment Isolation for Tests

Task: Prevent `.env` pollution during test runs.

Requirements:
- Global test setup creates a temp directory & file for env (`TEST_ENV_FILE`).
- Update seeding script to write `DEFAULT_FINANCIAL_ENTITY_ID` to that file using atomic pattern (temp write + rename).
- Log path in setup for debugging.

Acceptance:
- Test run logs isolated env path.
- Root `.env` remains unchanged after tests.

### Prompt 21: Diagnostics & Error Taxonomy Documentation

Task: Surface harness observability & structured errors.

Requirements:
- Add diagnostics module: pool health snapshot, connection attempt metrics.
- Introduce custom error classes (`TestDbConnectionError`, `TestDbMigrationError`, `TestDbSeedError`).
- Document usage in `architectural-improvements-milestone2.md` & reference in prompt plan.

Acceptance:
- Errors thrown carry contextual properties; diagnostics only emitted when `DEBUG` flag set.
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
