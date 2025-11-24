# Ledger Integration & Test Data Plan

Owner: accounter-fullstack team  
Status: Draft  
Updated: 2025-11-20  
Related PR: Staging/tests data (#2727)

## 1) Objective

- Build reliable, repeatable integration tests to validate ledger generation for realistic scenarios
  (starting with Scenario A: ILS receipt expense).
- Decouple tests from GraphQL schema build complexities by exercising provider-level logic directly.
- Establish a reusable injector harness for future ledger scenarios and regression coverage.

## 2) Background & Current State

- Attempting to initialize a full GraphQL Modules application in-vitest fails with a resolver merge
  TypeError (reading `resolve`), and produces SDL errors when minimal module sets lack upstream
  types.
- We already validate Scenario A fixture insertion and DB writes.
- Path aliasing is fixed via `packages/server/vitest.config.ts`.
- Ledger generation depends on providers and context (admin business settings), not on executing
  GraphQL operations.

## 3) Goals & Non-Goals

- Goals:
  - Provide a provider-level DI injector to call `ledgerGenerationByCharge` in tests.
  - Cover Scenario A end-to-end: insert fixture → run generator → assert ledger records.
  - Make the harness reusable for additional scenarios.
- Non-Goals:
  - Building or validating the full GraphQL schema in-vitest.
  - Changing production module boundaries unless required for testability.

## 4) Approach Overview

- Build a minimal DI injector harness that wires the providers needed by `ledgerGenerationByCharge`,
  plus a constructed `adminContext` fetched from DB.
- Bypass `createApplication`/schema build entirely in tests; call the generator directly.
- Keep the harness in `packages/server` test utilities for reuse across ledger scenarios.

## 5) Architecture & Components

- Injector Harness:
  - Exposes an `injector` with required providers:
    - `DBProvider`, `LedgerProvider`, `DocumentsProvider`, `TransactionsProvider`,
      `FinancialEntitiesProvider`, `FinancialAccountsProvider`, `ExchangeProvider`, `VatProvider`,
      `MiscExpensesProvider`, `BusinessTripsProvider`, `UnbalancedBusinessesProvider`,
      `BalanceCancellationProvider` (confirm exact tokens/exports).
  - Accepts a pooled DB client or creates one via `Pool`.
  - Provides `adminContext` (derived from `user_context` + business defaults) to pass into
    generator.
  - Utilities: `insertFixture`, `generateLedgerForCharge`, `getLedgerRecords`, `cleanup`.
- Test Flow:
  1. Insert Scenario A fixture and commit (ensures visibility across connections).
  2. Build `adminContext` for the test business/user.
  3. Invoke `ledgerGenerationByCharge({ chargeId }, { injector, adminContext })`.
  4. Assert records, totals, balancing.

## 6) Implementation Plan

- Phase 1: Harness Scaffolding
  - Create `packages/server/src/test-utils/ledger-injector.ts`:
    - Create a simple class/factory that:
      - Lazily creates `Pool` and a client as needed.
      - Instantiates providers with dependencies (respect constructor signatures).
      - Builds an object implementing `InjectorLike.get(ProviderToken)`.
      - Fetches `adminContext` from DB for a given `userId`/`businessId`.
      - Returns `{ injector, adminContext }` and utilities.
  - Export types to keep usage strict in tests.
- Phase 2: Refactor Scenario A Integration Test
  - Update `packages/server/src/modules/ledger/__tests__/ledger-scenario-a.integration.test.ts` to:
    - Remove `createApplication` calls.
    - Use the harness to get `{ injector, adminContext }`.
    - Call `ledgerGenerationByCharge` with the charge from the inserted fixture.
    - Assert ledger entries and balances.
- Phase 3: Reusability & Coverage
  - Extract common fixture helpers if needed.
  - Add at least one more scenario to validate VAT/exchange paths.
  - Ensure harness is configurable (e.g., exchange rate overrides).

## 7) Dependencies & Provider Map

- Confirm and import provider classes/tokens from the following packages (server modules):
  - `ledger`, `documents`, `transactions`, `financial-entities`, `financial-accounts`,
    `misc-expenses`, `exchange`, `vat`, `business-trips`, `unbalanced-businesses`,
    `balance-cancellation`.
- Ensure the provider constructors do not assume presence of `GraphQL Modules` application; inject
  only what is required (DB, config/env, logger as needed).
- Provide minimal `ENVIRONMENT`/config needed (e.g., currency defaults), or fetch from DB when
  available.

## 8) Test Scenarios & Assertions

- Scenario A: ILS Receipt Expense
  - Given: Expense of 500 ILS paid by bank account.
  - Expect:
    - 2 records total
    - Debit 500 ILS to expense category
    - Credit 500 ILS to bank category
    - Totals balanced
  - Assertions:
    - Count: `expect(records.length).toBe(2)`
    - Aggregates: sum debit/credit per currency
    - Categories: validate category ids/types align with expense/bank

## 9) Commands

Run only the server test with server config:

```bash
yarn vitest run -c packages/server/vitest.config.ts packages/server/src/modules/ledger/__tests__/ledger-scenario-a.integration.test.ts
```

Run the entire server test suite:

```bash
yarn vitest run -c packages/server/vitest.config.ts packages/server
```

## 10) Risks & Mitigations

- Risk: Provider constructors rely on app-level context.
  - Mitigation: Shim minimal dependencies (env/config) or refactor providers slightly for
    testability (prefer DI of primitives).
- Risk: Admin context shape mismatches expectations.
  - Mitigation: Centralize admin context builder; validate shape in a small unit test.
- Risk: Cross-connection visibility issues.
  - Mitigation: Commit fixture transaction before generation; optionally share the same client.

## 11) Milestones & Acceptance Criteria

- M1: Harness compiles and resolves all providers
  - AC: `ledger-injector.ts` builds `injector` and `adminContext` without runtime errors.
- M2: Scenario A passes
  - AC: Test runs green and asserts exact ledger entries and balances.
- M3: Add second scenario exercising VAT/exchange logic
  - AC: Tests cover VAT categories and exchange rates with clear assertions.

## 12) Deliverables

- `packages/server/src/test-utils/ledger-injector.ts` (harness)
- Updated `ledger-scenario-a.integration.test.ts` using harness
- Documentation updates in this plan and `docs/demo-test-data-todo.md`

## 13) Timeline (Draft)

- Day 1: Implement harness + compile
- Day 2: Refactor Scenario A test and get it green
- Day 3: Add a VAT/exchange scenario and finalize docs

## 14) Open Questions

- Do any providers hard-require `createApplication` artifacts (e.g., tokens not available outside
  app)? If yes, identify minimal adapters.
- Should we standardize a shared test admin business and freeze its IDs?

## 15) References

- Test: `packages/server/src/modules/ledger/__tests__/ledger-scenario-a.integration.test.ts`
- Vitest config: `packages/server/vitest.config.ts`
- Fixture helpers: `packages/server/src/...` (existing insert fixture utilities)
- GraphQL Modules testing docs (for conceptual background)
