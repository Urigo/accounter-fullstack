# Specification: Demo/Test Data Infrastructure Consolidation

## 1. Objective

Unify and modernize the demo and test data infrastructure by:

- Deprecating legacy/duplicate logic (admin context, UUIDs, validators)
- Renaming scripts and commands for clarity
- Introducing a shared `FixtureSpec` interface for all fixtures
- Centralizing data seeding, validation, and error handling
- Ensuring robust, maintainable, and testable architecture

---

## 2. Requirements

### Functional

- All fixture data (demo and test) must conform to a single, shared `FixtureSpec` TypeScript
  interface.
- Only one deterministic UUID implementation (UUID v5, namespace-based) is allowed.
- Only one admin context creation implementation (`seedAdminCore`) is allowed.
- All ledger validation must use the demo validator suite as the source of truth, with test
  assertions as thin wrappers.
- All seed, admin, and demo commands must be renamed for intent clarity.
- All deprecated code must be removed immediately.

### Non-Functional

- All changes must be backward compatible for one release cycle (with deprecation warnings).
- All new/updated scripts must have clear error handling and logging.
- All changes must be covered by integration and unit tests.

---

## 3. Architecture Choices

### 3.1. FixtureSpec Interface

Create `packages/server/src/fixtures/fixture-spec.ts`:

```typescript
export interface FixtureSpec {
  meta?: {
    id: string
    description?: string
    version?: string
    [key: string]: any
  }
  businesses: any[]
  taxCategories: any[]
  financialAccounts: any[]
  charges: any[]
  transactions: any[]
  documents: any[]
  expectations?: {
    ledger?: any[]
    [key: string]: any
  }
  placeholders?: Record<string, string>
}
```

- All demo and test fixtures must be refactored to conform to this interface.

### 3.2. Deterministic UUIDs

- Use only `makeUUID(namespace: string, name: string)` from
  `demo-fixtures/helpers/deterministic-uuid.ts` (canonical location).
- Remove all hash-based or ad-hoc UUID logic.
- Add a lint rule or CI check to prevent reintroduction of deprecated UUID helpers.

- Backward compatible adapter: While migrating tests and fixtures to the new two-argument
  `makeUUID(namespace,name)` signature, provide a short-lived adapter export with the old
  single-argument API (e.g., `makeUUIDLegacy(seed)` → `makeUUID('legacy', seed)`) to reduce churn in
  a single PR. This adapter must be removed after all code is updated.

### 3.7. Deprecation and Linting

- Deprecate and remove duplicate or legacy UUID helpers such as
  `packages/server/src/__tests__/factories/ids.ts` that implement a hash-based single-argument API.
- Add a lint rule (ESLint plugin with custom rule or simple regex-based check) that fails CI when
  legacy helpers are imported or used.
- Provide short-term compatibility adapters when migrating tests to the new
  `makeUUID(namespace, name)` signature to reduce churn without losing determinism.

### 3.3. Admin Context

- Use only `seedAdminCore()` from `scripts/seed-admin-context.ts` for admin context creation.
- Remove all other admin context creation logic.
- All scripts/tests requiring admin context must import and use this function.

### 3.4. Ledger Validation

- Use `validateLedgerRecords()` from `demo-fixtures/validators/ledger-validators.ts` as the
  canonical validator.
- Refactor `ledger-assertions.ts` to wrap this validator for test assertions.
- Remove all duplicate or partial validation logic.

### 3.5. Command Renaming

Update `package.json` and `packages/server/package.json`:

- `seed` → `seed:production`
- `seed:admin` → `seed:admin-context`
- `seed:demo` → `seed:staging-demo`
- Add `seed:reset-staging` if destructive reset is needed
- Mirror changes in all documentation and CI scripts

### 3.6. Foundation Seeder Modules (New)

- Move foundational demo seed helpers from `demo-fixtures/helpers` to module-owned helpers where
  appropriate, to prevent duplication and to better align with module responsibilities.
- Examples:
  - `seedExchangeRates()` →
    `packages/server/src/modules/exchange/helpers/seed-exchange-rates.helper.ts`
  - `seedVATDefault()` → `packages/server/src/modules/vat/helpers/seed-vat.helper.ts`
- Keep idempotency via `ON CONFLICT` and update demo scripts to import the module helper locations.

Note: This change is optional — teams may prefer to keep simple, demo-scoped seeders under
`demo-fixtures/helpers` for clarity. The important requirement is a single canonical implementation
per seed topic, and consistent import locations across scripts and docs.

---

## 4. Data Handling

- All fixture data must be type-checked against `FixtureSpec`.
- Placeholders (e.g., `{{ADMIN_BUSINESS_ID}}`) must be resolved at insertion time using a single
  utility.
- All UUIDs must be generated deterministically using the canonical helper.
- All seeders must be idempotent and log their actions.
- All destructive operations (e.g., TRUNCATE) must require explicit confirmation or environment
  flag.

---

## 5. Error Handling

- All scripts must exit with non-zero status on error.
- All errors must be logged with context (e.g., which fixture, which entity, which step).
- Validation failures must output actionable error messages, including which rule failed and on
  which data.
- Placeholder resolution errors must fail fast and log missing keys.

---

## 6. Testing Plan

### 6.1. Unit Tests

- All helpers (UUID, placeholder, admin context) must have direct unit tests.
- All fixture factories must be tested for conformance to `FixtureSpec`.

### 6.2. Integration Tests

- End-to-end test: seed demo data, then validate using the canonical validator.
- End-to-end test: seed test data, then validate using the same validator.
- Test that all renamed commands work as expected and log deprecation warnings for old aliases.

### 6.3. Regression Tests

- Ensure that all previous test scenarios still pass after migration.
- Add tests to ensure that deprecated helpers are not used (lint/CI).

---

## 7. Implementation Steps

1. Create `FixtureSpec` and refactor all fixtures to conform.
2. Remove all legacy UUID/admin/validator logic.
3. Refactor all factories and test/demo fixtures to use canonical helpers.
4. Update all scripts and commands, and add deprecation warnings for old aliases.
5. Update documentation to reflect new architecture and usage.
6. Add/expand tests as described above.
7. Run full test suite and validate in CI.

---

## 8. Deliverables

- Updated codebase with all deprecated logic removed
- Unified fixture and validation infrastructure
- Updated scripts and documentation
- Passing test suite with new and legacy scenarios
- Migration/upgrade notes for developers

---

**This spec is ready for direct implementation. All architectural, data, error, and testing
requirements are included.**

**Progress Update:**

- `FixtureSpec` file created at `packages/server/src/fixtures/fixture-spec.ts` and one fixture
  updated to use it.
- A short-lived compatibility adapter `makeUUIDLegacy(seed?)` was added to
  `packages/server/src/demo-fixtures/helpers/deterministic-uuid.ts` and the legacy
  `__tests__/factories/ids.ts` now delegates to it.
- `scripts/seed-demo-data.ts` was updated to call canonical `seedAdminCore()`.
