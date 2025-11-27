# Ledger Validation Enhancement Specification

## 1. Overview

**Objective**: Enhance `validate-demo-data.ts` to implement comprehensive double-entry bookkeeping
validation that matches production-level rigor.

**Current State**: Validates only aggregate debit/credit balance across all records for a single
use-case.

**Target State**: Full-spectrum ledger validation covering per-record balance, entity-level
balancing, data integrity, foreign currency handling, and business logic rules.

---

## 2. Requirements

### 2.1 Functional Requirements

#### FR1: Per-Record Internal Balance

- **Rule**: Each ledger record must be internally balanced
- **Formula**:
  `(debit_local_amount1 + debit_local_amount2) == (credit_local_amount1 + credit_local_amount2)`
- **Tolerance**: ±0.01 (accounting rounding)
- **Error Message**: `"{use_case_id} - Record {index}: internal imbalance (debit={X}, credit={Y})"`

#### FR2: Aggregate Balance Validation (EXISTING - KEEP)

- **Rule**: Sum of all debits equals sum of all credits per charge
- **Current implementation is correct** - retain as-is
- **Enhancement**: Apply to ALL use-cases with expectations, not just first one

#### FR3: Entity-Level Balance Validation

- **Rule**: Each financial entity's net position across all records should balance
- **Calculation**: For each entity, `Σ(debits) - Σ(credits)` across all records
- **Expected Result**: Net balance = 0 for most entities (or specific expected value)
- **Error Message**: `"{use_case_id}: Entity {entity_id} unbalanced (net={amount})"`

#### FR4: Orphaned Amount Detection

- **Rules**:
  - If `debit_local_amount1 > 0`, then `debit_entity1` must be NOT NULL
  - If `debit_entity1` is NULL, then `debit_local_amount1` must be NULL (not required for primary)
  - If `debit_entity2` is NULL, then `debit_local_amount2` must be NULL
  - Same rules apply for credit columns
- **Error Message**: `"{use_case_id} - Record {index}: orphaned amount in {column} without entity"`

#### FR5: Positive Amount Validation

- **Rule**: All amount fields must be ≥ 0 (no negative values)
- **Columns to check**:
  - `debit_local_amount1`, `debit_local_amount2`
  - `credit_local_amount1`, `credit_local_amount2`
  - `debit_foreign_amount1`, `debit_foreign_amount2`
  - `credit_foreign_amount1`, `credit_foreign_amount2`
- **Error Message**: `"{use_case_id} - Record {index}: negative amount in {column} ({value})"`

#### FR6: Foreign Currency Validation

- **Rules**:
  - If `currency != 'ILS'` (default local currency), foreign amount fields must be populated
  - Exchange rate consistency: `local_amount / foreign_amount` should be consistent within tolerance
  - If `currency == 'ILS'`, foreign amount fields should be NULL
- **Error Message**:
  `"{use_case_id} - Record {index}: foreign currency mismatch (currency={X}, has_foreign={Y})"`

#### FR7: Date Validation

- **Rules**:
  - `invoice_date` must be present
  - `value_date` must be present
  - Both dates must be valid dates
  - Dates should be within reasonable range (e.g., 2020-2030)
- **Error Message**: `"{use_case_id} - Record {index}: invalid or missing date ({field})"`

#### FR8: Record Count Validation (EXISTING - ENHANCE)

- **Current**: Validates exact count match
- **Enhancement**: Support minimum count validation for cases where ledger generation may create
  additional balancing entries
- **Configuration**: Use-case expectations should specify `minLedgerRecordCount` or
  `exactLedgerRecordCount`

#### FR9: Multi-Use-Case Validation

- **Current**: Only validates first use-case with expectations
- **Required**: Iterate ALL use-cases with expectations
- **Error aggregation**: Continue validation even if one use-case fails

#### FR10: Empty Ledger Detection

- **Rule**: Each record must have non-zero total (debit + credit > 0)
- **Error Message**: `"{use_case_id} - Record {index}: empty record (all amounts zero)"`

### 2.2 Non-Functional Requirements

#### NFR1: Performance

- Validation should complete in < 5 seconds for typical dataset (100 use-cases, 1000 ledger records)
- Use single-pass algorithms where possible

#### NFR2: Error Reporting

- Collect ALL errors before failing (don't fail-fast)
- Group errors by use-case
- Provide actionable error messages with specific record identifiers

#### NFR3: Maintainability

- Reuse existing assertion helpers from `ledger-assertions.ts` where applicable
- Extract validation logic into separate functions
- Add JSDoc comments for each validation function

#### NFR4: Extensibility

- Design validation framework to easily add new validation rules
- Support optional validations that can be toggled via configuration

---

## 3. Architecture

### 3.1 File Structure

```
packages/server/src/demo-fixtures/
├── validate-demo-data.ts           # Main validation script (ENHANCE)
├── validators/                     # New directory
│   ├── ledger-validators.ts       # Core ledger validation functions
│   ├── entity-validators.ts       # Entity-level validation
│   └── types.ts                   # Validation types and interfaces
└── use-cases/
    └── index.ts                    # Use-case registry (EXISTING)
```

### 3.2 Validation Pipeline Architecture

```typescript
// High-level flow
async function validateDemoData() {
  1. Connect to database
  2. Validate admin business exists ✅ (existing)
  3. Validate charge count reconciliation ✅ (existing)
  4. FOR EACH use-case with expectations:
     a. Fetch ledger records for all charges in use-case
     b. Run validation suite (new)
     c. Collect errors
  5. Validate VAT configuration (TODO - future)
  6. Report errors or success
  7. Disconnect from database
}
```

### 3.3 Validator Function Design

Each validator follows this pattern:

```typescript
/**
 * Validates specific ledger rule
 * @param records - Array of ledger records to validate
 * @param context - Validation context (use-case ID, etc.)
 * @returns Array of error messages (empty if valid)
 */
type ValidatorFunction = (records: LedgerRecord[], context: ValidationContext) => string[];
```

### 3.4 Data Model

```typescript
// Ledger record type (from DB query)
interface LedgerRecord {
  id: string;
  charge_id: string;
  owner_id: string | null;

  debit_entity1: string | null;
  debit_local_amount1: string | null; // Numeric as string from pg
  debit_foreign_amount1: string | null;

  debit_entity2: string | null;
  debit_local_amount2: string | null;
  debit_foreign_amount2: string | null;

  credit_entity1: string | null;
  credit_local_amount1: string | null;
  credit_foreign_amount1: string | null;

  credit_entity2: string | null;
  credit_local_amount2: string | null;
  credit_foreign_amount2: string | null;

  currency: string;
  invoice_date: Date;
  value_date: Date;
  description: string | null;
  reference1: string | null;
  locked: boolean;
}

// Validation context
interface ValidationContext {
  useCaseId: string;
  defaultCurrency: string; // 'ILS'
  tolerance: number; // 0.005
}

// Entity balance tracking
interface EntityBalance {
  entityId: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  recordCount: number;
}
```

---

## 4. Implementation Details

### 4.1 New File: `validators/ledger-validators.ts`

```typescript
import type { LedgerRecord, ValidationContext, EntityBalance } from './types.js';

/**
 * Utility: Parse numeric string to number (handles null)
 */
export function parseAmount(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Utility: Check if two numbers are equal within tolerance
 */
export function isBalanced(a: number, b: number, tolerance = 0.005): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * FR1: Validate per-record internal balance
 */
export function validateRecordInternalBalance(
  records: LedgerRecord[],
  context: ValidationContext,
): string[] {
  const errors: string[] = [];

  records.forEach((record, index) => {
    const totalDebit =
      parseAmount(record.debit_local_amount1) + parseAmount(record.debit_local_amount2);

    const totalCredit =
      parseAmount(record.credit_local_amount1) + parseAmount(record.credit_local_amount2);

    if (!isBalanced(totalDebit, totalCredit, context.tolerance)) {
      errors.push(
        `${context.useCaseId} - Record ${index} (${record.id}): internal imbalance ` +
          `(debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)})`,
      );
    }

    // FR10: Empty record detection
    if (totalDebit === 0 && totalCredit === 0) {
      errors.push(
        `${context.useCaseId} - Record ${index} (${record.id}): empty record (all amounts zero)`,
      );
    }
  });

  return errors;
}

/**
 * FR3: Validate entity-level balance
 */
export function validateEntityBalance(
  records: LedgerRecord[],
  context: ValidationContext,
): string[] {
  const errors: string[] = [];
  const entityBalances = new Map<string, EntityBalance>();

  // Accumulate entity balances
  const addToEntity = (entityId: string | null, debit: number, credit: number) => {
    if (!entityId) return;

    const current = entityBalances.get(entityId) || {
      entityId,
      totalDebit: 0,
      totalCredit: 0,
      netBalance: 0,
      recordCount: 0,
    };

    current.totalDebit += debit;
    current.totalCredit += credit;
    current.netBalance = current.totalDebit - current.totalCredit;
    current.recordCount += 1;

    entityBalances.set(entityId, current);
  };

  records.forEach(record => {
    addToEntity(record.debit_entity1, parseAmount(record.debit_local_amount1), 0);
    addToEntity(record.debit_entity2, parseAmount(record.debit_local_amount2), 0);
    addToEntity(record.credit_entity1, 0, parseAmount(record.credit_local_amount1));
    addToEntity(record.credit_entity2, 0, parseAmount(record.credit_local_amount2));
  });

  // Validate each entity balances to zero (within tolerance)
  entityBalances.forEach(balance => {
    if (!isBalanced(balance.netBalance, 0, context.tolerance)) {
      errors.push(
        `${context.useCaseId}: Entity ${balance.entityId} unbalanced ` +
          `(net=${balance.netBalance.toFixed(2)}, debit=${balance.totalDebit.toFixed(2)}, ` +
          `credit=${balance.totalCredit.toFixed(2)}, records=${balance.recordCount})`,
      );
    }
  });

  return errors;
}

/**
 * FR4: Validate no orphaned amounts
 */
export function validateNoOrphanedAmounts(
  records: LedgerRecord[],
  context: ValidationContext,
): string[] {
  const errors: string[] = [];

  records.forEach((record, index) => {
    const checks = [
      // Debit entity 1 (primary - always required to have entity if amount > 0)
      {
        amount: parseAmount(record.debit_local_amount1),
        entity: record.debit_entity1,
        field: 'debit_local_amount1/debit_entity1',
      },
      // Debit entity 2 (secondary - both should be null or both populated)
      {
        amount: parseAmount(record.debit_local_amount2),
        entity: record.debit_entity2,
        field: 'debit_local_amount2/debit_entity2',
      },
      // Credit entity 1 (primary)
      {
        amount: parseAmount(record.credit_local_amount1),
        entity: record.credit_entity1,
        field: 'credit_local_amount1/credit_entity1',
      },
      // Credit entity 2 (secondary)
      {
        amount: parseAmount(record.credit_local_amount2),
        entity: record.credit_entity2,
        field: 'credit_local_amount2/credit_entity2',
      },
    ];

    checks.forEach(({ amount, entity, field }) => {
      if (amount > 0 && !entity) {
        errors.push(
          `${context.useCaseId} - Record ${index} (${record.id}): ` +
            `orphaned amount in ${field} (${amount.toFixed(2)} without entity)`,
        );
      }

      // Secondary fields: if entity is null, amount should also be null
      if (
        field.includes('2') &&
        !entity &&
        record[field.split('/')[0] as keyof LedgerRecord] !== null
      ) {
        errors.push(
          `${context.useCaseId} - Record ${index} (${record.id}): ` +
            `${field} should be null when entity is null`,
        );
      }
    });
  });

  return errors;
}

/**
 * FR5: Validate all amounts are positive
 */
export function validatePositiveAmounts(
  records: LedgerRecord[],
  context: ValidationContext,
): string[] {
  const errors: string[] = [];

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

  records.forEach((record, index) => {
    amountFields.forEach(field => {
      const value = parseAmount(record[field]);
      if (value < 0) {
        errors.push(
          `${context.useCaseId} - Record ${index} (${record.id}): ` +
            `negative amount in ${field} (${value.toFixed(2)})`,
        );
      }
    });
  });

  return errors;
}

/**
 * FR6: Validate foreign currency handling
 */
export function validateForeignCurrency(
  records: LedgerRecord[],
  context: ValidationContext,
): string[] {
  const errors: string[] = [];

  records.forEach((record, index) => {
    const isForeignCurrency = record.currency !== context.defaultCurrency;

    const hasForeignAmounts =
      record.debit_foreign_amount1 !== null ||
      record.debit_foreign_amount2 !== null ||
      record.credit_foreign_amount1 !== null ||
      record.credit_foreign_amount2 !== null;

    // If foreign currency, must have foreign amounts
    if (isForeignCurrency && !hasForeignAmounts) {
      errors.push(
        `${context.useCaseId} - Record ${index} (${record.id}): ` +
          `foreign currency (${record.currency}) but no foreign amounts`,
      );
    }

    // If local currency, should NOT have foreign amounts
    if (!isForeignCurrency && hasForeignAmounts) {
      errors.push(
        `${context.useCaseId} - Record ${index} (${record.id}): ` +
          `local currency (${record.currency}) but has foreign amounts`,
      );
    }

    // Validate exchange rate consistency (if foreign currency)
    if (isForeignCurrency) {
      const checkExchangeRate = (
        localAmount: string | null,
        foreignAmount: string | null,
        field: string,
      ) => {
        if (!localAmount || !foreignAmount) return;

        const local = parseAmount(localAmount);
        const foreign = parseAmount(foreignAmount);

        if (foreign === 0) return; // Avoid division by zero

        const impliedRate = local / foreign;

        // Check if rate is reasonable (between 0.1 and 10.0)
        if (impliedRate < 0.1 || impliedRate > 10.0) {
          errors.push(
            `${context.useCaseId} - Record ${index} (${record.id}): ` +
              `suspicious exchange rate in ${field} (rate=${impliedRate.toFixed(4)})`,
          );
        }
      };

      checkExchangeRate(record.debit_local_amount1, record.debit_foreign_amount1, 'debit1');
      checkExchangeRate(record.debit_local_amount2, record.debit_foreign_amount2, 'debit2');
      checkExchangeRate(record.credit_local_amount1, record.credit_foreign_amount1, 'credit1');
      checkExchangeRate(record.credit_local_amount2, record.credit_foreign_amount2, 'credit2');
    }
  });

  return errors;
}

/**
 * FR7: Validate dates
 */
export function validateDates(records: LedgerRecord[], context: ValidationContext): string[] {
  const errors: string[] = [];
  const minDate = new Date('2020-01-01');
  const maxDate = new Date('2030-12-31');

  records.forEach((record, index) => {
    // Check invoice_date
    if (!record.invoice_date) {
      errors.push(`${context.useCaseId} - Record ${index} (${record.id}): missing invoice_date`);
    } else {
      const invoiceDate = new Date(record.invoice_date);
      if (isNaN(invoiceDate.getTime())) {
        errors.push(`${context.useCaseId} - Record ${index} (${record.id}): invalid invoice_date`);
      } else if (invoiceDate < minDate || invoiceDate > maxDate) {
        errors.push(
          `${context.useCaseId} - Record ${index} (${record.id}): ` +
            `invoice_date out of range (${invoiceDate.toISOString()})`,
        );
      }
    }

    // Check value_date
    if (!record.value_date) {
      errors.push(`${context.useCaseId} - Record ${index} (${record.id}): missing value_date`);
    } else {
      const valueDate = new Date(record.value_date);
      if (isNaN(valueDate.getTime())) {
        errors.push(`${context.useCaseId} - Record ${index} (${record.id}): invalid value_date`);
      } else if (valueDate < minDate || valueDate > maxDate) {
        errors.push(
          `${context.useCaseId} - Record ${index} (${record.id}): ` +
            `value_date out of range (${valueDate.toISOString()})`,
        );
      }
    }
  });

  return errors;
}

/**
 * FR2: Validate aggregate balance (existing logic - refactored)
 */
export function validateAggregateBalance(
  records: LedgerRecord[],
  context: ValidationContext,
): string[] {
  const errors: string[] = [];

  const totalDebit = records.reduce((sum, rec) => {
    return sum + parseAmount(rec.debit_local_amount1) + parseAmount(rec.debit_local_amount2);
  }, 0);

  const totalCredit = records.reduce((sum, rec) => {
    return sum + parseAmount(rec.credit_local_amount1) + parseAmount(rec.credit_local_amount2);
  }, 0);

  if (!isBalanced(totalDebit, totalCredit, context.tolerance)) {
    errors.push(
      `${context.useCaseId}: aggregate ledger not balanced ` +
        `(debit ${totalDebit.toFixed(2)}, credit ${totalCredit.toFixed(2)})`,
    );
  }

  return errors;
}

/**
 * FR8: Validate record count
 */
export function validateRecordCount(
  records: LedgerRecord[],
  expectedCount: number,
  context: ValidationContext,
): string[] {
  const errors: string[] = [];

  if (records.length !== expectedCount) {
    errors.push(
      `${context.useCaseId}: ledger record count mismatch ` +
        `(expected ${expectedCount}, got ${records.length})`,
    );
  }

  return errors;
}

/**
 * Master validation function - runs all validators
 */
export function validateLedgerRecords(
  records: LedgerRecord[],
  expectedRecordCount: number,
  context: ValidationContext,
): string[] {
  const allErrors: string[] = [];

  // Run all validators
  allErrors.push(...validateRecordInternalBalance(records, context));
  allErrors.push(...validateAggregateBalance(records, context));
  allErrors.push(...validateEntityBalance(records, context));
  allErrors.push(...validateNoOrphanedAmounts(records, context));
  allErrors.push(...validatePositiveAmounts(records, context));
  allErrors.push(...validateForeignCurrency(records, context));
  allErrors.push(...validateDates(records, context));
  allErrors.push(...validateRecordCount(records, expectedRecordCount, context));

  return allErrors;
}
```

### 4.2 New File: `validators/types.ts`

```typescript
export interface LedgerRecord {
  id: string;
  charge_id: string;
  owner_id: string | null;

  debit_entity1: string | null;
  debit_local_amount1: string | null;
  debit_foreign_amount1: string | null;

  debit_entity2: string | null;
  debit_local_amount2: string | null;
  debit_foreign_amount2: string | null;

  credit_entity1: string | null;
  credit_local_amount1: string | null;
  credit_foreign_amount1: string | null;

  credit_entity2: string | null;
  credit_local_amount2: string | null;
  credit_foreign_amount2: string | null;

  currency: string;
  invoice_date: Date;
  value_date: Date;
  description: string | null;
  reference1: string | null;
  locked: boolean;
}

export interface ValidationContext {
  useCaseId: string;
  defaultCurrency: string;
  tolerance: number;
}

export interface EntityBalance {
  entityId: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  recordCount: number;
}
```

### 4.3 Modified: `validate-demo-data.ts`

```typescript
import { config } from 'dotenv';
import pg from 'pg';
import { getAllUseCases } from './use-cases/index.js';
import { validateLedgerRecords } from './validators/ledger-validators.js';
import type { LedgerRecord, ValidationContext } from './validators/types.js';

config();

const DEFAULT_CURRENCY = 'ILS';
const BALANCE_TOLERANCE = 0.005;

async function validateDemoData() {
  const client = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB,
    ssl: process.env.POSTGRES_SSL === '1',
  });

  const errors: string[] = [];

  try {
    await client.connect();

    // 1. Admin business exists
    const adminCheck = await client.query(
      `SELECT id FROM accounter_schema.financial_entities WHERE type = 'business' AND name = 'Accounter Admin Business'`,
    );
    if (adminCheck.rows.length === 0) {
      errors.push('Admin business entity missing');
    }

    // 2. Use-case charge count reconciliation
    const useCases = getAllUseCases();
    const expectedChargeCount = useCases.reduce((sum, uc) => sum + uc.fixtures.charges.length, 0);
    const actualChargeCount = await client.query(`SELECT COUNT(*) FROM accounter_schema.charges`);
    if (parseInt(actualChargeCount.rows[0].count) !== expectedChargeCount) {
      errors.push(
        `Charge count mismatch: expected ${expectedChargeCount}, got ${actualChargeCount.rows[0].count}`,
      );
    }

    // 3. Comprehensive ledger validation for all use-cases with expectations
    const useCasesWithExpectations = useCases.filter(uc => uc.expectations);

    console.log(
      `\nValidating ledger records for ${useCasesWithExpectations.length} use-case(s)...`,
    );

    for (const useCase of useCasesWithExpectations) {
      // Get all charges for this use-case
      const chargeIds = useCase.fixtures.charges.map(c => c.id);

      // Fetch all ledger records for these charges
      const ledgerRecords = await client.query<LedgerRecord>(
        `SELECT * FROM accounter_schema.ledger_records WHERE charge_id = ANY($1) ORDER BY created_at`,
        [chargeIds],
      );

      if (ledgerRecords.rows.length === 0) {
        errors.push(`${useCase.id}: no ledger records found`);
        continue;
      }

      // Create validation context
      const context: ValidationContext = {
        useCaseId: useCase.id,
        defaultCurrency: DEFAULT_CURRENCY,
        tolerance: BALANCE_TOLERANCE,
      };

      // Run comprehensive validation
      const validationErrors = validateLedgerRecords(
        ledgerRecords.rows,
        useCase.expectations!.ledgerRecordCount,
        context,
      );

      errors.push(...validationErrors);

      // Log progress
      if (validationErrors.length === 0) {
        console.log(`  ✓ ${useCase.id} (${ledgerRecords.rows.length} records)`);
      } else {
        console.log(`  ✗ ${useCase.id} (${validationErrors.length} error(s))`);
      }
    }

    // 4. VAT row present
    // TODO: Check vat_value table for default percentage

    // Report errors or success
    if (errors.length > 0) {
      console.error('\n❌ Validation failed:');
      errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log('\n✅ Demo data validation passed');
  } catch (error) {
    console.error('❌ Validation error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

validateDemoData();
```

---

## 5. Error Handling Strategy

### 5.1 Error Collection Pattern

- **Never fail-fast**: Collect ALL errors before terminating
- **Continue validation**: If one use-case fails, continue to next
- **Structured errors**: Each error message includes use-case ID, record identifier, and specific
  issue

### 5.2 Error Message Format

```
{use_case_id} - Record {index} ({record_id}): {specific_issue} ({details})
```

Example:

```
monthly-expense-foreign-currency - Record 3 (uuid-123): internal imbalance (debit=100.00, credit=99.98)
```

### 5.3 Error Categories

| Category         | Example                    | Severity |
| ---------------- | -------------------------- | -------- |
| Missing data     | Admin business missing     | CRITICAL |
| Count mismatch   | Expected 10 charges, got 9 | HIGH     |
| Balance error    | Debit != Credit            | CRITICAL |
| Data integrity   | Orphaned amount            | HIGH     |
| Date error       | Invalid date               | MEDIUM   |
| Foreign currency | Missing exchange rate      | HIGH     |

### 5.4 Database Connection Errors

```typescript
try {
  await client.connect();
  // ... validation logic
} catch (error) {
  if (error instanceof pg.DatabaseError) {
    console.error('❌ Database error:', error.message);
    console.error('Check that PostgreSQL is running and credentials are correct');
  } else {
    console.error('❌ Unexpected error:', error);
  }
  process.exit(1);
} finally {
  await client.end(); // Always cleanup
}
```

---

## 6. Testing Plan

### 6.1 Unit Tests for Validators

Create `validators/ledger-validators.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateRecordInternalBalance,
  validateEntityBalance,
  validateNoOrphanedAmounts,
  validatePositiveAmounts,
  validateForeignCurrency,
  validateDates,
} from './ledger-validators.js';
import type { LedgerRecord, ValidationContext } from './types.js';

const mockContext: ValidationContext = {
  useCaseId: 'test-case',
  defaultCurrency: 'ILS',
  tolerance: 0.005,
};

describe('validateRecordInternalBalance', () => {
  it('should pass for balanced record', () => {
    const records: LedgerRecord[] = [
      {
        id: 'rec-1',
        charge_id: 'charge-1',
        owner_id: 'owner-1',
        debit_entity1: 'entity-1',
        debit_local_amount1: '100.00',
        debit_foreign_amount1: null,
        debit_entity2: null,
        debit_local_amount2: null,
        debit_foreign_amount2: null,
        credit_entity1: 'entity-2',
        credit_local_amount1: '100.00',
        credit_foreign_amount1: null,
        credit_entity2: null,
        credit_local_amount2: null,
        credit_foreign_amount2: null,
        currency: 'ILS',
        invoice_date: new Date('2024-01-01'),
        value_date: new Date('2024-01-01'),
        description: 'Test',
        reference1: null,
      },
    ];

    const errors = validateRecordInternalBalance(records, mockContext);
    expect(errors).toHaveLength(0);
  });

  it('should fail for unbalanced record', () => {
    const records: LedgerRecord[] = [
      {
        // ... same as above but credit_local_amount1: '99.00'
        credit_local_amount1: '99.00',
      } as LedgerRecord,
    ];

    const errors = validateRecordInternalBalance(records, mockContext);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('internal imbalance');
  });

  it('should detect empty records', () => {
    const records: LedgerRecord[] = [
      {
        // ... all amounts are null/zero
      } as LedgerRecord,
    ];

    const errors = validateRecordInternalBalance(records, mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('empty record');
  });
});

describe('validateEntityBalance', () => {
  it('should pass when all entities balance to zero', () => {
    const records: LedgerRecord[] = [
      {
        // Record 1: Debit entity-1 $100, Credit entity-2 $100
        debit_entity1: 'entity-1',
        debit_local_amount1: '100.00',
        credit_entity1: 'entity-2',
        credit_local_amount1: '100.00',
      } as LedgerRecord,
      {
        // Record 2: Debit entity-2 $100, Credit entity-1 $100
        // This balances both entities
        debit_entity1: 'entity-2',
        debit_local_amount1: '100.00',
        credit_entity1: 'entity-1',
        credit_local_amount1: '100.00',
      } as LedgerRecord,
    ];

    const errors = validateEntityBalance(records, mockContext);
    expect(errors).toHaveLength(0);
  });

  it('should fail when entity has unbalanced position', () => {
    const records: LedgerRecord[] = [
      {
        // Only one side - entity-1 will be unbalanced
        debit_entity1: 'entity-1',
        debit_local_amount1: '100.00',
        credit_entity1: 'entity-2',
        credit_local_amount1: '100.00',
      } as LedgerRecord,
    ];

    const errors = validateEntityBalance(records, mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('unbalanced');
  });
});

describe('validateNoOrphanedAmounts', () => {
  it('should fail when amount exists without entity', () => {
    const records: LedgerRecord[] = [
      {
        debit_entity1: null, // No entity
        debit_local_amount1: '100.00', // But has amount
      } as LedgerRecord,
    ];

    const errors = validateNoOrphanedAmounts(records, mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('orphaned amount');
  });
});

describe('validatePositiveAmounts', () => {
  it('should fail for negative amounts', () => {
    const records: LedgerRecord[] = [
      {
        debit_local_amount1: '-100.00', // Negative!
      } as LedgerRecord,
    ];

    const errors = validatePositiveAmounts(records, mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('negative amount');
  });
});

describe('validateForeignCurrency', () => {
  it('should require foreign amounts for non-ILS currency', () => {
    const records: LedgerRecord[] = [
      {
        currency: 'USD',
        debit_local_amount1: '350.00',
        debit_foreign_amount1: null, // Missing!
      } as LedgerRecord,
    ];

    const errors = validateForeignCurrency(records, mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('no foreign amounts');
  });

  it('should reject foreign amounts for ILS currency', () => {
    const records: LedgerRecord[] = [
      {
        currency: 'ILS',
        debit_local_amount1: '100.00',
        debit_foreign_amount1: '100.00', // Shouldn't have this!
      } as LedgerRecord,
    ];

    const errors = validateForeignCurrency(records, mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('has foreign amounts');
  });

  it('should detect suspicious exchange rates', () => {
    const records: LedgerRecord[] = [
      {
        currency: 'USD',
        debit_local_amount1: '1000.00',
        debit_foreign_amount1: '10.00', // Rate = 100 (suspicious!)
      } as LedgerRecord,
    ];

    const errors = validateForeignCurrency(records, mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('suspicious exchange rate');
  });
});

describe('validateDates', () => {
  it('should fail for missing dates', () => {
    const records: LedgerRecord[] = [
      {
        invoice_date: null, // Missing
        value_date: new Date('2024-01-01'),
      } as any as LedgerRecord,
    ];

    const errors = validateDates(records, mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('missing invoice_date');
  });

  it('should fail for dates out of range', () => {
    const records: LedgerRecord[] = [
      {
        invoice_date: new Date('1999-01-01'), // Too old
        value_date: new Date('2024-01-01'),
      } as LedgerRecord,
    ];

    const errors = validateDates(records, mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('out of range');
  });
});
```

### 6.2 Integration Test

Create `validate-demo-data.integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestDatabase } from '../__tests__/helpers/test-database.js';
import { execSync } from 'child_process';

describe('Demo Data Validation Integration', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = new TestDatabase();
    await db.connect();
    await db.ensureLatestSchema();

    // Seed demo data
    execSync('tsx scripts/seed-demo-data.ts', {
      env: { ...process.env, NODE_ENV: 'test' },
    });
  });

  afterAll(async () => {
    await db.close();
  });

  it('should pass validation after seeding demo data', () => {
    const result = execSync('tsx packages/server/src/demo-fixtures/validate-demo-data.ts', {
      env: { ...process.env, NODE_ENV: 'test' },
      encoding: 'utf-8',
    });

    expect(result).toContain('✅ Demo data validation passed');
  });
});
```

### 6.3 Manual Testing Checklist

```bash
# 1. Setup test database
yarn db:test:setup

# 2. Seed demo data
yarn seed:demo

# 3. Run validation
tsx packages/server/src/demo-fixtures/validate-demo-data.ts

# Expected output:
# Validating ledger records for 3 use-case(s)...
#   ✓ monthly-expense-foreign-currency (24 records)
#   ✓ shareholder-dividend (12 records)
#   ✓ client-payment-with-refund (8 records)
#
# ✅ Demo data validation passed

# 4. Test error detection (introduce error manually)
# Edit a ledger record in DB to make it unbalanced
psql -d accounter_test -c "UPDATE accounter_schema.ledger_records SET credit_local_amount1 = '99.00' WHERE id = (SELECT id FROM accounter_schema.ledger_records LIMIT 1);"

# 5. Run validation again - should fail
tsx packages/server/src/demo-fixtures/validate-demo-data.ts

# Expected: Multiple errors reported, exit code 1
```

---

## 7. Configuration & Environment

### 7.1 Environment Variables

Use `.env.test` for test environment:

```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=accounter_test
POSTGRES_SSL='0'
DEFAULT_FINANCIAL_ENTITY_ID=00000000-0000-0000-0000-000000000000
```

### 7.2 Default Constants

```typescript
// In validate-demo-data.ts
const DEFAULT_CURRENCY = 'ILS';
const BALANCE_TOLERANCE = 0.005;
const MIN_VALID_DATE = new Date('2020-01-01');
const MAX_VALID_DATE = new Date('2030-12-31');
const MIN_EXCHANGE_RATE = 0.1;
const MAX_EXCHANGE_RATE = 10.0;
```

---

## 8. Future Enhancements

### 8.1 Phase 2 (Optional)

1. **VAT Validation**
   - Validate VAT percentage (17%)
   - Check VAT calculation accuracy
   - Verify VAT account mapping

2. **Performance Optimization**
   - Batch database queries
   - Parallel validation for independent use-cases
   - Progress indicators for large datasets

3. **Configurable Validation**
   - Optional validations via config file
   - Severity levels (error vs warning)
   - Custom tolerance per use-case

4. **Detailed Reporting**
   - Generate JSON report file
   - HTML report with charts
   - Export to CSV for analysis

### 8.2 Integration with CI/CD

```yaml
# .github/workflows/validate-demo-data.yml
name: Validate Demo Data

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: yarn install
      - run: yarn db:test:setup
      - run: yarn seed:demo
      - run: yarn validate:demo
```

---

## 9. Success Criteria

### 9.1 Acceptance Criteria

- [ ] All 10 functional requirements implemented
- [ ] Unit tests achieve >90% coverage for validators
- [ ] Integration test passes with seeded demo data
- [ ] Validation script runs in < 5 seconds for typical dataset
- [ ] Error messages are clear and actionable
- [ ] Code follows existing project patterns and style
- [ ] Documentation updated (README, inline comments)

### 9.2 Definition of Done

- [ ] Code review approved
- [ ] All tests passing in CI
- [ ] Manual testing checklist completed
- [ ] Performance benchmarks met
- [ ] No TypeScript errors
- [ ] No ESLint warnings

---

## 10. Implementation Timeline

| Task                              | Estimated Time | Priority |
| --------------------------------- | -------------- | -------- |
| Create validator types            | 30 min         | P0       |
| Implement FR1 (internal balance)  | 1 hour         | P0       |
| Implement FR2 (aggregate balance) | 30 min         | P0       |
| Implement FR3 (entity balance)    | 2 hours        | P0       |
| Implement FR4 (orphaned amounts)  | 1 hour         | P0       |
| Implement FR5 (positive amounts)  | 30 min         | P1       |
| Implement FR6 (foreign currency)  | 2 hours        | P0       |
| Implement FR7 (dates)             | 1 hour         | P1       |
| Implement FR8 (record count)      | 30 min         | P0       |
| Implement FR9 (multi-use-case)    | 30 min         | P0       |
| Unit tests                        | 3 hours        | P0       |
| Integration test                  | 1 hour         | P1       |
| Documentation                     | 1 hour         | P1       |
| **Total**                         | **~14 hours**  |          |

---

## 11. Developer Quickstart

```bash
# 1. Create new branch
git checkout -b feature/comprehensive-ledger-validation

# 2. Create validator files
mkdir -p packages/server/src/demo-fixtures/validators
touch packages/server/src/demo-fixtures/validators/types.ts
touch packages/server/src/demo-fixtures/validators/ledger-validators.ts
touch packages/server/src/demo-fixtures/validators/ledger-validators.test.ts

# 3. Implement validators (copy from Section 4.1)

# 4. Update validate-demo-data.ts (copy from Section 4.3)

# 5. Run tests
yarn vitest run packages/server/src/demo-fixtures/validators

# 6. Test integration
yarn db:test:setup
yarn seed:demo
tsx packages/server/src/demo-fixtures/validate-demo-data.ts

# 7. Commit and push
git add .
git commit -m "feat: comprehensive ledger validation"
git push origin feature/comprehensive-ledger-validation
```

---

## 12. References

- **Existing code patterns**:
  `packages/server/src/modules/ledger/__tests__/helpers/ledger-assertions.ts`
- **Production validation**: `packages/server/src/modules/ledger/helpers/utils.helper.ts` (lines
  110-230)
- **Database schema**: `packages/migrations/src/actions/2024-01-29T13-15-23.initial.ts` (lines
  1198-1240)
- **Double-entry accounting principles**:
  [Wikipedia](https://en.wikipedia.org/wiki/Double-entry_bookkeeping)

---

**End of Specification**
