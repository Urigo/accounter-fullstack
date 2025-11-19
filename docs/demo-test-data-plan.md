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

| Table              | Purpose                                                      | Key Relationships                                                          |
| ------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| financial_entities | Base entity for businesses & tax categories                  | Referenced by `businesses`, `tax_categories`, ledger debit/credit entities |
| businesses         | Operating entities                                           | Linked to charges (owner_id) & transactions (business_id)                  |
| tax_categories     | Categorization for ledger & classification                   | Assigned via charges or derived from financial accounts                    |
| financial_accounts | Bank / credit / crypto accounts                              | Feed transactions; mapped to tax categories for ledger                     |
| charges            | Aggregation anchor for documents + transactions + ledger     | owner_id → business; referenced by transactions/documents/ledger_records   |
| transactions       | Monetary events from bank/cc feeds                           | charge_id, business_id, currency, amount                                   |
| documents          | Financial documents (invoice, receipt, etc.)                 | charge_id (new), creditor_id, debtor_id                                    |
| ledger_records     | Double-entry–like entries per charge                         | debit_entity*, credit_entity*, charge_id                                   |
| user_context       | Admin configuration (default currency, mandatory categories) | owner_id (admin business)                                                  |

## 6. Foundational Seed Requirements

Enhance `scripts/seed.ts` by splitting responsibilities:

1. `seedAdminCore()` – create admin business entity, mandatory tax categories, tags, and
   user_context row.
2. Expose environment overrides via `.env` for optional multi-account seeding.
3. Idempotency: each insert must check existence (SELECT) or rely on ON CONFLICT DO NOTHING where
   feasible.
4. Output: write `DEFAULT_FINANCIAL_ENTITY_ID` & others into `.env` if missing.

New Script Commands (added to `@accounter/server/package.json`):

```
"seed:admin": "ts-node scripts/seed-admin-context.ts",
"seed:demo-expenses": "ts-node scripts/seed-demo-expenses.ts",
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
- Currency enumerations reused from `@shared/enums`.

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

## 13. Ledger Generation Test Strategy

Location: `packages/server/src/modules/ledger/__tests__/ledger-generation.integration.test.ts`.
Assertions:

- Number of ledger records produced per charge.
- Balanced totals (sum debit == sum credit in local currency).
- Correct debit/credit entity assignments (expense: debit expense category, credit bank; foreign
  currency: extra exchange rate record if configured).
- Foreign amount vs local conversion correctness (audit exchange rate usage; delta < tolerance).
- Absence of unexpected fee entries for simple happy paths.

Helper: `assertLedgerRecords(records, expectation)` comparing ordered normalization:

```
{ debit_entity1, credit_entity1, localCurrencyDebitAmount1, localCurrencyCreditAmount1, currency }
```

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
- Ledger generation tests pass with balanced entries and expected entity mapping.
- Foreign currency expense test validates exchange rate conversion (deterministic with mocked rate).
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

## 21. Developer Workflow Summary

```
# Spin up DB
docker compose -f docker/docker-compose.dev.yml up -d postgres

# Apply migrations (must be done before tests)
yarn workspace @accounter/migrations migration:run

# (Optional) Seed admin for manual exploration
yarn workspace @accounter/server tsx packages/server/scripts/seed-admin-context.ts

# Run full test suite (includes schema guard + coverage)
yarn workspace @accounter/server vitest run
```

## 22. Open Questions (To Address Before Phase 2)

- Standardized exchange rate seeding vs. runtime provider mock?
- Preferred fixture diff tooling (custom vs. built-in expect diff)?
- When to incorporate document upload flow simulation?

---

Prepared for implementation. This document will evolve with subsequent phases.
