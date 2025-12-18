import type { EntityBalance, LedgerRecord, ValidationContext } from './types.js';

/**
 * Parse a numeric amount from a string, handling null/undefined values
 *
 * PostgreSQL returns numeric values as strings when queried via pg driver.
 * This utility safely converts them to numbers for arithmetic operations.
 *
 * @param value - The string value to parse (may be null or undefined)
 * @returns The parsed number, or 0 if value is null/undefined/invalid
 *
 * @example
 * parseAmount('100.50') // 100.50
 * parseAmount(null)     // 0
 * parseAmount('invalid') // 0
 */
export function parseAmount(value: string | null | undefined): number {
  if (value == null) {
    return 0;
  }

  const parsed = parseFloat(value);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

/**
 * Check if two numeric values are balanced within a tolerance
 *
 * Uses tolerance-based comparison to handle floating-point arithmetic
 * imprecision. Two values are considered balanced if their absolute
 * difference is less than or equal to the tolerance.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @param tolerance - Maximum acceptable difference (default: 0.005)
 * @returns True if values are balanced within tolerance, false otherwise
 *
 * @example
 * isBalanced(100, 100)       // true
 * isBalanced(100, 100.004, 0.005) // true
 * isBalanced(100, 102, 0.005)     // false
 */
export function isBalanced(a: number, b: number, tolerance = 0.005): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * Validate per-record internal balance (FR1)
 *
 * Ensures each ledger record is internally balanced according to double-entry
 * bookkeeping principles: total debits must equal total credits within tolerance.
 * Also detects empty records where all amounts are zero.
 *
 * This is a fundamental validation that must pass for every record individually
 * before aggregate-level validations can be meaningful.
 *
 * @param records - Array of ledger records to validate
 * @param context - Validation context containing use-case ID and tolerance
 * @returns Array of error messages (empty if all records are valid)
 *
 * Functional Requirement: FR1 - Per-Record Internal Balance
 * - Rule: (debit_local_amount1 + debit_local_amount2) == (credit_local_amount1 + credit_local_amount2)
 * - Tolerance: Specified in context (typically ±0.005 for accounting rounding)
 * - Also implements FR10: Empty Ledger Detection
 *
 * @example
 * const errors = validateRecordInternalBalance(records, {
 *   useCaseId: 'monthly-expense',
 *   defaultCurrency: 'ILS',
 *   tolerance: 0.005
 * });
 * // Returns: [] if valid, or error messages like:
 * // ["monthly-expense - Record 0 (uuid-123): internal imbalance (debit=100.00, credit=99.98)"]
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

    // FR10: Empty record detection
    if (totalDebit === 0 && totalCredit === 0) {
      errors.push(
        `${context.useCaseId} - Record ${index} (${record.id}): empty record (all amounts zero)`,
      );
      return; // Skip balance check for empty records
    }

    // FR1: Internal balance check
    if (!isBalanced(totalDebit, totalCredit, context.tolerance)) {
      errors.push(
        `${context.useCaseId} - Record ${index} (${record.id}): internal imbalance ` +
          `(debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)})`,
      );
    }
  });

  return errors;
}

/**
 * Validate aggregate balance across all records (FR2)
 *
 * Validates that the sum of all debits equals the sum of all credits across
 * all ledger records for a use-case. This is the second level of validation
 * (after per-record balance) and ensures the entire ledger set balances.
 *
 * This refactors and enhances the existing aggregate balance validation logic
 * that was previously only applied to a single use-case. The new implementation
 * applies to all use-cases with expectations.
 *
 * @param records - Array of ledger records to validate
 * @param context - Validation context containing use-case ID and tolerance
 * @returns Array of error messages (empty if aggregate is balanced)
 *
 * Functional Requirement: FR2 - Aggregate Balance Validation
 * - Rule: Σ(all debits) == Σ(all credits)
 * - Tolerance: Specified in context (typically ±0.005)
 * - Enhancement: Now applies to ALL use-cases, not just first one
 *
 * @example
 * const errors = validateAggregateBalance(records, {
 *   useCaseId: 'monthly-expense',
 *   defaultCurrency: 'ILS',
 *   tolerance: 0.005
 * });
 * // Returns: [] if valid, or error like:
 * // ["monthly-expense: aggregate ledger not balanced (debit 1000.00, credit 999.50)"]
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
 * Validate entity-level balance (FR3)
 *
 * Validates that each financial entity's net position across all ledger records
 * balances to zero (or within tolerance). This is the third level of validation
 * in the hierarchy:
 * 1. Per-record balance (FR1) - each record internally balanced
 * 2. Aggregate balance (FR2) - all records collectively balanced
 * 3. Entity balance (FR3) - each entity's position balanced across records
 *
 * In double-entry bookkeeping, every entity that appears in the ledger should
 * have a net zero position when considering all transactions. If an entity has
 * debits totaling $500 across various records, it should also have credits
 * totaling $500 across those same or other records.
 *
 * @param records - Array of ledger records to validate
 * @param context - Validation context containing use-case ID and tolerance
 * @returns Array of error messages (empty if all entities are balanced)
 *
 * Functional Requirement: FR3 - Entity-Level Balance Validation
 * - Rule: For each entity, Σ(debits) - Σ(credits) ≈ 0
 * - Tolerance: Specified in context (typically ±0.005)
 * - Tracks: debit/credit amounts across all 4 entity fields per record
 *
 * Implementation:
 * - Accumulates debits and credits per entity across all records
 * - Calculates net balance (totalDebit - totalCredit) for each entity
 * - Validates net balance is within tolerance of zero
 *
 * @example
 * const errors = validateEntityBalance(records, {
 *   useCaseId: 'monthly-expense',
 *   defaultCurrency: 'ILS',
 *   tolerance: 0.005
 * });
 * // Returns: [] if valid, or errors like:
 * // ["monthly-expense: Entity entity-123 unbalanced (net=50.00, debit=150.00, credit=100.00, records=3)"]
 */
export function validateEntityBalance(
  records: LedgerRecord[],
  context: ValidationContext,
): string[] {
  const errors: string[] = [];
  const entityBalances = new Map<string, EntityBalance>();

  /**
   * Helper function to accumulate entity balance
   * Adds debit/credit amounts to an entity's running totals
   */
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

  // Accumulate balances for all entities across all records
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
 * Validate ledger record count (FR8)
 *
 * Validates that the actual number of ledger records matches the expected count
 * specified in the use-case expectations. This ensures data completeness and
 * detects cases where records may be missing or extra records were created.
 *
 * This enhances the existing record count validation by applying it to all
 * use-cases systematically rather than ad-hoc checks.
 *
 * @param records - Array of ledger records to validate
 * @param expectedCount - Expected number of ledger records for this use-case
 * @param context - Validation context containing use-case ID
 * @returns Array of error messages (empty if count matches)
 *
 * Functional Requirement: FR8 - Record Count Validation
 * - Rule: Actual record count must match expected count exactly
 * - Enhancement: Future support for minimum count validation for cases
 *   where ledger generation may create additional balancing entries
 *
 * @example
 * const errors = validateRecordCount(records, 24, {
 *   useCaseId: 'monthly-expense',
 *   defaultCurrency: 'ILS',
 *   tolerance: 0.005
 * });
 * // Returns: [] if count matches, or error like:
 * // ["monthly-expense: ledger record count mismatch (expected 24, got 23)"]
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
 * Validate all amounts are positive (FR5)
 *
 * Ensures data integrity by validating that all amount fields contain
 * non-negative values. Negative amounts are not allowed in the ledger
 * system as they violate accounting principles where debits and credits
 * must always be positive or zero.
 *
 * This validation checks all 8 amount fields per record:
 * - Local amounts: debit_local_amount1/2, credit_local_amount1/2
 * - Foreign amounts: debit_foreign_amount1/2, credit_foreign_amount1/2
 *
 * @param records - Array of ledger records to validate
 * @param context - Validation context containing use-case ID
 * @returns Array of error messages (empty if all amounts are non-negative)
 *
 * Functional Requirement: FR5 - Positive Amount Validation
 * - Checks all amount fields for negative values
 * - Reports specific field and value for any negative amounts found
 *
 * @example
 * const errors = validatePositiveAmounts(records, {
 *   useCaseId: 'monthly-expense',
 *   defaultCurrency: 'ILS',
 *   tolerance: 0.005
 * });
 * // Returns: [] if valid, or errors like:
 * // ["monthly-expense - Record 0 (uuid-123): negative amount in debit_local_amount1 (-100.00)"]
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
 * Validate dates (FR7)
 *
 * Ensures all ledger records have valid invoice_date and value_date fields
 * within acceptable ranges. Proper date validation is critical for:
 * - Financial reporting accuracy
 * - Tax compliance and audit trails
 * - Chronological transaction ordering
 * - Preventing data entry errors
 *
 * Validation rules:
 * - Both invoice_date and value_date must be present (not null)
 * - Both dates must be valid Date objects (not NaN)
 * - Both dates must fall within the range 2020-01-01 to 2030-12-31
 *
 * @param records - Array of ledger records to validate
 * @param context - Validation context containing use-case ID
 * @returns Array of error messages (empty if all dates are valid)
 *
 * Functional Requirement: FR7 - Date Validation
 * - Checks for missing dates (null values)
 * - Checks for invalid dates (parse errors)
 * - Checks for dates outside reasonable business range
 *
 * @example
 * const errors = validateDates(records, {
 *   useCaseId: 'monthly-expense',
 *   defaultCurrency: 'ILS',
 *   tolerance: 0.005
 * });
 * // Returns: [] if valid, or errors like:
 * // ["monthly-expense - Record 0 (uuid-123): missing invoice_date"]
 * // ["monthly-expense - Record 1 (uuid-456): invoice_date out of range (1999-01-01T00:00:00.000Z)"]
 */
export function validateDates(records: LedgerRecord[], context: ValidationContext): string[] {
  const errors: string[] = [];
  const minDate = new Date('2020-01-01');
  const maxDate = new Date('2030-12-31');

  records.forEach((record, index) => {
    // Check invoice_date
    if (record.invoice_date) {
      const invoiceDate = new Date(record.invoice_date);
      if (Number.isNaN(invoiceDate.getTime())) {
        errors.push(`${context.useCaseId} - Record ${index} (${record.id}): invalid invoice_date`);
      } else if (invoiceDate < minDate || invoiceDate > maxDate) {
        errors.push(
          `${context.useCaseId} - Record ${index} (${record.id}): ` +
            `invoice_date out of range (${invoiceDate.toISOString()})`,
        );
      }
    } else {
      errors.push(`${context.useCaseId} - Record ${index} (${record.id}): missing invoice_date`);
    }

    // Check value_date
    if (record.value_date) {
      const valueDate = new Date(record.value_date);
      if (Number.isNaN(valueDate.getTime())) {
        errors.push(`${context.useCaseId} - Record ${index} (${record.id}): invalid value_date`);
      } else if (valueDate < minDate || valueDate > maxDate) {
        errors.push(
          `${context.useCaseId} - Record ${index} (${record.id}): ` +
            `value_date out of range (${valueDate.toISOString()})`,
        );
      }
    } else {
      errors.push(`${context.useCaseId} - Record ${index} (${record.id}): missing value_date`);
    }
  });

  return errors;
}

/**
 * Validate foreign currency handling (FR6)
 *
 * Ensures proper handling of foreign currency transactions by validating:
 * 1. Currency field consistency with foreign amount fields
 * 2. Presence of foreign amounts when currency is not the default (ILS)
 * 3. Absence of foreign amounts when currency is the default (ILS)
 * 4. Reasonableness of implied exchange rates between local and foreign amounts
 *
 * Foreign currency validation is critical for:
 * - Accurate financial reporting in multi-currency environments
 * - Compliance with international accounting standards
 * - Detection of data entry errors in currency conversion
 * - Prevention of fraudulent or suspicious exchange rate manipulation
 *
 * Exchange rate validation:
 * - Implied rate = local_amount / foreign_amount
 * - Rate must be between 0.1 and 10.0 to be considered reasonable
 * - Rates outside this range likely indicate data entry errors
 *
 * @param records - Array of ledger records to validate
 * @param context - Validation context containing use-case ID and default currency
 * @returns Array of error messages (empty if all currency handling is valid)
 *
 * Functional Requirement: FR6 - Foreign Currency Validation
 * - Validates currency field matches foreign amount presence/absence
 * - Checks exchange rate consistency within reasonable bounds
 * - Applies to all 4 amount pairs (debit1, debit2, credit1, credit2)
 *
 * @example
 * const errors = validateForeignCurrency(records, {
 *   useCaseId: 'monthly-expense',
 *   defaultCurrency: 'ILS',
 *   tolerance: 0.005
 * });
 * // Returns: [] if valid, or errors like:
 * // ["monthly-expense - Record 0 (uuid-123): foreign currency (USD) but no foreign amounts"]
 * // ["monthly-expense - Record 1 (uuid-456): local currency (ILS) but has foreign amounts"]
 * // ["monthly-expense - Record 2 (uuid-789): suspicious exchange rate in debit1 (rate=15.2000)"]
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

    // Validate currency field consistency with foreign amounts
    if (isForeignCurrency && !hasForeignAmounts) {
      errors.push(
        `${context.useCaseId} - Record ${index} (${record.id}): ` +
          `foreign currency (${record.currency}) but no foreign amounts`,
      );
    }

    if (!isForeignCurrency && hasForeignAmounts) {
      errors.push(
        `${context.useCaseId} - Record ${index} (${record.id}): ` +
          `local currency (${record.currency}) but has foreign amounts`,
      );
    }

    // Validate exchange rate consistency for foreign currency records
    if (isForeignCurrency) {
      /**
       * Helper function to check exchange rate reasonableness
       * @param localAmount - Local currency amount (e.g., ILS)
       * @param foreignAmount - Foreign currency amount (e.g., USD)
       * @param field - Field identifier for error reporting
       */
      const checkExchangeRate = (
        localAmount: string | null,
        foreignAmount: string | null,
        field: string,
      ) => {
        // Skip if either amount is null or zero
        if (!localAmount || !foreignAmount) return;

        const local = parseAmount(localAmount);
        const foreign = parseAmount(foreignAmount);

        if (foreign === 0) return; // Avoid division by zero

        const impliedRate = local / foreign;

        // Check if rate is reasonable (between 0.1 and 10.0)
        // This catches obvious data entry errors like:
        // - Swapped local/foreign amounts (rate would be inverted)
        // - Missing decimal points (e.g., 350 instead of 3.50)
        // - Completely incorrect amounts
        if (impliedRate < 0.1 || impliedRate > 10.0) {
          errors.push(
            `${context.useCaseId} - Record ${index} (${record.id}): ` +
              `suspicious exchange rate in ${field} (rate=${impliedRate.toFixed(4)})`,
          );
        }
      };

      // Check exchange rates for all 4 amount pairs
      checkExchangeRate(record.debit_local_amount1, record.debit_foreign_amount1, 'debit1');
      checkExchangeRate(record.debit_local_amount2, record.debit_foreign_amount2, 'debit2');
      checkExchangeRate(record.credit_local_amount1, record.credit_foreign_amount1, 'credit1');
      checkExchangeRate(record.credit_local_amount2, record.credit_foreign_amount2, 'credit2');
    }
  });

  return errors;
}

/**
 * Validate no orphaned amounts (FR4)
 *
 * Ensures data integrity by validating that every non-zero amount field has
 * a corresponding entity reference. This prevents "orphaned" amounts that
 * cannot be attributed to any financial entity.
 *
 * An "orphaned amount" is a ledger entry where an amount value exists but
 * its corresponding entity field is null. This violates double-entry
 * bookkeeping principles where every amount must be associated with an entity.
 *
 * Rules enforced:
 * - Primary fields (entity1): If amount > 0, entity must be present
 * - Secondary fields (entity2): If entity is null, amount must also be null
 *
 * @param records - Array of ledger records to validate
 * @param context - Validation context containing use-case ID
 * @returns Array of error messages (empty if no orphaned amounts found)
 *
 * Functional Requirement: FR4 - Orphaned Amount Detection
 * - Checks all 4 amount/entity pairs per record
 * - Detects amounts without entities
 * - Detects secondary fields that should be null
 *
 * @example
 * const errors = validateNoOrphanedAmounts(records, {
 *   useCaseId: 'monthly-expense',
 *   defaultCurrency: 'ILS',
 *   tolerance: 0.005
 * });
 * // Returns: [] if valid, or errors like:
 * // ["monthly-expense - Record 0 (uuid-123): orphaned amount in debit_local_amount1/debit_entity1 (100.00 without entity)"]
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
 * Master validation function - runs all validators (FR1-FR10)
 *
 * Orchestrates comprehensive ledger validation by executing all individual
 * validation functions in a logical sequence. This is the main entry point
 * for validating a complete set of ledger records for a use-case.
 *
 * Validation hierarchy:
 * 1. Per-record validation (FR1, FR10) - Each record is internally balanced
 * 2. Aggregate validation (FR2) - Total debits equal total credits
 * 3. Entity validation (FR3) - Each entity's position balances
 * 4. Data integrity (FR4, FR5) - No orphaned amounts, all amounts positive
 * 5. Business rules (FR6, FR7) - Foreign currency and date validation
 * 6. Structural validation (FR8) - Record count matches expectations
 *
 * This function implements NFR2 (Error Reporting): Collects ALL errors before
 * failing (no fail-fast), allowing comprehensive error discovery in a single run.
 *
 * @param records - Array of ledger records to validate
 * @param expectedRecordCount - Expected number of ledger records for this use-case
 * @param context - Validation context containing use-case ID, currency, and tolerance
 * @returns Array of all error messages from all validators (empty if fully valid)
 *
 * Functional Requirements Implemented:
 * - FR1: Per-Record Internal Balance
 * - FR2: Aggregate Balance Validation
 * - FR3: Entity-Level Balance Validation
 * - FR4: Orphaned Amount Detection
 * - FR5: Positive Amount Validation
 * - FR6: Foreign Currency Validation
 * - FR7: Date Validation
 * - FR8: Record Count Validation
 * - FR10: Empty Ledger Detection (within FR1)
 *
 * @example
 * const errors = validateLedgerRecords(records, 24, {
 *   useCaseId: 'monthly-expense',
 *   defaultCurrency: 'ILS',
 *   tolerance: 0.005
 * });
 * if (errors.length > 0) {
 *   console.error('Validation failed:', errors);
 * } else {
 *   console.log('All validations passed');
 * }
 */
export function validateLedgerRecords(
  records: LedgerRecord[],
  expectedRecordCount: number,
  context: ValidationContext,
): string[] {
  const allErrors: string[] = [];

  // Run all validators in logical order
  // Each validator adds its errors to the aggregate array
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
