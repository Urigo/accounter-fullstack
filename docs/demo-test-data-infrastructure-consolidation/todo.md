# Demo/Test Data Infrastructure Consolidation - TODO

This file is the working checklist for the consolidation project. Each item maps to the Chunks and
steps in the `prompt_plan.md` and `spec.md`. Mark items checked as they're implemented.

---

## High-Level Acceptance Criteria

- [ ] All fixtures conform to `FixtureSpec` and are type-checked.
- [ ] All code uses canonical deterministic UUID (`makeUUID(namespace,name)`) from
      `demo-fixtures/helpers/deterministic-uuid.ts`.
- [ ] All admin context creation uses `seedAdminCore()` from `scripts/seed-admin-context.ts`.
- [ ] All ledger validation uses `validateLedgerRecords()` from
      `demo-fixtures/validators/ledger-validators.ts`.
- [ ] `package.json` scripts updated / aliased as described and docs updated.
- [ ] Legacy helpers removed and CI/lint rules enforce no reintroductions.
- [ ] Unit & integration tests updated and passing.

---

## Chunk/Step Checklist

### Chunk 1: Shared `FixtureSpec` Interface

- [ ] 1.1 Create `packages/server/src/fixtures/fixture-spec.ts`.
  - Acceptance: file exists and exports `FixtureSpec` exactly as agreed in `spec.md`.
- [ ] 1.2 Pick one demo fixture (e.g., `monthly-expense-foreign-currency.ts`) and annotate its
      `fixtures` as `FixtureSpec`.
  - Acceptance: file compiles, type errors fixed.
- [ ] 1.3 Validate `use-cases/index.ts` can still import and work with the refactored fixture.
  - Acceptance: `getAllUseCases()` returns consistent results and `validate-demo-data.ts` runs.

### Chunk 2: Deterministic UUID Consolidation

- [ ] 2.1 Consolidate `makeUUID(namespace,name)` in
      `packages/server/src/demo-fixtures/helpers/deterministic-uuid.ts`.
  - Acceptance: canonical function exists and exported.
- [ ] 2.2 Implement short-lived adapter `makeUUIDLegacy(seed?)` that maps to canonical helper.
  - Acceptance: legacy single-argument `__tests__/factories/ids.ts` and other usages can delegate to
    adapter with exact old behavior.
- [ ] 2.3 Update a single factory (e.g., `__tests__/factories/business.test.ts`) to use canonical
      two-arg `makeUUID`.
  - Acceptance: test still passes with canonical helper.
- [ ] 2.4 Add migration note: how to rewrite single-arg calls to `makeUUID(namespace,name)`.

### Chunk 2b: Foundation Seeder Modules

- [ ] 2b.1 Move/copy `seedExchangeRates()` to
      `packages/server/src/modules/exchange/helpers/seed-exchange-rates.helper.ts`.
- [ ] 2b.2 Move/copy `seedVATDefault()` to
      `packages/server/src/modules/vat/helpers/seed-vat.helper.ts`.
- [ ] 2b.3 Update `scripts/seed-demo-data.ts` to import the new module helper locations.
- [ ] 2b.4 Keep idempotent SQL (`ON CONFLICT`) and tests intact.
- [ ] 2b.5 Update docs (demo-staging guide and spec) to reference new helper locations.

### Chunk 3: Admin Context Standardization

- [ ] 3.1 Verify `seedAdminCore(client)` implementation in `scripts/seed-admin-context.ts`.
  - Acceptance: `seedAdminCore` provides idempotent admin fixture creation and updates
    `user_context`/env file.
- [ ] 3.2 Migrate one script — e.g., `scripts/seed-demo-data.ts` — to import and call
      `seedAdminCore()`.
  - Acceptance: script continues to work locally under `ALLOW_DEMO_SEED=1`.
- [ ] 3.3 Deprecate/remove `createAdminBusinessContext` in `demo-fixtures/helpers/admin-context.ts`,
      and update tests to use `seedAdminCore`.
  - Acceptance: `createAdminBusinessContext` should be removed once all callers are migrated.

### Chunk 4: Canonical Ledger Validation

- [ ] 4.1 Import `validateLedgerRecords()` in
      `modules/ledger/__tests__/helpers/ledger-assertions.ts`.
- [ ] 4.2 Refactor one assertion (e.g., `assertSimpleLocalExpenseScenario`) to call
      `validateLedgerRecords` (wrap the validator in assertion-friendly shape).
- [ ] 4.3 Remove duplicate validation logic from `ledger-assertions.ts` after first migration.
- [ ] 4.4 Add unit tests for `validateLedgerRecords()` if missing, and ensure assertions call it
      (thin wrappers only).

### Chunk 5: Command Renaming

- [ ] 5.1 Root `package.json` rename/alias:
  - `seed` → `seed:production` (alias only: keep `seed` as backward compatibility during
    transition).
  - `seed:admin` → `seed:admin-context` alias (preserve older script for a release cycle with
    deprecation warning).
  - `seed:demo` → `seed:staging-demo` alias.
  - Add `seed:reset-staging` placeholder (must require explicit confirm environment flag).
- [ ] 5.2 Update docs across the repo referencing `seed:demo` or `seed:admin`.
  - Acceptance: `grep` for `seed:demo` references replaced; docs updated to recommended commands.
- [ ] 5.3 Add deprecation warnings in `seed` scripts that print a message if called (e.g.,
      "DEPRECATED: use seed:staging-demo").

### Chunk 6: Expand Fixture/Factory Refactoring

- [ ] 6.1 Iterate over `packages/server/src/demo-fixtures/use-cases/*` and refactor to use
      `FixtureSpec` and the canonical `makeUUID` pattern.
- [ ] 6.2 Update factories in `packages/server/src/__tests__/factories/*` to import canonical
      `makeUUID` from `demo-fixtures/helpers/deterministic-uuid.ts` and remove direct usage of
      `__tests__/factories/ids.ts`.
- [ ] 6.3 Remove brittle workarounds (e.g., inline `randomUUID` in tests) and replace with canonical
      helpers.

### Chunk 7: Testing

- [ ] 7.1 Add/expand unit tests for helpers:
  - `makeUUID` deterministic behavior (namespace difference test)
  - `makeUUIDLegacy` behavior (seed/no-seed)
  - Placeholder resolution (`resolveAdminPlaceholders`) and `seedAdminCore` idempotency
- [ ] 7.2 Add/expand integration tests:
  - End-to-end seeding and ledger generation using canonical validator
  - Idempotency and deterministic UUID tests across runs
  - End-to-end tests for both staging/demo and test usage patterns
- [ ] 7.3 Validation that test suite runs: run `yarn test` and fix regressions

### Chunk 8: Remove Deprecated Code

- [ ] 8.1 Remove legacy `__tests__/factories/ids.ts` after all imports changed to canonical helper
      or adapter removed.
- [ ] 8.2 Remove `demo-fixtures/helpers/admin-context.ts` if unused (or keep deprecated wrapper with
      console warning for short time).
- [ ] 8.3 Remove any ad-hoc validation logic replaced by canonical validators; ensure
      `ledger-assertions.ts` contains thin wrappers only.

### Chunk 9: Final Integration

- [ ] 9.1 Ensure all scripts, factories, fixtures, and validators are consistent and import
      canonical helpers.
- [ ] 9.2 Run all build/test tasks locally:
  - `yarn build` and `yarn test` across repo
  - `ALLOW_DEMO_SEED=1 yarn seed:staging-demo && yarn validate:demo` in `packages/server`
- [ ] 9.3 Add any missing CI changes (lint/coverage) and confirm green pipeline.

### Chunk 10: Developer Docs & Migration Notes

- [ ] 10.1 Write migration notes under `/docs/` explaining how to update fixtures & tests:
  - Replacing `makeUUID('seed')` → `makeUUID('namespace','name')` (examples and sed regex)
  - Replace `createAdminBusinessContext` → `seedAdminCore` and any change in behavior
  - Removal timeline for `makeUUIDLegacy` and `__tests__/factories/ids.ts`.
- [ ] 10.2 Update `prompt_plan.md`/`spec.md` to reflect final state and add an itemized archive of
      removed helpers.
- [ ] 10.3 Add “how to run” steps in `README`s and `packages/server/docs/*` for new
      `seed:staging-demo` script.

---

## Lint/CI Enforcement

- [ ] Add an ESLint rule/check (custom or via regex) that fails CI if any of these patterns are
      imported:
  - `__tests__/factories/ids.ts` (legacy single-arg UUID helper)
  - Any inline or ad-hoc `uuid`/`hash` generator used for deterministic test fixtures
  - `demo-fixtures/helpers/admin-context.ts` (if canonicalization demands deprecation)
- [ ] Add a CI job to run `ALLOW_DEMO_SEED=1 yarn seed:staging-demo && yarn validate:demo` as an
      integration smoke test.

---

## Rollback / Compatibility Plan

- [ ] Keep adapters and aliases for one release cycle to ensure no breakage.
- [ ] Add deprecation warnings and migrate step-by-step: core changes must not break CI.
- [ ] Prepare a rollback patch to re-enable old helpers in case of urgent regression (rare /
      emergency only).

---

## Ownership & Timeline

- [ ] Select owners available to work on each Chunk (e.g., Admin Context: @owner1, UUID migration:
      @owner2)
- [ ] Break large Chunks into smaller PRs (max 300 changed lines per PR recommended); prefer
      low-risk changes first (adapters, tests).
- [ ] Request PR reviews from core library maintainers for changes to `validateLedgerRecords`, UUID
      helper, and `seedAdminCore`.

---

## Notes & Helpful Commands

- Run tests: `yarn test`
- Seed staging demo locally: `ALLOW_DEMO_SEED=1 yarn seed:staging-demo`
- Validate demo: `yarn validate:demo`
- Run the recommended migration check to locate legacy UUID usage:
  `grep -R "makeUUID('" packages/server/src | grep -v demo-fixtures/helpers/deterministic-uuid`
  (adapt to your shell)

---

## Post-Completion Cleanup

- [ ] Remove `makeUUIDLegacy` and `__tests__/factories/ids.ts` after all callers migrate.
- [ ] Add a CI gate that blocks PRs reintroducing deprecated helpers (regex-based check or ESLint
      custom rule).
- [ ] Update CHANGELOG and release notes describing removal and deprecation timelines.

---

If you'd like, I can:

- Convert each Checklist item into a set of atomic PRs and apply them sequentially; or
- Start by migrating the remaining test files from `makeUUID(seed)` → `makeUUID(namespace,name)` and
  remove the adapter afterwards.

Pick what you'd like me to do next and I'll implement it.
