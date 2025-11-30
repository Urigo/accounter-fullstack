Here’s a detailed, iterative blueprint for implementing the Demo/Test Data Infrastructure
Consolidation project, broken down into right-sized, incremental steps. Each step is designed to be
safe, build on the previous, and is ready to be used as a prompt for a code-generation LLM. Prompts
are separated and clearly tagged.

---

## 1. High-Level Blueprint

1. **Introduce the shared `FixtureSpec` interface and migrate one fixture to use it.**
2. **Consolidate deterministic UUID logic, removing all legacy/ad-hoc implementations.**
3. **Standardize admin context creation, removing all but the canonical implementation.**
4. **Refactor ledger validation to use the canonical validator everywhere.**
5. **Rename all seed/admin/demo commands for clarity and update documentation.**
6. **Refactor all remaining fixtures and factories to use the new interface and helpers.**
7. **Add/expand unit and integration tests for all new/updated logic.**
8. **Remove deprecated code and add CI/lint checks to prevent reintroduction.**
9. **Wire everything together and validate with a full test suite.**
10. **Document migration/upgrade notes for developers.**

---

## 2. Iterative Chunks

### Chunk 1: Shared FixtureSpec Interface

- Create `FixtureSpec` in a new file.
- Refactor a single demo fixture to use it.
- Add type-checking for that fixture.

### Chunk 2: Deterministic UUID Consolidation

- Consolidate canonical UUID helper in
  `packages/server/src/demo-fixtures/helpers/deterministic-uuid.ts` (current canonical location).
- Update one factory to use the new helper.
- Remove the old UUID helper from that factory.

### Chunk 2b: Foundation Seeder Module Extraction

- Move `seedExchangeRates()` and `seedVATDefault()` from `demo-fixtures/helpers` to module helper
  paths under `packages/server/src/modules/*/helpers` (e.g.,
  `modules/exchange/helpers/seed-exchange-rates.helper.ts` and
  `modules/vat/helpers/seed-vat.helper.ts`).
- Update `scripts/seed-demo-data.ts` to import the seeders from the module helper locations.
- Ensure idempotency and update any docs to reference the canonical seeders.

### Chunk 3: Admin Context Standardization

- Ensure canonical `seedAdminCore` is in place.
- Update one script to use it.
- Remove legacy admin context logic from that script.

### Chunk 4: Canonical Ledger Validation

- Import canonical validator in test assertions.
- Refactor one assertion to use it.
- Remove duplicate logic from that assertion.

### Chunk 5: Command Renaming

- Rename one command in `package.json`.
- Update documentation for that command.

### Chunk 6: Expand Fixture/Factory Refactoring

- Refactor all remaining fixtures to use `FixtureSpec`.
- Refactor all factories to use canonical UUID and admin context helpers.

### Chunk 7: Testing

- Add/expand unit tests for helpers.
- Add/expand integration tests for seeding and validation.

### Chunk 8: Remove Deprecated Code

- Remove all legacy helpers, factories, and scripts.
- Add lint/CI checks to prevent reintroduction.

### Chunk 9: Final Integration

- Wire all scripts, factories, and tests together.
- Run and validate the full test suite.

### Chunk 10: Developer Documentation

- Write migration/upgrade notes.
- Update all relevant documentation.

---

## 3. Small, Safe Steps

### Chunk 1: Shared FixtureSpec Interface

#### Step 1.1: Create the FixtureSpec interface

#### Step 1.2: Refactor a single demo fixture to use FixtureSpec

#### Step 1.3: Add type-checking for that fixture

---

### Chunk 2: Deterministic UUID Consolidation

#### Step 2.1: Move/copy canonical UUID helper to a shared location

#### Step 2.2: Update one factory to use the new helper

#### Step 2.3: Remove the old UUID helper from that factory

---

### Chunk 3: Admin Context Standardization

#### Step 3.1: Ensure canonical seedAdminCore is in place

#### Step 3.2: Update one script to use seedAdminCore

#### Step 3.3: Remove legacy admin context logic from that script

---

### Chunk 4: Canonical Ledger Validation

#### Step 4.1: Import canonical validator in test assertions

#### Step 4.2: Refactor one assertion to use the canonical validator

#### Step 4.3: Remove duplicate logic from that assertion

---

### Chunk 5: Command Renaming

#### Step 5.1: Rename one command in package.json

#### Step 5.2: Update documentation for that command

---

### Chunk 6: Expand Fixture/Factory Refactoring

#### Step 6.1: Refactor all remaining fixtures to use FixtureSpec

#### Step 6.2: Refactor all factories to use canonical UUID and admin context helpers

---

### Chunk 7: Testing

#### Step 7.1: Add/expand unit tests for helpers

#### Step 7.2: Add/expand integration tests for seeding and validation

---

### Chunk 8: Remove Deprecated Code

#### Step 8.1: Remove all legacy helpers, factories, and scripts

#### Step 8.2: Add lint/CI checks to prevent reintroduction

---

### Chunk 9: Final Integration

#### Step 9.1: Wire all scripts, factories, and tests together

#### Step 9.2: Run and validate the full test suite

---

### Chunk 10: Developer Documentation

#### Step 10.1: Write migration/upgrade notes

#### Step 10.2: Update all relevant documentation

---

## 4. Prompts for Each Step

Below are code-generation prompts for each step. Each prompt is self-contained and builds on the
previous.

---

### Prompt 1.1: Create the FixtureSpec interface

```text
Create a new file at packages/server/src/fixtures/fixture-spec.ts.
Define and export the FixtureSpec TypeScript interface as described in the spec.
Do not implement any logic, just the interface.
```

---

### Prompt 1.2: Refactor a single demo fixture to use FixtureSpec

```text
Choose one demo fixture (e.g., monthly-expense-foreign-currency.ts).
Update its export to conform to the new FixtureSpec interface.
Import the interface from packages/server/src/fixtures/fixture-spec.ts and ensure type safety.
```

---

### Prompt 1.3: Add type-checking for that fixture

```text
In the same fixture file, add a type annotation to the exported object to ensure it matches FixtureSpec.
If there are type errors, fix the fixture to conform to the interface.
```

---

### Prompt 2.1: Move/copy canonical UUID helper to a shared location

```text
Consolidate `makeUUID(namespace, name)` in `packages/server/src/demo-fixtures/helpers/deterministic-uuid.ts`.
Ensure it is the canonical export used across demo fixtures, test factories, and helper code. If you prefer a repo-wide or module-wide shared location, migrate imports and update documentation to reference the chosen canonical path.
```

---

### Prompt 2.2: Update one factory to use the new helper

```text
Choose one factory (e.g., business.ts).
Update it to import and use makeUUID from packages/server/src/fixtures/deterministic-uuid.ts.
Remove any old UUID logic from this factory.
```

---

### Prompt 2.3: Remove the old UUID helper from that factory

```text
Delete any old or duplicate UUID helper code from the factory file.
Ensure only the canonical makeUUID is used.
```

---

### Prompt 3.1: Ensure canonical seedAdminCore is in place

```text
Verify that `seedAdminCore` is implemented in `scripts/seed-admin-context.ts` and remove or deprecate `createAdminBusinessContext` from `demo-fixtures/helpers/admin-context.ts`.
If not, move or implement it there as the only admin context creation function.
```

---

### Prompt 3.2: Update one script to use seedAdminCore

```text
Choose one script that creates admin context (e.g., seed-demo-data.ts).
Update it to import and use seedAdminCore from scripts/seed-admin-context.ts.
Remove any inline or legacy admin context logic from this script.
```

---

### Prompt 3.3: Remove legacy admin context logic from that script

```text
Delete any old or duplicate admin context creation code from the script.
Ensure only seedAdminCore is used.
```

---

### Prompt 4.1: Import canonical validator in test assertions

```text
In ledger-assertions.ts, import validateLedgerRecords from demo-fixtures/validators/ledger-validators.ts.
Prepare to use it in place of any custom validation logic.
```

---

### Prompt 4.2: Refactor one assertion to use the canonical validator

```text
Refactor one assertion function in ledger-assertions.ts to call validateLedgerRecords.
Remove the old validation logic from that function.
```

---

### Prompt 4.3: Remove duplicate logic from that assertion

```text
Delete any duplicate or now-unnecessary validation code from the assertion function.
Ensure only the canonical validator is used.
```

---

### Prompt 5.1: Rename one command in package.json

```text
In the root package.json, rename the seed command to seed:production.
Update any references in scripts or documentation accordingly.
```

---

### Prompt 5.2: Update documentation for that command

```text
Find all documentation that references the old seed command.
Update it to reference seed:production instead.
```

---

### Prompt 6.1: Refactor all remaining fixtures to use FixtureSpec

```text
Update all remaining demo and test fixtures to conform to the FixtureSpec interface.
Import and use the interface in each file, fixing any type errors.
```

---

### Prompt 6.2: Refactor all factories to use canonical UUID and admin context helpers

```text
Update all factories and tests to import and use the canonical `makeUUID(namespace, name)` (from `demo-fixtures/helpers/deterministic-uuid.ts`) and `seedAdminCore()` (from `scripts/seed-admin-context.ts`). Create temporary adapters for backwards compatibility if necessary to prevent huge refactors in one step.
Remove any legacy or duplicate helper code from these files.
```

---

### Prompt 7.1: Add/expand unit tests for helpers

```text
Add or expand unit tests for makeUUID, placeholder resolution, and seedAdminCore.
Ensure all edge cases are covered.
```

---

### Prompt 7.2: Add/expand integration tests for seeding and validation

```text
Add or expand integration tests that seed demo and test data, then validate using the canonical validator.
Ensure all scenarios pass.
```

---

### Prompt 8.1: Remove all legacy helpers, factories, and scripts

```text
Delete all legacy or deprecated helpers, factories, and scripts that are no longer used.
Ensure the codebase only uses the new, canonical implementations.
```

---

### Prompt 8.2: Add lint/CI checks to prevent reintroduction

```text
Add lint or CI checks to prevent the use of deprecated helpers or patterns (e.g., old UUID helpers).
Fail the build if any are detected.
```

---

### Prompt 9.1: Wire all scripts, factories, and tests together

```text
Ensure all scripts, factories, and tests are using the new shared infrastructure.
Run a full build and test to confirm everything is integrated.
```

---

### Prompt 9.2: Run and validate the full test suite

```text
Run the full test suite (unit, integration, regression).
Fix any issues that arise and ensure all tests pass.
```

---

### Prompt 10.1: Write migration/upgrade notes

```text
Write migration and upgrade notes for developers.
Explain what changed, why, and how to update any custom scripts or fixtures.
```

---

### Prompt 10.2: Update all relevant documentation

```text
Update all documentation to reflect the new architecture, commands, and best practices.
Remove references to deprecated logic.
```

---

**This sequence ensures safe, incremental progress, with each prompt building on the last and no
orphaned code.**
