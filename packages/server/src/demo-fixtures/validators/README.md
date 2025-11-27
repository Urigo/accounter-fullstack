# Ledger Validators - Overview and purpose

This module provides a practical, production-like validation system for double-entry ledger data
seeded as part of the demo fixtures. It verifies that generated ledger records are coherent,
balanced, and conform to business and data integrity rules.

The main entry point is `validateLedgerRecords(records, expectedRecordCount, context)` which runs
all validations (FR1–FR10) and returns an array of human-readable error messages. An empty array
means the ledger data passed validation.

## Architecture - File structure and responsibilities

```
packages/server/src/demo-fixtures/
├── validate-demo-data.ts                # Script that connects to DB and runs validation per use-case
└── validators/
    ├── ledger-validators.ts             # Core validators (FR1–FR10) + small utilities
    └── types.ts                         # Shared types: LedgerRecord, ValidationContext, EntityBalance
```

- `validate-demo-data.ts`
  - Queries demo DB for ledger records per use-case
  - Builds a `ValidationContext`
  - Calls `validateLedgerRecords(...)` and reports results
- `validators/ledger-validators.ts`
  - Contains all rule validators and a master function to run them all
  - Utilities: `parseAmount`, `isBalanced`
- `validators/types.ts`
  - Shared TypeScript interfaces used across validators

## Validation Rules

All validators return `string[]` of error messages. No errors = rule passed.

1. FR1: Per-Record Internal Balance
   - Debit total equals credit total per record within tolerance.
   - Formula: `(debit1 + debit2) == (credit1 + credit2)`.
   - Error: `{use_case_id} - Record {i} ({record_id}): internal imbalance (debit={X}, credit={Y})`.

2. FR2: Aggregate Balance Validation
   - Total debits equal total credits across all records in the set.
   - Error: `{use_case_id}: aggregate ledger not balanced (debit X, credit Y)`.

3. FR3: Entity-Level Balance Validation
   - Each entity’s net position across all records must balance to ~0.
   - Error: `{use_case_id}: Entity {entity_id} unbalanced (net={amount})`.

4. FR4: Orphaned Amount Detection
   - Amount columns must have a corresponding entity; secondary pairs should be both null or both
     set.
   - Error: `{use_case_id} - Record {i} ({record_id}): orphaned amount in {column} ...`.

5. FR5: Positive Amount Validation
   - All amount fields must be `≥ 0`.
   - Error: `{use_case_id} - Record {i} ({record_id}): negative amount in {column} ({value})`.

6. FR6: Foreign Currency Validation
   - Non-ILS currency requires foreign amounts; ILS must not have foreign amounts; basic FX sanity
     check.
   - Error examples:
     - `foreign currency (...) but no foreign amounts`
     - `local currency (...) but has foreign amounts`
     - `suspicious exchange rate in {field} (rate=...)`

7. FR7: Date Validation
   - `invoice_date` and `value_date` required, valid, and within range (2020–2030).
   - Error examples: `missing invoice_date`, `invalid value_date`,
     `invoice_date out of range (...)`.

8. FR8: Record Count Validation
   - Validates record count against the expected count for the use-case.
   - Error: `{use_case_id}: ledger record count mismatch (expected X, got Y)`.

9. FR9: Multi-Use-Case Validation
   - Run validations for all use-cases with expectations; aggregate all errors.

10. FR10: Empty Ledger Detection
    - Each record must have a non-zero total (debit + credit > 0).
    - Error: `{use_case_id} - Record {i} ({record_id}): empty record (all amounts zero)`.

## Usage Example

```ts
import { validateLedgerRecords } from './validators/ledger-validators.js';
import type { LedgerRecord, ValidationContext } from './validators/types.js';

const context: ValidationContext = {
  useCaseId: 'example-use-case',
  defaultCurrency: 'ILS',
  tolerance: 0.005,
};

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
    invoice_date: new Date('2024-01-01') as any,
    value_date: new Date('2024-01-01') as any,
    description: 'Demo',
    reference1: null,
    locked: false,
  },
];

const expectedRecordCount = 1;
const errors = validateLedgerRecords(records, expectedRecordCount, context);

if (errors.length === 0) {
  console.log('✅ Ledger valid');
} else {
  console.error('❌ Validation failed:', errors);
}
```

## Adding New Validators

- Create a validator function following the existing pattern:

```ts
/**
 * Validates specific rule X
 */
export function validateRuleX(records: LedgerRecord[], context: ValidationContext): string[] {
  const errors: string[] = [];
  // ... push error strings when violations are found
  return errors;
}
```

- Add your validator to the master function order in `validateLedgerRecords(...)`.
- Write unit tests in `validators/ledger-validators.test.ts` (positive + negative cases).
- Update this README (Rules list, examples if helpful).

## Testing

Run just the validators tests:

```bash
yarn vitest run packages/server/src/demo-fixtures/validators
```

Run the whole test suite:

```bash
yarn test
```

Optionally run the demo validation script end-to-end (requires DB + seeded data):

```bash
# Setup and seed (example commands may vary by project scripts)
yarn db:test:setup
yarn seed:demo

# Run validation
tsx packages/server/src/demo-fixtures/validate-demo-data.ts
```

## Error Message Format

All errors follow a standardized, actionable format so you can quickly locate the problem:

```
{use_case_id} - Record {index} ({record_id}): {specific_issue} ({details})
```

- `use_case_id`: Which scenario/use-case produced the record(s)
- `index`: Zero-based index within the current record set
- `record_id`: The specific ledger record ID for pinpointing in DB/logs
- `specific_issue`: Human-readable summary (e.g., "internal imbalance")
- `details`: Helpful numeric context (e.g., debit/credit totals, rates, fields)
