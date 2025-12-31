import { describe, expect, it } from 'vitest';
import {
  isBalanced,
  parseAmount,
  validateDates,
  validateEntityBalance,
  validateForeignCurrency,
  validateLedgerRecords,
  validateNoOrphanedAmounts,
  validatePositiveAmounts,
  validateRecordInternalBalance,
} from './ledger-validators';
import type { LedgerRecord, ValidationContext } from './types';

const mockContext: ValidationContext = {
  useCaseId: 'test-case',
  defaultCurrency: 'ILS',
  tolerance: 0.005,
};

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
    locked: false,
    ...overrides,
  };
}

describe('parseAmount', () => {
  it('should parse valid number strings', () => {
    expect(parseAmount('100.50')).toBe(100.5);
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

describe('validateRecordInternalBalance', () => {
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

  it('should detect empty records', () => {
    const record = createMockRecord({
      // All amounts null/zero
    });

    const errors = validateRecordInternalBalance([record], mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('empty record');
  });
});

describe('validateEntityBalance', () => {
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
});

describe('validateNoOrphanedAmounts', () => {
  it('should fail when amount exists without entity', () => {
    const record = createMockRecord({
      debit_entity1: null,
      debit_local_amount1: '100.00',
    });

    const errors = validateNoOrphanedAmounts([record], mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('orphaned amount');
  });

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
});

describe('validatePositiveAmounts', () => {
  it('should fail for negative amounts', () => {
    const record = createMockRecord({
      debit_local_amount1: '-100.00',
    });

    const errors = validatePositiveAmounts([record], mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('negative amount');
  });

  it('should pass for positive amounts', () => {
    const record = createMockRecord({
      debit_local_amount1: '100.00',
      credit_local_amount1: '100.00',
    });

    const errors = validatePositiveAmounts([record], mockContext);
    expect(errors).toHaveLength(0);
  });
});

describe('validateForeignCurrency', () => {
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
});

describe('validateDates', () => {
  it('should fail for missing dates', () => {
    const record = createMockRecord({
      invoice_date: null as unknown as Date,
    });

    const errors = validateDates([record], mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('missing invoice_date');
  });

  it('should fail for dates out of range', () => {
    const record = createMockRecord({
      invoice_date: new Date('1999-01-01'),
    });

    const errors = validateDates([record], mockContext);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('out of range');
  });
});

describe('validateLedgerRecords', () => {
  it('should pass when all validations succeed', () => {
    // Create two records that balance entities:
    // Record 1: entity-1 debits 100, entity-2 credits 100
    // Record 2: entity-1 credits 100, entity-2 debits 100
    // This ensures each entity has equal debits and credits
    const record1 = createMockRecord({
      debit_entity1: 'entity-1',
      debit_local_amount1: '100.00',
      credit_entity1: 'entity-2',
      credit_local_amount1: '100.00',
    });

    const record2 = createMockRecord({
      debit_entity1: 'entity-2',
      debit_local_amount1: '100.00',
      credit_entity1: 'entity-1',
      credit_local_amount1: '100.00',
    });

    const errors = validateLedgerRecords([record1, record2], 2, mockContext);
    expect(errors).toHaveLength(0);
  });

  it('should collect errors from multiple validators', () => {
    const record = createMockRecord({
      debit_local_amount1: '100.00',
      credit_local_amount1: '99.00', // Imbalance
      debit_entity1: null, // Orphaned amount
      invoice_date: null as unknown as Date, // Missing date
    });

    const errors = validateLedgerRecords([record], 1, mockContext);
    expect(errors.length).toBeGreaterThan(1); // Multiple errors
    expect(errors.some(e => e.includes('imbalance'))).toBe(true);
    expect(errors.some(e => e.includes('orphaned'))).toBe(true);
    expect(errors.some(e => e.includes('missing invoice_date'))).toBe(true);
  });
});
