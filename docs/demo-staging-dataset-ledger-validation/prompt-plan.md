# Ledger Validation Enhancement - Implementation Blueprint & Prompt Plan

## Overview

This document provides a step-by-step implementation plan for enhancing the demo data validation
system with comprehensive ledger validation. Each step is designed to be small, safe, and buildable,
with clear prompts for LLM-assisted implementation.

---

## Phase 1: Foundation & Type System

### Step 1.1: Create Type Definitions

**Objective**: Establish the type foundation for all validation logic.

**Complexity**: Low  
**Estimated Time**: 15 minutes  
**Dependencies**: None

**Prompt 1.1:**

```text
Create the file `packages/server/src/demo-fixtures/validators/types.ts` with TypeScript interfaces for ledger validation.

Requirements:
1. Define `LedgerRecord` interface matching the database schema:
   - Include all fields from `accounter_schema.ledger_records` table
   - Use `string | null` for numeric fields (they come as strings from pg)
   - Use `Date` for date fields

2. Define `ValidationContext` interface:
   - `useCaseId: string`
   - `defaultCurrency: string` (e.g., 'ILS')
   - `tolerance: number` (e.g., 0.005)

3. Define `EntityBalance` interface for tracking entity-level balances:
   - `entityId: string`
   - `totalDebit: number`
   - `totalCredit: number`
   - `netBalance: number`
   - `recordCount: number`

Export all interfaces.

Reference the existing database schema in `packages/migrations/src/actions/2024-01-29T13-15-23.initial.ts` (lines 1198-1240) for field names.

Return the complete file.
```

**Validation**: File compiles without TypeScript errors.

---

### Step 1.2: Create Utility Functions

**Objective**: Build reusable helper functions for amount parsing and balance checking.

**Complexity**: Low  
**Estimated Time**: 15 minutes  
**Dependencies**: Step 1.1

**Prompt 1.2:**

```text
Create the file `packages/server/src/demo-fixtures/validators/ledger-validators.ts` and implement utility functions.

Requirements:
1. Import types from `./types.js`

2. Implement `parseAmount(value: string | null | undefined): number`:
   - Handle null/undefined by returning 0
   - Parse string to float using `parseFloat()`
   - Return 0 for NaN results
   - Add JSDoc comment explaining the function

3. Implement `isBalanced(a: number, b: number, tolerance = 0.005): boolean`:
   - Return true if Math.abs(a - b) <= tolerance
   - Add JSDoc comment explaining tolerance-based comparison

Export both functions.

Return the complete file.
```

**Validation**: Functions handle edge cases (null, undefined, NaN, zero).

---

## Phase 2: Core Validation Functions (P0 - Critical Path)

### Step 2.1: Implement Per-Record Internal Balance Validation (FR1)

**Objective**: Validate that each ledger record is internally balanced.

**Complexity**: Medium  
**Estimated Time**: 30 minutes  
**Dependencies**: Step 1.2

**Prompt 2.1:**

```text
In `packages/server/src/demo-fixtures/validators/ledger-validators.ts`, add the function `validateRecordInternalBalance`.

Requirements:
1. Function signature:
   ``typescript
   export function validateRecordInternalBalance(
     records: LedgerRecord[],
     context: ValidationContext
   ): string[]
``

2. For each record:
   - Calculate totalDebit = parseAmount(debit_local_amount1) + parseAmount(debit_local_amount2)
   - Calculate totalCredit = parseAmount(credit_local_amount1) + parseAmount(credit_local_amount2)
   - Check if balanced using `isBalanced(totalDebit, totalCredit, context.tolerance)`
   - If not balanced, push error:
     `{useCaseId} - Record {index} ({record.id}): internal imbalance (debit={X}, credit={Y})`
   - If both totalDebit and totalCredit are 0, push error:
     `{useCaseId} - Record {index} ({record.id}): empty record (all amounts zero)`

3. Return array of error messages (empty if valid)

4. Add comprehensive JSDoc comment explaining FR1

Return the updated file with the new function added.

```

**Validation**: Function correctly identifies unbalanced and empty records.

---

### Step 2.2: Implement Aggregate Balance Validation (FR2)

**Objective**: Validate total debits equal total credits across all records.

**Complexity**: Low **Estimated Time**: 20 minutes **Dependencies**: Step 1.2

**Prompt 2.2:**

```text
In `packages/server/src/demo-fixtures/validators/ledger-validators.ts`, add the function `validateAggregateBalance`.

Requirements:
1. Function signature:
   ``typescript
   export function validateAggregateBalance(
     records: LedgerRecord[],
     context: ValidationContext
   ): string[]
``

2. Use `reduce()` to calculate:
   - `totalDebit`: sum of all debit_local_amount1 + debit_local_amount2
   - `totalCredit`: sum of all credit_local_amount1 + credit_local_amount2

3. Check if balanced using `isBalanced(totalDebit, totalCredit, context.tolerance)`

4. If not balanced, push error: `{useCaseId}: aggregate ledger not balanced (debit {X}, credit {Y})`

5. Return array of error messages

6. Add JSDoc comment explaining FR2 and noting this refactors existing logic

Return the updated file.

```

**Validation**: Correctly sums all amounts and detects imbalances.

---

### Step 2.3: Implement Entity-Level Balance Validation (FR3)

**Objective**: Validate each entity's net position balances to zero.

**Complexity**: High **Estimated Time**: 45 minutes **Dependencies**: Step 1.2

**Prompt 2.3:**

```text
In `packages/server/src/demo-fixtures/validators/ledger-validators.ts`, add the function `validateEntityBalance`.

Requirements:
1. Function signature:
   ``typescript
   export function validateEntityBalance(
     records: LedgerRecord[],
     context: ValidationContext
   ): string[]
``

2. Create a Map<string, EntityBalance> to track entity balances

3. Implement helper function `addToEntity(entityId: string | null, debit: number, credit: number)`:
   - Skip if entityId is null
   - Get or create EntityBalance for the entity
   - Add to totalDebit, totalCredit
   - Calculate netBalance = totalDebit - totalCredit
   - Increment recordCount

4. For each record, call addToEntity for:
   - debit_entity1 with debit_local_amount1
   - debit_entity2 with debit_local_amount2
   - credit_entity1 with credit_local_amount1
   - credit_entity2 with credit_local_amount2

5. Validate each entity's netBalance is close to 0 using isBalanced()

6. If unbalanced, push error:
   `{useCaseId}: Entity {entityId} unbalanced (net={X}, debit={Y}, credit={Z}, records={N})`

7. Add comprehensive JSDoc comment explaining FR3

Return the updated file.

```

**Validation**: Correctly aggregates per-entity and detects unbalanced entities.

---

### Step 2.4: Implement Record Count Validation (FR8)

**Objective**: Validate expected number of ledger records.

**Complexity**: Low **Estimated Time**: 15 minutes **Dependencies**: Step 1.2

**Prompt 2.4:**

```text
In `packages/server/src/demo-fixtures/validators/ledger-validators.ts`, add the function `validateRecordCount`.

Requirements:
1. Function signature:
   ``typescript
   export function validateRecordCount(
     records: LedgerRecord[],
     expectedCount: number,
     context: ValidationContext
   ): string[]
``

2. Compare records.length with expectedCount

3. If mismatch, push error: `{useCaseId}: ledger record count mismatch (expected {X}, got {Y})`

4. Return array of error messages

5. Add JSDoc comment explaining FR8

Return the updated file.
```

**Validation**: Detects count mismatches correctly.

---

## Phase 3: Data Integrity Validations (P0 - Critical Path)

### Step 3.1: Implement Orphaned Amount Detection (FR4)

**Objective**: Detect amounts without corresponding entities.

**Complexity**: Medium **Estimated Time**: 40 minutes **Dependencies**: Step 1.2

**Prompt 3.1:**

```text
In `packages/server/src/demo-fixtures/validators/ledger-validators.ts`, add the function `validateNoOrphanedAmounts`.

Requirements:
1. Function signature:
   ``typescript
   export function validateNoOrphanedAmounts(
     records: LedgerRecord[],
     context: ValidationContext
   ): string[]
``

2. For each record, create array of checks for:
   - debit_local_amount1 / debit_entity1
   - debit_local_amount2 / debit_entity2
   - credit_local_amount1 / credit_entity1
   - credit_local_amount2 / credit_entity2

3. For each check:
   - If amount > 0 and entity is null: push error about orphaned amount
   - For secondary fields (entity2), if entity is null and amount field is not null in the record:
     push error about field should be null

4. Error format:
   `{useCaseId} - Record {index} ({record.id}): orphaned amount in {field} ({amount} without entity)`

5. Add JSDoc explaining FR4 and the orphaned amount concept

Return the updated file.

```

**Validation**: Correctly identifies orphaned amounts and improper nulls.

---

### Step 3.2: Implement Positive Amount Validation (FR5)

**Objective**: Ensure all amounts are non-negative.

**Complexity**: Low **Estimated Time**: 20 minutes **Dependencies**: Step 1.2

**Prompt 3.2:**

```text
In `packages/server/src/demo-fixtures/validators/ledger-validators.ts`, add the function `validatePositiveAmounts`.

Requirements:
1. Function signature:
   ``typescript
   export function validatePositiveAmounts(
     records: LedgerRecord[],
     context: ValidationContext
   ): string[]
``

2. Define const array of field names to check:

   ``typescript
   const amountFields = [
     'debit_local_amount1',
     'debit_local_amount2',
     'credit_local_amount1',
     'credit_local_amount2',
     'debit_foreign_amount1',
     'debit_foreign_amount2',
     'credit_foreign_amount1',
     'credit_foreign_amount2',
   ] as const;
   ``

3. For each record and each field:
   - Parse the amount
   - If value < 0, push error:
     `{useCaseId} - Record {index} ({record.id}): negative amount in {field} ({value})`

4. Add JSDoc explaining FR5

Return the updated file.
```

**Validation**: Detects negative amounts in any field.

---

## Phase 4: Foreign Currency & Dates (P1 - Important)

### Step 4.1: Implement Date Validation (FR7)

**Objective**: Validate invoice_date and value_date presence and ranges.

**Complexity**: Medium **Estimated Time**: 30 minutes **Dependencies**: Step 1.2

**Prompt 4.1:**

```text
In `packages/server/src/demo-fixtures/validators/ledger-validators.ts`, add the function `validateDates`.

Requirements:
1. Function signature:
   ``typescript
   export function validateDates(
     records: LedgerRecord[],
     context: ValidationContext
   ): string[]
``

2. Define constants:

   ``typescript
   const minDate = new Date('2020-01-01');
   const maxDate = new Date('2030-12-31');
   ``

3. For each record:
   - Check invoice_date:
     - If missing/null: push error about missing invoice_date
     - If invalid date (isNaN): push error about invalid invoice_date
     - If out of range: push error about out of range
   - Repeat same checks for value_date

4. Error format: `{useCaseId} - Record {index} ({record.id}): missing|invalid|out of range {field}`

5. Add JSDoc explaining FR7

Return the updated file.
```

**Validation**: Catches missing, invalid, and out-of-range dates.

---

### Step 4.2: Implement Foreign Currency Validation (FR6)

**Objective**: Validate foreign currency handling and exchange rates.

**Complexity**: High **Estimated Time**: 45 minutes **Dependencies**: Step 1.2

**Prompt 4.2:**

```text
In `packages/server/src/demo-fixtures/validators/ledger-validators.ts`, add the function `validateForeignCurrency`.

Requirements:
1. Function signature:
   ``typescript
   export function validateForeignCurrency(
     records: LedgerRecord[],
     context: ValidationContext
   ): string[]
``

2. For each record:
   - Determine if foreign currency: `record.currency !== context.defaultCurrency`
   - Check if has foreign amounts: any of the 4 foreign_amount fields is not null

3. Validate consistency:
   - If foreign currency but no foreign amounts: push error
   - If local currency but has foreign amounts: push error

4. Implement helper `checkExchangeRate(localAmount, foreignAmount, field)`:
   - Skip if either is null/0
   - Calculate impliedRate = parseAmount(local) / parseAmount(foreign)
   - If rate < 0.1 or > 10.0: push error about suspicious exchange rate

5. For foreign currency records, check exchange rate for all 4 amount pairs

6. Error formats:
   - Foreign currency mismatch:
     `{useCaseId} - Record {index} ({id}): foreign currency ({currency}) but no foreign amounts`
   - Local with foreign:
     `{useCaseId} - Record {index} ({id}): local currency ({currency}) but has foreign amounts`
   - Bad rate: `{useCaseId} - Record {index} ({id}): suspicious exchange rate in {field} (rate={X})`

7. Add comprehensive JSDoc explaining FR6

Return the updated file.
```

**Validation**: Validates foreign currency consistency and reasonable exchange rates.

---

## Phase 5: Integration & Master Validator

### Step 5.1: Create Master Validation Function

**Objective**: Orchestrate all validators into a single function.

**Complexity**: Low **Estimated Time**: 20 minutes **Dependencies**: Steps 2.1-2.4, 3.1-3.2, 4.1-4.2

**Prompt 5.1:**

````text
In `packages/server/src/demo-fixtures/validators/ledger-validators.ts`, add the master function `validateLedgerRecords`.

Requirements:
1. Function signature:
   ```typescript
   export function validateLedgerRecords(
     records: LedgerRecord[],
     expectedRecordCount: number,
     context: ValidationContext
   ): string[]
```

2. Create empty errors array: `const allErrors: string[] = []`

3. Call all validators in this order and spread their results into allErrors:
   - validateRecordInternalBalance (FR1)
   - validateAggregateBalance (FR2)
   - validateEntityBalance (FR3)
   - validateNoOrphanedAmounts (FR4)
   - validatePositiveAmounts (FR5)
   - validateForeignCurrency (FR6)
   - validateDates (FR7)
   - validateRecordCount (FR8)

4. Return allErrors

5. Add JSDoc explaining this is the master validator that runs all validation rules

Return the updated file.

````

**Validation**: Function compiles and calls all validators correctly.

---

## Phase 6: Main Script Integration

### Step 6.1: Update validate-demo-data.ts Imports and Constants

**Objective**: Add new imports and configuration constants.

**Complexity**: Low **Estimated Time**: 10 minutes **Dependencies**: Steps 1.1, 5.1

**Prompt 6.1:**

````text
Update `packages/server/src/demo-fixtures/validate-demo-data.ts` to import the new validation system.

Requirements:
1. Add imports at the top:
   ```typescript
   import { validateLedgerRecords } from './validators/ledger-validators.js';
   import type { LedgerRecord, ValidationContext } from './validators/types.js';
```

2. Add constants after the imports:

   ```typescript
   const DEFAULT_CURRENCY = 'ILS';
   const BALANCE_TOLERANCE = 0.005;
```

3. Keep all existing imports and code intact

Return only the changed sections with sufficient context (5-10 lines before/after).

````

**Validation**: File compiles without errors.

---

### Step 6.2: Replace Single Use-Case Validation with Multi-Use-Case Loop

**Objective**: Implement FR9 - validate ALL use-cases with expectations.

**Complexity**: Medium **Estimated Time**: 30 minutes **Dependencies**: Step 6.1

**Prompt 6.2:**

````text
In `packages/server/src/demo-fixtures/validate-demo-data.ts`, replace the existing single use-case validation logic (section 3) with comprehensive multi-use-case validation.

Current code structure (to be replaced):
```typescript
// 3. Sample ledger balance checks (for use-cases with expectations)
const useCaseWithExpectations = useCases.find(uc => uc.expectations);
if (useCaseWithExpectations) {
  const chargeId = useCaseWithExpectations.fixtures.charges[0].id;
  // ... existing simple validation
}
```

Requirements:

1. Filter use-cases to only those with expectations:

   ```typescript
   const useCasesWithExpectations = useCases.filter(uc => uc.expectations);
   ```

2. Add progress log:

   ```typescript
   console.log(`\nValidating ledger records for ${useCasesWithExpectations.length} use-case(s)...`);
  ```

3. Loop through each use-case:

   ```typescript
   for (const useCase of useCasesWithExpectations) {
   ```

4. For each use-case:
   - Extract charge IDs: `const chargeIds = useCase.fixtures.charges.map(c => c.id);`
   - Query ledger records using `WHERE charge_id = ANY($1)` with chargeIds array
   - Type the query result as `LedgerRecord`
   - If no records found, push error and continue to next use-case
   - Create ValidationContext object with useCaseId, DEFAULT_CURRENCY, BALANCE_TOLERANCE
   - Call `validateLedgerRecords(records, expectedCount, context)`
   - Push validation errors to main errors array
   - Log progress: `✓` if no errors, `✗ {useCase.id} ({N} error(s))` if errors

5. Keep sections 1, 2, and 4 unchanged

Return the complete updated validateDemoData function.
````

**Validation**: Validates all use-cases, not just the first one.

---

## Phase 7: Unit Testing

### Step 7.1: Create Test File and Setup

**Objective**: Set up test infrastructure with mock data.

**Complexity**: Low **Estimated Time**: 20 minutes **Dependencies**: Phase 2-4

**Prompt 7.1:**

````text
Create `packages/server/src/demo-fixtures/validators/ledger-validators.test.ts` with test setup and utilities.

Requirements:
1. Import vitest functions and types:
   ```typescript
   import { describe, it, expect } from 'vitest';
   import type { LedgerRecord, ValidationContext } from './types.js';
```

2. Import validators (we'll test them incrementally)

3. Create mock context:

   ```typescript
   const mockContext: ValidationContext = {
     useCaseId: 'test-case',
     defaultCurrency: 'ILS',
     tolerance: 0.005,
   };
   ```

4. Create helper function to build mock LedgerRecord:
   ```typescript
   function createMockRecord(overrides: Partial<LedgerRecord> = {}): LedgerRecord {
     return {
       id: 'rec-1',
       charge_id: 'charge-1',
       owner_id: 'owner-1',
       debit_entity1: null,
       debit_local_amount1: null,
       debit_foreign_amount1: null,
       debit_entity2: null,
       debit_local_amount2: null,
       debit_foreign_amount2: null,
       credit_entity1: null,
       credit_local_amount1: null,
       credit_foreign_amount1: null,
       credit_entity2: null,
       credit_local_amount2: null,
       credit_foreign_amount2: null,
       currency: 'ILS',
       invoice_date: new Date('2024-01-01'),
       value_date: new Date('2024-01-01'),
       description: null,
       reference1: null,
       ...overrides,
     };
   }
   ```

Return the complete file (just setup, no tests yet).
````

**Validation**: File compiles and helper function works.

---

### Step 7.2: Add Tests for Utility Functions

**Objective**: Test parseAmount and isBalanced utilities.

**Complexity**: Low **Estimated Time**: 15 minutes **Dependencies**: Step 7.1

**Prompt 7.2:**

````text
In `packages/server/src/demo-fixtures/validators/ledger-validators.test.ts`, add tests for utility functions.

Requirements:
1. Import `parseAmount` and `isBalanced` from './ledger-validators.js'

2. Add describe block for parseAmount:
   ```typescript
   describe('parseAmount', () => {
     it('should parse valid number strings', () => {
       expect(parseAmount('100.50')).toBe(100.50);
       expect(parseAmount('0')).toBe(0);
     });

     it('should handle null and undefined', () => {
       expect(parseAmount(null)).toBe(0);
       expect(parseAmount(undefined)).toBe(0);
     });

     it('should handle invalid strings', () => {
       expect(parseAmount('invalid')).toBe(0);
       expect(parseAmount('')).toBe(0);
     });
   });
```

3. Add describe block for isBalanced:

   ```typescript
   describe('isBalanced', () => {
     it('should return true for equal values', () => {
       expect(isBalanced(100, 100)).toBe(true);
     });

     it('should return true for values within tolerance', () => {
       expect(isBalanced(100, 100.005, 0.005)).toBe(true);
     });

     it('should return false for values outside tolerance', () => {
       expect(isBalanced(100, 102, 0.005)).toBe(false);
     });
   });
   ```

Return the updated file with new test blocks added.
````

**Validation**: Run tests - all should pass.

---

### Step 7.3: Add Tests for Per-Record Balance (FR1)

**Objective**: Test validateRecordInternalBalance function.

**Complexity**: Medium **Estimated Time**: 20 minutes **Dependencies**: Step 7.2

**Prompt 7.3:**

````text
In `packages/server/src/demo-fixtures/validators/ledger-validators.test.ts`, add tests for validateRecordInternalBalance.

Requirements:
1. Import the function: `import { validateRecordInternalBalance } from './ledger-validators.js';`

2. Add describe block with 3 test cases:

Test 1 - Balanced record:
```typescript
it('should pass for balanced record', () => {
  const record = createMockRecord({
    debit_entity1: 'entity-1',
    debit_local_amount1: '100.00',
    credit_entity1: 'entity-2',
    credit_local_amount1: '100.00',
  });

  const errors = validateRecordInternalBalance([record], mockContext);
  expect(errors).toHaveLength(0);
});
```

Test 2 - Unbalanced record:

```typescript
it('should fail for unbalanced record', () => {
  const record = createMockRecord({
    debit_local_amount1: '100.00',
    credit_local_amount1: '99.00',
  });

  const errors = validateRecordInternalBalance([record], mockContext);
  expect(errors).toHaveLength(1);
  expect(errors[0]).toContain('internal imbalance');
  expect(errors[0]).toContain('debit=100.00');
  expect(errors[0]).toContain('credit=99.00');
});
```

Test 3 - Empty record:

```typescript
it('should detect empty records', () => {
  const record = createMockRecord({
    // All amounts null/zero
  });

  const errors = validateRecordInternalBalance([record], mockContext);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain('empty record');
});
```

Return the updated file.
````

**Validation**: Run tests - all should pass.

---

### Step 7.4: Add Tests for Entity Balance (FR3)

**Objective**: Test validateEntityBalance function.

**Complexity**: Medium **Estimated Time**: 25 minutes **Dependencies**: Step 7.3

**Prompt 7.4:**

````text
In `packages/server/src/demo-fixtures/validators/ledger-validators.test.ts`, add tests for validateEntityBalance.

Requirements:
1. Import: `import { validateEntityBalance } from './ledger-validators.js';`

2. Add describe block with 2 test cases:

Test 1 - Balanced entities:
```typescript
it('should pass when all entities balance to zero', () => {
  const records = [
    createMockRecord({
      debit_entity1: 'entity-1',
      debit_local_amount1: '100.00',
      credit_entity1: 'entity-2',
      credit_local_amount1: '100.00',
    }),
    createMockRecord({
      id: 'rec-2',
      debit_entity1: 'entity-2',
      debit_local_amount1: '100.00',
      credit_entity1: 'entity-1',
      credit_local_amount1: '100.00',
    }),
  ];

  const errors = validateEntityBalance(records, mockContext);
  expect(errors).toHaveLength(0);
});
```

Test 2 - Unbalanced entity:

```typescript
it('should fail when entity has unbalanced position', () => {
  const record = createMockRecord({
    debit_entity1: 'entity-1',
    debit_local_amount1: '100.00',
    credit_entity1: 'entity-2',
    credit_local_amount1: '100.00',
  });

  const errors = validateEntityBalance([record], mockContext);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain('unbalanced');
  expect(errors[0]).toContain('entity-1');
});
```

Return the updated file.
````

**Validation**: Run tests - all should pass.

---

### Step 7.5: Add Tests for Data Integrity (FR4, FR5)

**Objective**: Test orphaned amounts and negative amounts validation.

**Complexity**: Medium **Estimated Time**: 25 minutes **Dependencies**: Step 7.4

**Prompt 7.5:**

````text
In `packages/server/src/demo-fixtures/validators/ledger-validators.test.ts`, add tests for data integrity validators.

Requirements:
1. Import: `import { validateNoOrphanedAmounts, validatePositiveAmounts } from './ledger-validators.js';`

2. Add describe block for validateNoOrphanedAmounts:

Test 1 - Orphaned amount:
```typescript
it('should fail when amount exists without entity', () => {
  const record = createMockRecord({
    debit_entity1: null,
    debit_local_amount1: '100.00',
  });

  const errors = validateNoOrphanedAmounts([record], mockContext);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain('orphaned amount');
});
```

Test 2 - Valid pairing:

```typescript
it('should pass when amounts have entities', () => {
  const record = createMockRecord({
    debit_entity1: 'entity-1',
    debit_local_amount1: '100.00',
    credit_entity1: 'entity-2',
    credit_local_amount1: '100.00',
  });

  const errors = validateNoOrphanedAmounts([record], mockContext);
  expect(errors).toHaveLength(0);
});
```

3. Add describe block for validatePositiveAmounts:

Test 1 - Negative amount:

```typescript
it('should fail for negative amounts', () => {
  const record = createMockRecord({
    debit_local_amount1: '-100.00',
  });

  const errors = validatePositiveAmounts([record], mockContext);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain('negative amount');
});
```

Test 2 - Positive amounts:

```typescript
it('should pass for positive amounts', () => {
  const record = createMockRecord({
    debit_local_amount1: '100.00',
    credit_local_amount1: '100.00',
  });

  const errors = validatePositiveAmounts([record], mockContext);
  expect(errors).toHaveLength(0);
});
```

Return the updated file.
````

**Validation**: Run tests - all should pass.

---

### Step 7.6: Add Tests for Foreign Currency and Dates (FR6, FR7)

**Objective**: Test currency and date validation.

**Complexity**: Medium **Estimated Time**: 30 minutes **Dependencies**: Step 7.5

**Prompt 7.6:**

````text
In `packages/server/src/demo-fixtures/validators/ledger-validators.test.ts`, add tests for foreign currency and date validators.

Requirements:
1. Import: `import { validateForeignCurrency, validateDates } from './ledger-validators.js';`

2. Add describe block for validateForeignCurrency with 3 tests:

Test 1 - Missing foreign amounts:
```typescript
it('should require foreign amounts for non-ILS currency', () => {
  const record = createMockRecord({
    currency: 'USD',
    debit_local_amount1: '350.00',
    debit_foreign_amount1: null,
  });

  const errors = validateForeignCurrency([record], mockContext);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain('no foreign amounts');
});
```

Test 2 - ILS with foreign amounts:

```typescript
it('should reject foreign amounts for ILS currency', () => {
  const record = createMockRecord({
    currency: 'ILS',
    debit_local_amount1: '100.00',
    debit_foreign_amount1: '100.00',
  });

  const errors = validateForeignCurrency([record], mockContext);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain('has foreign amounts');
});
```

Test 3 - Suspicious exchange rate:

```typescript
it('should detect suspicious exchange rates', () => {
  const record = createMockRecord({
    currency: 'USD',
    debit_local_amount1: '1000.00',
    debit_foreign_amount1: '10.00', // Rate = 100
  });

  const errors = validateForeignCurrency([record], mockContext);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain('suspicious exchange rate');
});
```

3. Add describe block for validateDates with 2 tests:

Test 1 - Missing date:

```typescript
it('should fail for missing dates', () => {
  const record = createMockRecord({
    invoice_date: null as any,
  });

  const errors = validateDates([record], mockContext);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain('missing invoice_date');
});
```

Test 2 - Out of range date:

```typescript
it('should fail for dates out of range', () => {
  const record = createMockRecord({
    invoice_date: new Date('1999-01-01'),
  });

  const errors = validateDates([record], mockContext);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors[0]).toContain('out of range');
});
```

Return the updated file.
````

**Validation**: Run tests - all should pass.

---

### Step 7.7: Add Test for Master Validator

**Objective**: Test the integrated validateLedgerRecords function.

**Complexity**: Low **Estimated Time**: 15 minutes **Dependencies**: Step 7.6

**Prompt 7.7:**

````text
In `packages/server/src/demo-fixtures/validators/ledger-validators.test.ts`, add tests for the master validator.

Requirements:
1. Import: `import { validateLedgerRecords } from './ledger-validators.js';`

2. Add describe block with 2 tests:

Test 1 - All validations pass:
```typescript
it('should pass when all validations succeed', () => {
  const record = createMockRecord({
    debit_entity1: 'entity-1',
    debit_local_amount1: '100.00',
    credit_entity1: 'entity-2',
    credit_local_amount1: '100.00',
  });

  const errors = validateLedgerRecords([record], 1, mockContext);
  expect(errors).toHaveLength(0);
});
```

Test 2 - Multiple validation failures:

```typescript
it('should collect errors from multiple validators', () => {
  const record = createMockRecord({
    debit_local_amount1: '100.00',
    credit_local_amount1: '99.00', // Imbalance
    debit_entity1: null, // Orphaned amount
    invoice_date: null as any, // Missing date
  });

  const errors = validateLedgerRecords([record], 1, mockContext);
  expect(errors.length).toBeGreaterThan(1); // Multiple errors
  expect(errors.some(e => e.includes('imbalance'))).toBe(true);
  expect(errors.some(e => e.includes('orphaned'))).toBe(true);
  expect(errors.some(e => e.includes('missing invoice_date'))).toBe(true);
});
```

Return the updated file.
````

**Validation**: Run full test suite - all tests should pass.

---

## Phase 8: Documentation & Finalization

### Step 8.1: Add JSDoc to Main Script

**Objective**: Document the enhanced validation logic.

**Complexity**: Low **Estimated Time**: 15 minutes **Dependencies**: Step 6.2

**Prompt 8.1:**

````text
In `packages/server/src/demo-fixtures/validate-demo-data.ts`, add JSDoc comments to document the enhanced validation.

Requirements:
1. Add file-level JSDoc at the top:
   ```typescript
   /**
    * Demo Data Validation Script
    *
    * Validates the integrity of seeded demo data with comprehensive ledger validation.
    *
    * Validation Checks:
    * - Admin business entity exists
    * - Charge count matches expected
    * - Ledger records for each use-case:
    *   - Per-record internal balance (FR1)
    *   - Aggregate balance (FR2)
    *   - Entity-level balance (FR3)
    *   - No orphaned amounts (FR4)
    *   - Positive amounts only (FR5)
    *   - Foreign currency consistency (FR6)
    *   - Valid dates (FR7)
    *   - Record count matches (FR8)
    *
    * Exit codes:
    * - 0: All validations passed
    * - 1: Validation errors found or database connection failed
    */
```

2. Add JSDoc to validateDemoData function:

   ```typescript
   /**
    * Main validation function - connects to DB and runs all checks
    */
   async function validateDemoData() {
   ```

3. Add inline comment before use-case loop:
   ```typescript
   // 3. Comprehensive ledger validation for all use-cases with expectations (FR9)
   ```

Return the sections with added documentation.
````

**Validation**: JSDoc renders correctly in IDE.

---

### Step 8.2: Create README for Validators

**Objective**: Document the validator module for future developers.

**Complexity**: Low **Estimated Time**: 20 minutes **Dependencies**: All previous steps

**Prompt 8.2:**

```text
Create `packages/server/src/demo-fixtures/validators/README.md` to document the validation system.

Requirements:
Include the following sections:

1. # Ledger Validators - Overview and purpose

2. ## Architecture - File structure and responsibilities

3. ## Validation Rules - List all 10 FRs with brief descriptions

4. ## Usage Example - Show how to use validateLedgerRecords()

5. ## Adding New Validators - Instructions for extending:
   - Create validator function following the pattern
   - Add to master validateLedgerRecords function
   - Write unit tests
   - Update this README

6. ## Testing - How to run tests

7. ## Error Message Format - Explain the standardized format

Use the spec.md as reference but make this more practical/developer-focused.

Return the complete README.md file.
```

**Validation**: README is clear and helpful.

---

### Step 8.3: Add Package.json Script

**Objective**: Create convenient command to run validation.

**Complexity**: Low  
**Estimated Time**: 5 minutes  
**Dependencies**: All previous steps

**Prompt 8.3:**

````text
Add a npm script to `package.json` (workspace root) to run demo data validation easily.

Requirements:
1. Add to the "scripts" section:
   ```json
   "validate:demo": "tsx packages/server/src/demo-fixtures/validate-demo-data.ts"
```

2. Ensure it's placed logically with other demo/test scripts

Return just the scripts section with the new entry added, with context showing neighboring scripts.
````

**Validation**: Run `yarn validate:demo` successfully.

---

## Phase 9: Manual Testing & Verification

### Step 9.1: End-to-End Manual Test

**Objective**: Verify the complete system works with real data.

**Complexity**: Low **Estimated Time**: 10 minutes **Dependencies**: All previous steps

**Manual Test Checklist:**

```bash
# 1. Run unit tests
yarn vitest run packages/server/src/demo-fixtures/validators

# 2. Seed demo data (if not already seeded)
yarn seed:staging-demo

# 3. Run validation (should pass)
yarn validate:demo

# Expected output:
# Validating ledger records for 3 use-case(s)...
#   ✓ monthly-expense-foreign-currency (24 records)
#   ✓ shareholder-dividend (12 records)
#   ✓ client-payment-with-refund (8 records)
#
# ✅ Demo data validation passed

# 4. Test error detection - corrupt a record
psql -d accounter -c "UPDATE accounter_schema.ledger_records SET credit_local_amount1 = '99.00' WHERE debit_local_amount1 = '100.00' LIMIT 1;"

# 5. Run validation again (should fail with specific errors)
yarn validate:demo

# Expected: Exit code 1 with detailed error messages

# 6. Restore data
yarn seed:staging-demo
```

**Success Criteria:**

- ✅ All unit tests pass
- ✅ Validation passes on clean data
- ✅ Validation catches intentional corruption
- ✅ Error messages are clear and actionable

---

## Summary & Execution Order

### Quick Reference

**Total Estimated Time**: ~8-9 hours (including testing and verification)

**Execution Phases:**

1. **Foundation** (Steps 1.1-1.2): 30 min - Type system and utilities
2. **Core Validations** (Steps 2.1-2.4): 2 hours - Critical balance checks
3. **Data Integrity** (Steps 3.1-3.2): 1 hour - Orphaned amounts and negatives
4. **Currency & Dates** (Steps 4.1-4.2): 1.25 hours - Foreign currency and dates
5. **Integration** (Steps 5.1, 6.1-6.2): 1 hour - Wire everything together
6. **Testing** (Steps 7.1-7.7): 2.5 hours - Comprehensive unit tests
7. **Documentation** (Steps 8.1-8.3): 40 min - Docs and convenience scripts
8. **Verification** (Step 9.1): 10 min - Manual testing

### Critical Path

Steps marked P0 must be completed first: 2.1 → 2.2 → 2.3 → 2.4 → 3.1 → 5.1 → 6.1 → 6.2

### Dependencies Graph

```
1.1 (types) → 1.2 (utils) → [2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2] → 5.1 (master) → 6.1 → 6.2
                                                                            ↓
7.1 (test setup) → 7.2 → 7.3 → 7.4 → 7.5 → 7.6 → 7.7                    ↓
                                                                         8.1 → 8.2 → 8.3 → 9.1
```

### Best Practices Implemented

- ✅ Incremental progress - each step builds on previous
- ✅ No orphaned code - every step integrates immediately
- ✅ Small, safe changes - average 20-30 minutes per step
- ✅ Test coverage - comprehensive unit tests for all validators
- ✅ Clear error messages - actionable feedback for developers
- ✅ Type safety - full TypeScript coverage
- ✅ Documentation - JSDoc + README for maintainability

---

## Appendix: Troubleshooting Common Issues

### Issue: Tests Fail After Step X

**Solution**:

1. Check that all previous steps completed successfully
2. Verify imports use `.js` extension (ES modules)
3. Run `yarn tsc --noEmit` to check for type errors

### Issue: Validation Script Times Out

**Solution**:

1. Check database connection in `.env.test`
2. Verify PostgreSQL is running
3. Check that demo data has been seeded

### Issue: Foreign Currency Tests Fail

**Solution**:

1. Verify exchange rate boundaries (0.1 - 10.0) are appropriate
2. Check that test mock data uses valid foreign currency codes
3. Ensure foreign amount fields are populated for USD/EUR records

---

**End of Implementation Blueprint**
