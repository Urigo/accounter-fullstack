# Ledger Integration Tests Refactor Specification

## Objective

Refactor existing ledger integration tests to validate **semantic correctness** of accounting
entries, not just numerical balance. Current tests verify totals match but ignore which accounts are
debited/credited—the essence of double-entry bookkeeping.

## Scope

- Files to modify:
  - `packages/server/src/modules/ledger/__tests__/ledger-scenario-a.integration.test.ts`
  - `packages/server/src/modules/ledger/__tests__/ledger-scenario-b.integration.test.ts`
- Scenarios covered:
  - Scenario A: Simple ILS receipt expense (500 ILS office supplies)
  - Scenario B: Foreign currency USD invoice expense (200 USD consulting @ 3.5 ILS/USD)

## High-Level Goals

1. Ensure each ledger record correctly assigns debit/credit entities (accounts / tax categories /
   counterparties).
2. Preserve and validate foreign currency amounts and implied exchange rates where applicable.
3. Validate dates, metadata, and ownership integrity.
4. Assert per-record internal balance (not only aggregate balance).
5. Prevent orphaned amounts (amount without entity) and improper null/zero usage.
6. Verify business logic expectations (expense side vs payment side placement).
7. Validate audit trail fields and systemic correctness (locked flag, timestamps).
8. Confirm error-free generation and completeness of expectation data.

## Detailed Validation Requirements

### 1. Account / Entity Assignment (Critical)

For each scenario:

- Locate records by `debit_entity*` / `credit_entity*` matching deterministic UUIDs produced by
  `makeUUID`.
- Scenario A:
  - Debit: `expense-general`
  - Credit: `bank-account-tax-category`
  - Secondary entities (`entity2`) must be `NULL`.
- Scenario B:
  - Debit: `expense-consulting`
  - Credit: `usd-account-tax-category`
  - Validate optional presence of supplier (`supplier-us-vendor-llc`) if system maps payable logic.
    If supplier not present, document assumption inline.
- Assert no unexpected entities appear.

### 2. Foreign Currency Preservation (Scenario B)

- `debit_foreign_amount1` and/or `credit_foreign_amount1` must equal `200.00` (USD) as strings.
- `currency` must be `USD` for all generated records in Scenario B, `ILS` in Scenario A.
- Local amounts must equal foreign × exchange rate (200 × 3.5 = 700.00 ILS).
- Secondary foreign amounts (`*_foreign_amount2`) must be `NULL` unless business logic creates
  multi-leg entries.
- Scenario A: All foreign amount fields must be `NULL`.

### 3. Dates Accuracy

- `invoice_date` should match fixture document date.
- `value_date` should match transaction event/value date.
- Reasonable bounds: Not in future and not pre-2020 (configurable constant if desired).
- Verify `invoice_date <= value_date + credit terms tolerance` (e.g., 30 days) or document
  deviation.

### 4. Description & Reference Metadata

- `description` non-empty, meaningful (not generic placeholders). Optionally pattern match keywords
  (e.g., "office", "consulting").
- `reference1` must contain or equal document serial number or external identifier (e.g., invoice
  number).
- At least one ledger record must include the document serial number reference.

### 5. Owner Assignment

- All records: `owner_id === adminContext.defaultAdminBusinessId` for the given test execution.
- No `NULL` owner IDs.

### 6. Individual Record Internal Balance

For every record:

- Sum of debit local amounts (`debit_local_amount1 + debit_local_amount2`) equals sum of credit
  local amounts (`credit_local_amount1 + credit_local_amount2`).
- Allow rounding tolerance (`< 0.01`).
- Total of all amounts per record must be > 0 (avoid empty records).

### 7. Orphaned Amount Prevention

- Any non-zero local or foreign amount implies presence of corresponding entity (`debit_entityX` or
  `credit_entityX`).
- If entity field is `NULL`, corresponding amount fields (`*_local_amountX`, `*_foreign_amountX`)
  must be `NULL`.

### 8. Amount Sign & Positivity

- All magnitude fields stored as positive numbers; debit/credit classification provides semantic
  direction.
- Foreign and local amounts must be positive or `NULL`.
- Negative numeric string values should not appear; if they do, test must fail.

### 9. Null vs Zero Semantics

- Unused `*_amount2` fields must be `NULL`, not zero.
- Required primary amounts (`debit_local_amount1`, `credit_local_amount1`) cannot be `NULL`.
- Foreign amounts in local currency scenarios must be `NULL` (not zero).

### 10. Audit Trail Fields

- `created_at` and `updated_at` present.
- For freshly created records: `created_at === updated_at`.
- `created_at` timestamp within a reasonable recent window (e.g., within test run timeframe;
  configurable tolerance).
- `locked === false` for newly generated records.

### 11. Exchange Rate Implied Validation (Scenario B)

- Implied rate: `local_amount1 / foreign_amount1 ≈ 3.5` (tolerance: 0.01 or fewer decimal places as
  needed).
- Consistency across all records with foreign amounts.
- No divergent implied rates per side.

### 12. Charge Linkage

- All records: `charge_id === expected deterministic charge UUID` per fixture.
- No stray records referencing other charges.

### 13. Business Logic Assertions

Expense scenario expectations:

- Expense accounts appear exclusively on debit side (increase in expense).
- Bank (or cash) accounts appear on credit side (decrease in asset due to payment).
- Totals aggregated by entity role confirm direction (sum of expense debits > 0, sum of bank
  credits > 0).

### 14. Error Array Validation

- `result.errors` must be an empty array.
- If non-empty, fail fast with error context.

### 15. Optional / Future: VAT Handling (Not currently in fixtures)

- If VAT introduced: split debits (net expense + VAT receivable) vs full credit (payment).
- Validate VAT percentage (e.g., 17%) and rounding.
- Ensure `debit_entity2` corresponds to VAT account.

### 16. Optional / Future: Supplier / Payables Logic

- If system maps payables: presence of supplier ledger line on credit side before cash settlement.
- Distinguish between invoice recognition (supplier credit) and payment (bank credit, supplier
  debit) if multi-stage entries are adopted.

### 17. Test Structure Refactor

Introduce grouped describes:

```typescript
describe('Core Ledger Validations', ...)
describe('Amounts', ...)
describe('Metadata', ...)
describe('Business Logic', ...)
describe('Foreign Currency (Scenario B)', ...)
```

Each block isolates concerns for easier maintenance and targeted failures.

### 18. Helper Extraction (Recommended)

Create utility functions in a shared test helper (e.g.,
`packages/server/src/modules/ledger/__tests__/helpers/ledger-assertions.ts`):

- `assertEntityAssignments(records, scenarioType)`
- `assertForeignCurrency(records, expectedRate, expectedForeignAmount)`
- `assertRecordInternalBalance(record)`
- `assertNoOrphanedAmounts(record)`
- `assertAuditTrail(record)`
- `assertOwner(record, ownerId)`
- `collectTotalsByEntity(records)` for summarizing business logic tests.

### 19. Deterministic UUID Reliance

Continue using `makeUUID` seeds; add explicit comments noting reliance for reproducibility.

### 20. Rounding / Tolerance Strategy

Centralize numeric comparison with helper:

```typescript
function expectClose(actual: number, expected: number, tolerance = 0.01) { ... }
```

Use for:

- Exchange rate checks
- Per-record balance comparisons

### 21. Failure Messaging

Use descriptive assertion messages:

- Include record index, entity UUID, field name.
- Example: `Record 1: debit_local_amount1 present without debit_entity1`.

### 22. Non-Functional Considerations

- Keep test runtime reasonable by reusing DB setup already implemented.
- Avoid re-querying ledger table repeatedly; query once per scenario and pass to helpers.
- Cleanup logic remains unchanged.

### 23. Success Criteria

Refactor complete when:

- All new assertions pass for both scenarios.
- Failure of any semantic rule yields clear message.
- Coverage includes each requirement above (except optional future VAT/payables logic).

### 24. Out-of-Scope (Explicit)

- Introducing VAT splits where not in fixtures.
- Changing generation algorithm.
- Modifying production ledger schema.
- Locking mechanism tests beyond initial state.

## Implementation Phases

1. Add helper assertion module.
2. Refactor Scenario A tests applying core + metadata + logic validations.
3. Extend Scenario B tests with foreign currency & exchange rate validations.
4. Consolidate repetitive inline checks into helpers for readability.
5. Run and adjust tolerance issues (rounding, string vs numeric conversions).

## Risk & Mitigation

- Rounding differences: Use `Number()` + tolerance helper.
- Null vs zero confusion: Enforce explicit checks early to catch fixture drift.
- Schema evolution: Keep helper referencing interface rather than raw property names when possible.

## Future Enhancements (Documented for Follow-Up)

- Introduce dedicated VAT scenario.
- Add payable cycle test (invoice creation vs payment clearing).
- Snapshot testing of ledger record JSON structure.
- Add test ensuring ledger lock mutations prevent alteration (once implemented).

---

**End of Specification**
