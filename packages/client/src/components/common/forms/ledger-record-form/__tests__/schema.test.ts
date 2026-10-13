import { describe, expect, it } from 'vitest';
import { Currency, LedgerRecordOperation } from '../../../../../gql/graphql.js';
import {
  buildLedgerRecordFormSchema,
  formValuesToLedgerRecordInput,
  LEDGER_BALANCE_TOLERANCE,
  type LedgerRecordFormInput,
} from '../schema.js';

const DEBIT_ENTITY = '11111111-1111-4111-8111-111111111111';
const CREDIT_ENTITY = '22222222-2222-4222-8222-222222222222';

function validValues(overrides: LedgerRecordFormInput = {}): LedgerRecordFormInput {
  return {
    operation: LedgerRecordOperation.MiscExpense,
    currency: Currency.Ils,
    invoiceDate: '2026-03-15',
    valueDate: '2026-03-16',
    description: 'Office supplies',
    reference: 'REF-1',
    debitEntity1: DEBIT_ENTITY,
    debitLocalAmount1: 100,
    creditEntity1: CREDIT_ENTITY,
    creditLocalAmount1: 100,
    ...overrides,
  };
}

const insertSchema = buildLedgerRecordFormSchema({
  mode: 'insert',
  localCurrency: Currency.Ils,
  ledgerLock: null,
});

function issuePaths(result: ReturnType<typeof insertSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map(issue => issue.path.join('.'));
}

describe('buildLedgerRecordFormSchema', () => {
  it('accepts a minimal valid record', () => {
    const result = insertSchema.safeParse(
      validValues({ description: undefined, reference: undefined }),
    );
    expect(result.success).toBe(true);
  });

  describe('operation', () => {
    it('is required in insert mode', () => {
      const result = insertSchema.safeParse(validValues({ operation: undefined }));
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain('operation');
    });

    it('rejects a value outside LedgerRecordOperation', () => {
      const result = insertSchema.safeParse({ ...validValues(), operation: 'TRANSACTION' });
      expect(issuePaths(result)).toContain('operation');
    });

    it('is ignored in edit mode', () => {
      const editSchema = buildLedgerRecordFormSchema({
        mode: 'edit',
        localCurrency: Currency.Ils,
        ledgerLock: null,
      });
      const missing = editSchema.safeParse(validValues({ operation: undefined }));
      expect(missing.success).toBe(true);

      const given = editSchema.safeParse(validValues());
      expect(given.success).toBe(true);
      expect(given.data && 'operation' in given.data).toBe(false);
    });
  });

  describe('required fields', () => {
    it.each(['debitEntity1', 'creditEntity1'] as const)('requires %s', field => {
      const result = insertSchema.safeParse(validValues({ [field]: '' }));
      expect(issuePaths(result)).toContain(field);
    });

    it.each(['debitLocalAmount1', 'creditLocalAmount1'] as const)('requires %s', field => {
      const result = insertSchema.safeParse({ ...validValues(), [field]: undefined });
      expect(issuePaths(result)).toContain(field);
    });

    it.each(['invoiceDate', 'valueDate'] as const)('requires a yyyy-mm-dd %s', field => {
      expect(issuePaths(insertSchema.safeParse({ ...validValues(), [field]: undefined }))).toContain(
        field,
      );
      expect(issuePaths(insertSchema.safeParse(validValues({ [field]: '15/03/2026' })))).toContain(
        field,
      );
    });
  });

  describe('amounts', () => {
    it.each([0, -5])('rejects a debit amount of %s', amount => {
      const result = insertSchema.safeParse(
        validValues({ debitLocalAmount1: amount, creditLocalAmount1: amount }),
      );
      expect(issuePaths(result)).toEqual(
        expect.arrayContaining(['debitLocalAmount1', 'creditLocalAmount1']),
      );
    });
  });

  describe('lock date', () => {
    const lockedSchema = buildLedgerRecordFormSchema({
      mode: 'insert',
      localCurrency: Currency.Ils,
      ledgerLock: '2026-03-15',
    });

    it.each(['invoiceDate', 'valueDate'] as const)('rejects a %s equal to the lock', field => {
      const result = lockedSchema.safeParse(
        validValues({ invoiceDate: '2026-03-20', valueDate: '2026-03-20', [field]: '2026-03-15' }),
      );
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toEqual([field]);
      expect(result.error?.issues[0].message).toBe('Date must be after 2026-03-15');
    });

    it('rejects a date before the lock', () => {
      const result = lockedSchema.safeParse(validValues({ invoiceDate: '2026-01-01' }));
      expect(issuePaths(result)).toContain('invoiceDate');
    });

    it('accepts the day after the lock', () => {
      const result = lockedSchema.safeParse(
        validValues({ invoiceDate: '2026-03-16', valueDate: '2026-03-16' }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts any date when no lock is set', () => {
      const result = insertSchema.safeParse(
        validValues({ invoiceDate: '1999-01-01', valueDate: '1999-01-01' }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('balance', () => {
    it('rejects an unbalanced record on the "balance" path', () => {
      const result = insertSchema.safeParse(
        validValues({ debitLocalAmount1: 100, creditLocalAmount1: 99 }),
      );
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toEqual(['balance']);
      expect(result.error?.issues[0].message).toBe(
        'Debit and credit totals must be equal (debit 100, credit 99)',
      );
    });

    it('accepts a difference of exactly the tolerance', () => {
      expect(LEDGER_BALANCE_TOLERANCE).toBe(0.005);
      const result = insertSchema.safeParse(
        validValues({ debitLocalAmount1: 100.005, creditLocalAmount1: 100 }),
      );
      expect(result.success).toBe(true);
    });

    it('rejects a difference just above the tolerance', () => {
      const result = insertSchema.safeParse(
        validValues({ debitLocalAmount1: 100.0051, creditLocalAmount1: 100 }),
      );
      expect(issuePaths(result)).toEqual(['balance']);
    });
  });

  describe('currency', () => {
    it('is required', () => {
      const result = insertSchema.safeParse({ ...validValues(), currency: undefined });
      expect(issuePaths(result)).toContain('currency');
    });

    it('rejects a value outside Currency', () => {
      const result = insertSchema.safeParse({ ...validValues(), currency: 'XYZ' });
      expect(issuePaths(result)).toContain('currency');
    });

    describe('local currency', () => {
      it('does not require foreign amounts', () => {
        const result = insertSchema.safeParse(validValues());
        expect(result.success).toBe(true);
      });

      it('ignores leftover foreign amounts, even invalid ones', () => {
        const result = insertSchema.safeParse(
          validValues({ debitForeignAmount1: -3, creditForeignAmount1: 0 }),
        );
        expect(result.success).toBe(true);
      });
    });

    describe('foreign currency', () => {
      const foreign = (overrides: LedgerRecordFormInput = {}): LedgerRecordFormInput =>
        validValues({
          currency: Currency.Usd,
          debitForeignAmount1: 27,
          creditForeignAmount1: 27,
          ...overrides,
        });

      it('accepts positive foreign amounts on both main lines', () => {
        const result = insertSchema.safeParse(foreign());
        expect(result.success).toBe(true);
      });

      it('requires both foreign amounts', () => {
        const result = insertSchema.safeParse(
          foreign({ debitForeignAmount1: undefined, creditForeignAmount1: undefined }),
        );
        expect(result.success).toBe(false);
        expect(issuePaths(result).sort()).toEqual(['creditForeignAmount1', 'debitForeignAmount1']);
        expect(result.error?.issues[0].message).toBe('Foreign amount is required for USD records');
      });

      it.each([0, -5])('rejects a foreign amount of %s', amount => {
        const result = insertSchema.safeParse(foreign({ creditForeignAmount1: amount }));
        expect(issuePaths(result)).toEqual(['creditForeignAmount1']);
        expect(result.error?.issues[0].message).toBe('Foreign amount must be greater than 0');
      });

      it('reports missing foreign amounts together with other field errors', () => {
        const result = insertSchema.safeParse({
          ...foreign({ debitEntity1: '', debitForeignAmount1: undefined }),
          creditLocalAmount1: undefined,
          valueDate: undefined,
        });
        expect(issuePaths(result)).toEqual(
          expect.arrayContaining([
            'debitEntity1',
            'creditLocalAmount1',
            'valueDate',
            'debitForeignAmount1',
          ]),
        );
      });

      it('treats the local currency as configured, not as ILS', () => {
        const usdLocalSchema = buildLedgerRecordFormSchema({
          mode: 'insert',
          localCurrency: Currency.Usd,
          ledgerLock: null,
        });
        // USD is local here, so no foreign amounts are needed
        expect(usdLocalSchema.safeParse(validValues({ currency: Currency.Usd })).success).toBe(
          true,
        );
        // ...while ILS is now foreign and needs them
        expect(issuePaths(usdLocalSchema.safeParse(validValues()))).toEqual(
          expect.arrayContaining(['debitForeignAmount1', 'creditForeignAmount1']),
        );
      });
    });
  });
});

describe('formValuesToLedgerRecordInput', () => {
  const toInput = (values: LedgerRecordFormInput) =>
    formValuesToLedgerRecordInput(insertSchema.parse(values), { localCurrency: Currency.Ils });

  it('sends the local currency, slot-1 values, and nulls for slot 2 and foreign amounts', () => {
    expect(toInput(validValues())).toEqual({
      debitEntity1: DEBIT_ENTITY,
      debitLocalAmount1: 100,
      debitForeignAmount1: null,
      creditEntity1: CREDIT_ENTITY,
      creditLocalAmount1: 100,
      creditForeignAmount1: null,
      debitEntity2: null,
      debitLocalAmount2: null,
      debitForeignAmount2: null,
      creditEntity2: null,
      creditLocalAmount2: null,
      creditForeignAmount2: null,
      currency: Currency.Ils,
      invoiceDate: '2026-03-15',
      valueDate: '2026-03-16',
      description: 'Office supplies',
      reference: 'REF-1',
    });
  });

  it('drops leftover foreign amounts for the local currency', () => {
    const input = toInput(validValues({ debitForeignAmount1: 27, creditForeignAmount1: 27 }));
    expect(input.currency).toBe(Currency.Ils);
    expect(input.debitForeignAmount1).toBeNull();
    expect(input.creditForeignAmount1).toBeNull();
  });

  it('sends the chosen foreign currency with its foreign amounts', () => {
    const input = toInput(
      validValues({ currency: Currency.Eur, debitForeignAmount1: 25, creditForeignAmount1: 25.5 }),
    );
    expect(input).toEqual(
      expect.objectContaining({
        currency: Currency.Eur,
        debitLocalAmount1: 100,
        debitForeignAmount1: 25,
        creditLocalAmount1: 100,
        creditForeignAmount1: 25.5,
        debitForeignAmount2: null,
        creditForeignAmount2: null,
      }),
    );
  });

  it('decides "local" by the given local currency, not by ILS', () => {
    const values = insertSchema.parse(
      validValues({ currency: Currency.Ils, debitForeignAmount1: 27, creditForeignAmount1: 27 }),
    );
    // ILS is foreign when USD is the local currency, so its foreign amounts are kept
    const input = formValuesToLedgerRecordInput(values, { localCurrency: Currency.Usd });
    expect(input.currency).toBe(Currency.Ils);
    expect(input.debitForeignAmount1).toBe(27);
    expect(input.creditForeignAmount1).toBe(27);
  });

  it('maps empty optional strings to null', () => {
    const input = toInput(validValues({ description: '', reference: '  ' }));
    expect(input.description).toBeNull();
    expect(input.reference).toBeNull();
  });

  it('does not send the operation', () => {
    expect(toInput(validValues())).not.toHaveProperty('operation');
  });
});
