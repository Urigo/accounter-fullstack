import { describe, expect, it } from 'vitest';
import type { LedgerRecordInput } from '../../../../__generated__/types.js';
import { TEST_TIMEZONES, useTimezone } from '../../../../__tests__/helpers/timezones.js';
import { Currency, DocumentType } from '../../../../shared/enums.js';
import { dateToTimelessDateString } from '../../../../shared/helpers/misc.js';
import {
  deriveDocumentFromLedgerInput,
  deriveMiscExpenseFromLedgerInput,
  deriveNewChargeFromLedgerInput,
  LEDGER_BALANCE_TOLERANCE,
  ledgerRecordInputToParams,
  validateManualLedgerRecord,
} from '../manual-ledger-record.helper.js';

/* All IDs, amounts and dates below are made up. */

const MINIMAL_INPUT: LedgerRecordInput = {
  debitEntity1: 'debit-entity-1',
  debitLocalAmount1: 100,
  creditEntity1: 'credit-entity-1',
  creditLocalAmount1: 100,
  currency: Currency.Ils,
  invoiceDate: '2025-03-12',
  valueDate: '2025-03-14',
};

describe('ledgerRecordInputToParams', () => {
  it('maps every input field to its column param', () => {
    const params = ledgerRecordInputToParams({
      debitEntity1: 'debit-entity-1',
      debitLocalAmount1: 370,
      debitForeignAmount1: 100,
      creditEntity1: 'credit-entity-1',
      creditLocalAmount1: 314,
      creditForeignAmount1: 85,
      debitEntity2: 'debit-entity-2',
      debitLocalAmount2: 0.5,
      debitForeignAmount2: 0.1,
      creditEntity2: 'credit-entity-2',
      creditLocalAmount2: 56.5,
      creditForeignAmount2: 15.1,
      currency: Currency.Usd,
      invoiceDate: '2025-03-12',
      valueDate: '2025-03-14',
      description: 'Manual record',
      reference: 'REF-1',
    });

    expect(params).toEqual({
      debitEntity1: 'debit-entity-1',
      debitLocalAmount1: 370,
      debitForeignAmount1: 100,
      creditEntity1: 'credit-entity-1',
      creditLocalAmount1: 314,
      creditForeignAmount1: 85,
      debitEntity2: 'debit-entity-2',
      debitLocalAmount2: 0.5,
      debitForeignAmount2: 0.1,
      creditEntity2: 'credit-entity-2',
      creditLocalAmount2: 56.5,
      creditForeignAmount2: 15.1,
      currency: Currency.Usd,
      invoiceDate: '2025-03-12',
      valueDate: '2025-03-14',
      description: 'Manual record',
      reference: 'REF-1',
    });
  });

  it('turns absent optional fields into null, so an update clears them', () => {
    const params = ledgerRecordInputToParams(MINIMAL_INPUT);

    expect(params).toEqual({
      debitEntity1: 'debit-entity-1',
      debitLocalAmount1: 100,
      debitForeignAmount1: null,
      creditEntity1: 'credit-entity-1',
      creditLocalAmount1: 100,
      creditForeignAmount1: null,
      debitEntity2: null,
      debitLocalAmount2: null,
      debitForeignAmount2: null,
      creditEntity2: null,
      creditLocalAmount2: null,
      creditForeignAmount2: null,
      currency: Currency.Ils,
      invoiceDate: '2025-03-12',
      valueDate: '2025-03-14',
      description: null,
      reference: null,
    });
  });

  it('turns explicit null optional fields into null', () => {
    const params = ledgerRecordInputToParams({
      ...MINIMAL_INPUT,
      debitForeignAmount1: null,
      creditEntity2: null,
      creditLocalAmount2: null,
      description: null,
      reference: null,
    });

    expect(params.debitForeignAmount1).toBeNull();
    expect(params.creditEntity2).toBeNull();
    expect(params.creditLocalAmount2).toBeNull();
    expect(params.description).toBeNull();
    expect(params.reference).toBeNull();
  });

  it('does not set the charge, owner or lock of the record', () => {
    const params = ledgerRecordInputToParams(MINIMAL_INPUT);

    expect(params).not.toHaveProperty('chargeId');
    expect(params).not.toHaveProperty('ownerId');
    expect(params).not.toHaveProperty('locked');
  });
});

describe('validateManualLedgerRecord', () => {
  const LOCAL = { localCurrency: Currency.Ils };

  it('accepts a minimal balanced local-currency record', () => {
    expect(validateManualLedgerRecord(MINIMAL_INPUT, LOCAL)).toEqual([]);
  });

  it('uses a balance tolerance of half an agora', () => {
    expect(LEDGER_BALANCE_TOLERANCE).toBe(0.005);
  });

  describe('slot rules', () => {
    it.each<[string, Partial<LedgerRecordInput>, string[]]>([
      [
        'zero slot-1 amounts',
        { debitLocalAmount1: 0, creditLocalAmount1: 0 },
        ['Debit 1: amount must be greater than 0', 'Credit 1: amount must be greater than 0'],
      ],
      [
        'negative slot-1 amounts',
        { debitLocalAmount1: -100, creditLocalAmount1: -100 },
        ['Debit 1: amount must be greater than 0', 'Credit 1: amount must be greater than 0'],
      ],
      [
        'a debit 2 entity without an amount',
        { debitEntity2: 'debit-entity-2' },
        ['Debit 2: amount is required'],
      ],
      [
        'a credit 2 entity with a zero amount',
        { creditEntity2: 'credit-entity-2', creditLocalAmount2: 0 },
        ['Credit 2: amount must be greater than 0'],
      ],
      [
        'a debit 2 entity with a negative amount',
        { debitEntity2: 'debit-entity-2', debitLocalAmount2: -17, creditLocalAmount1: 83 },
        ['Debit 2: amount must be greater than 0'],
      ],
      [
        'a debit 2 amount without an entity',
        { debitLocalAmount2: 17, creditLocalAmount1: 117 },
        ['Debit 2: an entity is required when an amount is entered'],
      ],
      [
        'a credit 2 amount without an entity',
        { creditLocalAmount2: 17, debitLocalAmount1: 117 },
        ['Credit 2: an entity is required when an amount is entered'],
      ],
    ])('rejects %s', (_, overrides, errors) => {
      expect(validateManualLedgerRecord({ ...MINIMAL_INPUT, ...overrides }, LOCAL)).toEqual(errors);
    });

    it('accepts a filled second slot on both sides', () => {
      expect(
        validateManualLedgerRecord(
          {
            ...MINIMAL_INPUT,
            debitEntity2: 'debit-entity-2',
            debitLocalAmount2: 17,
            creditEntity2: 'credit-entity-2',
            creditLocalAmount2: 17,
          },
          LOCAL,
        ),
      ).toEqual([]);
    });

    it('accepts explicit nulls in an empty second slot', () => {
      expect(
        validateManualLedgerRecord(
          {
            ...MINIMAL_INPUT,
            debitEntity2: null,
            debitLocalAmount2: null,
            debitForeignAmount2: null,
          },
          LOCAL,
        ),
      ).toEqual([]);
    });
  });

  describe('currency rules', () => {
    const FOREIGN_INPUT: LedgerRecordInput = {
      ...MINIMAL_INPUT,
      currency: Currency.Usd,
      debitLocalAmount1: 370,
      debitForeignAmount1: 100,
      creditLocalAmount1: 370,
      creditForeignAmount1: 100,
    };

    it('accepts a foreign-currency record with a foreign amount on every filled slot', () => {
      expect(validateManualLedgerRecord(FOREIGN_INPUT, LOCAL)).toEqual([]);
    });

    it.each<[string, Partial<LedgerRecordInput>, string[]]>([
      [
        'a missing foreign amount',
        { debitForeignAmount1: null },
        ['Debit 1: foreign amount is required for USD records'],
      ],
      [
        'a zero foreign amount',
        { creditForeignAmount1: 0 },
        ['Credit 1: foreign amount must be greater than 0'],
      ],
      [
        'a negative foreign amount',
        { creditForeignAmount1: -100 },
        ['Credit 1: foreign amount must be greater than 0'],
      ],
      [
        'a filled second slot without a foreign amount',
        {
          debitEntity2: 'debit-entity-2',
          debitLocalAmount2: 37,
          creditLocalAmount1: 407,
          creditForeignAmount1: 110,
        },
        ['Debit 2: foreign amount is required for USD records'],
      ],
      [
        'a foreign amount without an entity',
        { creditForeignAmount2: 10 },
        ['Credit 2: an entity is required when an amount is entered'],
      ],
    ])('rejects a foreign-currency record with %s', (_, overrides, errors) => {
      expect(validateManualLedgerRecord({ ...FOREIGN_INPUT, ...overrides }, LOCAL)).toEqual(
        errors,
      );
    });

    it.each<[string, Partial<LedgerRecordInput>, string[]]>([
      [
        'a foreign amount on debit 1',
        { debitForeignAmount1: 30 },
        ['Debit 1: foreign amount is not allowed for ILS records'],
      ],
      [
        'a zero foreign amount on credit 1',
        { creditForeignAmount1: 0 },
        ['Credit 1: foreign amount is not allowed for ILS records'],
      ],
      [
        'a foreign amount on a filled second slot',
        {
          creditEntity2: 'credit-entity-2',
          creditLocalAmount2: 17,
          creditForeignAmount2: 5,
          debitLocalAmount1: 117,
        },
        ['Credit 2: foreign amount is not allowed for ILS records'],
      ],
    ])('rejects a local-currency record with %s', (_, overrides, errors) => {
      expect(validateManualLedgerRecord({ ...MINIMAL_INPUT, ...overrides }, LOCAL)).toEqual(
        errors,
      );
    });
  });

  describe('balance rule', () => {
    it.each<[string, Partial<LedgerRecordInput>]>([
      ['a difference of exactly 0.005', { debitLocalAmount1: 100.005 }],
      ['a difference of exactly 0.005 the other way', { creditLocalAmount1: 100.005 }],
      [
        'a four-slot balance (credit 1 117 = debit 1 100 + debit 2 17)',
        {
          creditLocalAmount1: 117,
          debitLocalAmount1: 100,
          debitEntity2: 'debit-entity-2',
          debitLocalAmount2: 17,
        },
      ],
      [
        'a balance across both second slots',
        {
          debitLocalAmount1: 100.1,
          debitEntity2: 'debit-entity-2',
          debitLocalAmount2: 0.2,
          creditLocalAmount1: 0.3,
          creditEntity2: 'credit-entity-2',
          creditLocalAmount2: 100,
        },
      ],
    ])('accepts %s', (_, overrides) => {
      expect(validateManualLedgerRecord({ ...MINIMAL_INPUT, ...overrides }, LOCAL)).toEqual([]);
    });

    it.each<[string, Partial<LedgerRecordInput>, string]>([
      [
        'a difference of 0.006',
        { debitLocalAmount1: 100.006 },
        'Debit and credit totals must be equal (debit 100.006, credit 100)',
      ],
      [
        'a difference just over the tolerance (0.0050004)',
        { debitLocalAmount1: 100.0050004 },
        'Debit and credit totals must be equal (debit 100.0050004, credit 100)',
      ],
      [
        'a difference of 0.006 the other way',
        { creditLocalAmount1: 100.006 },
        'Debit and credit totals must be equal (debit 100, credit 100.006)',
      ],
      [
        'a credit that only a missing second debit slot would balance',
        { creditLocalAmount1: 117 },
        'Debit and credit totals must be equal (debit 100, credit 117)',
      ],
    ])('rejects %s', (_, overrides, error) => {
      expect(validateManualLedgerRecord({ ...MINIMAL_INPUT, ...overrides }, LOCAL)).toEqual([
        error,
      ]);
    });
  });

  describe('lock date rule', () => {
    const LOCKED = { ...LOCAL, ledgerLock: '2025-02-28' as const };

    it.each<[string, Partial<LedgerRecordInput>, string[]]>([
      [
        'an invoice date equal to the lock date',
        { invoiceDate: '2025-02-28' },
        ['Invoice date must be after the ledger lock date (2025-02-28)'],
      ],
      [
        'an invoice date before the lock date',
        { invoiceDate: '2025-01-15' },
        ['Invoice date must be after the ledger lock date (2025-02-28)'],
      ],
      [
        'a value date equal to the lock date',
        { valueDate: '2025-02-28' },
        ['Value date must be after the ledger lock date (2025-02-28)'],
      ],
      [
        'a value date before the lock date',
        { valueDate: '2024-12-31' },
        ['Value date must be after the ledger lock date (2025-02-28)'],
      ],
      [
        'both dates on the lock date',
        { invoiceDate: '2025-02-28', valueDate: '2025-02-28' },
        [
          'Invoice date must be after the ledger lock date (2025-02-28)',
          'Value date must be after the ledger lock date (2025-02-28)',
        ],
      ],
    ])('rejects %s', (_, overrides, errors) => {
      expect(validateManualLedgerRecord({ ...MINIMAL_INPUT, ...overrides }, LOCKED)).toEqual(
        errors,
      );
    });

    it('accepts dates the day after the lock date', () => {
      expect(
        validateManualLedgerRecord(
          { ...MINIMAL_INPUT, invoiceDate: '2025-03-01', valueDate: '2025-03-01' },
          LOCKED,
        ),
      ).toEqual([]);
    });

    it.each([undefined, null])('reports no date errors when the lock date is %s', ledgerLock => {
      expect(
        validateManualLedgerRecord(
          { ...MINIMAL_INPUT, invoiceDate: '1999-01-01', valueDate: '1999-01-01' },
          { ...LOCAL, ledgerLock },
        ),
      ).toEqual([]);
    });
  });

  it('reports every problem at once', () => {
    const errors = validateManualLedgerRecord(
      {
        ...MINIMAL_INPUT,
        debitLocalAmount1: 0,
        debitForeignAmount1: 30,
        debitLocalAmount2: 5,
        creditEntity2: 'credit-entity-2',
        invoiceDate: '2025-02-01',
      },
      { ...LOCAL, ledgerLock: '2025-02-28' },
    );

    expect(errors).toEqual([
      'Debit 1: amount must be greater than 0',
      'Debit 2: an entity is required when an amount is entered',
      'Credit 2: amount is required',
      'Debit 1: foreign amount is not allowed for ILS records',
      'Debit and credit totals must be equal (debit 5, credit 100)',
      'Invoice date must be after the ledger lock date (2025-02-28)',
    ]);
  });
});

describe('deriveMiscExpenseFromLedgerInput', () => {
  const VAT_INPUT: LedgerRecordInput = {
    ...MINIMAL_INPUT,
    debitLocalAmount1: 100,
    creditLocalAmount1: 117,
    debitEntity2: 'vat-entity',
    debitLocalAmount2: 17,
    creditEntity2: 'credit-entity-2',
    creditLocalAmount2: 5,
    description: 'Office supplies',
  };

  it('maps a local-currency record: creditor/debtor from slot 1, the credit local amount', () => {
    const derived = deriveMiscExpenseFromLedgerInput(VAT_INPUT, { localCurrency: Currency.Ils });

    expect(derived).toEqual({
      creditorId: 'credit-entity-1',
      debtorId: 'debit-entity-1',
      amount: 117,
      currency: Currency.Ils,
      description: 'Office supplies',
      invoiceDate: '2025-03-12',
      valueDate: expect.any(Date),
    });
  });

  it('maps a foreign-currency record to the credit slot-1 foreign amount', () => {
    const derived = deriveMiscExpenseFromLedgerInput(
      {
        ...MINIMAL_INPUT,
        currency: Currency.Usd,
        debitForeignAmount1: 30,
        creditLocalAmount1: 100,
        creditForeignAmount1: 27,
      },
      { localCurrency: Currency.Ils },
    );

    expect(derived).toMatchObject({ amount: 27, currency: Currency.Usd });
  });

  it('ignores slot 2 and leaves a missing description null', () => {
    const derived = deriveMiscExpenseFromLedgerInput(
      { ...VAT_INPUT, description: undefined },
      { localCurrency: Currency.Ils },
    );

    expect(derived.creditorId).toBe('credit-entity-1');
    expect(derived.debtorId).toBe('debit-entity-1');
    expect(derived.amount).toBe(117);
    expect(derived.description).toBeNull();
    expect(Object.values(derived)).not.toContain('vat-entity');
    expect(Object.values(derived)).not.toContain('credit-entity-2');
  });

  describe.each(TEST_TIMEZONES)('value date (TZ=%s)', timeZone => {
    useTimezone(timeZone);

    it.each(['2025-03-14', '2025-01-01', '2024-12-31', '2024-02-29'] as const)(
      'round-trips %s by day',
      valueDate => {
        const derived = deriveMiscExpenseFromLedgerInput(
          { ...MINIMAL_INPUT, valueDate },
          { localCurrency: Currency.Ils },
        );

        expect(dateToTimelessDateString(derived.valueDate)).toBe(valueDate);
      },
    );
  });
});

describe('deriveNewChargeFromLedgerInput', () => {
  it('describes the charge with the trimmed record description', () => {
    expect(
      deriveNewChargeFromLedgerInput({
        ...MINIMAL_INPUT,
        description: '  Office supplies  ',
        reference: 'INV-1',
      }),
    ).toEqual({ userDescription: 'Office supplies' });
  });

  it('falls back to the trimmed reference when the description is missing or blank', () => {
    expect(
      deriveNewChargeFromLedgerInput({ ...MINIMAL_INPUT, reference: ' INV-1 ' }),
    ).toEqual({ userDescription: 'INV-1' });
    expect(
      deriveNewChargeFromLedgerInput({ ...MINIMAL_INPUT, description: '   ', reference: 'INV-1' }),
    ).toEqual({ userDescription: 'INV-1' });
  });

  it('leaves the charge without a description when neither is given', () => {
    expect(deriveNewChargeFromLedgerInput(MINIMAL_INPUT)).toEqual({ userDescription: null });
    expect(
      deriveNewChargeFromLedgerInput({ ...MINIMAL_INPUT, description: null, reference: ' ' }),
    ).toEqual({ userDescription: null });
  });
});

describe('deriveDocumentFromLedgerInput', () => {
  const OWNER_ID = 'charge-owner';
  const INPUT_VAT = 'input-vat-category';
  const OUTPUT_VAT = 'output-vat-category';

  const ENTITY_TYPES = new Map<string, string>([
    ['supplier', 'business'],
    ['customer', 'business'],
    [OWNER_ID, 'business'],
    ['expense-category', 'tax_category'],
    ['income-category', 'tax_category'],
    ['other-category', 'tax_category'],
    [INPUT_VAT, 'tax_category'],
    [OUTPUT_VAT, 'tax_category'],
  ]);

  const CTX = {
    ownerId: OWNER_ID,
    localCurrency: Currency.Ils,
    entityTypes: ENTITY_TYPES,
    inputVatTaxCategoryId: INPUT_VAT,
    outputVatTaxCategoryId: OUTPUT_VAT,
  };

  // Supplier invoice: expense 100 + VAT 17 (debit) against the supplier 117 (credit)
  const EXPENSE_INPUT: LedgerRecordInput = {
    debitEntity1: 'expense-category',
    debitLocalAmount1: 100,
    creditEntity1: 'supplier',
    creditLocalAmount1: 117,
    debitEntity2: INPUT_VAT,
    debitLocalAmount2: 17,
    currency: Currency.Ils,
    invoiceDate: '2025-03-12',
    valueDate: '2025-03-14',
    description: 'Office supplies',
    reference: 'INV-1',
  };

  // Customer invoice: the customer 117 (debit) against income 100 + VAT 17 (credit)
  const INCOME_INPUT: LedgerRecordInput = {
    debitEntity1: 'customer',
    debitLocalAmount1: 117,
    creditEntity1: 'income-category',
    creditLocalAmount1: 100,
    creditEntity2: OUTPUT_VAT,
    creditLocalAmount2: 17,
    currency: Currency.Ils,
    invoiceDate: '2025-04-01',
    valueDate: '2025-04-03',
    description: 'Consulting',
    reference: 'SO-7',
  };

  const NULL_DEFAULTS = {
    image: null,
    file: null,
    vatReportDateOverride: null,
    noVatAmount: null,
    allocationNumber: null,
    exchangeRateOverride: null,
    fileHash: null,
    remarks: null,
  };

  it('maps an expense: the credit-side business is the creditor and the owner the debtor', () => {
    expect(deriveDocumentFromLedgerInput(EXPENSE_INPUT, CTX)).toEqual({
      ...NULL_DEFAULTS,
      documentType: DocumentType.Invoice,
      creditorId: 'supplier',
      debtorId: OWNER_ID,
      amount: 117,
      currencyCode: Currency.Ils,
      vat: 17,
      serialNumber: 'INV-1',
      date: '2025-03-12',
      description: 'Office supplies',
    });
  });

  it('maps an income: the debit-side business is the debtor and the owner the creditor', () => {
    expect(deriveDocumentFromLedgerInput(INCOME_INPUT, CTX)).toEqual({
      ...NULL_DEFAULTS,
      documentType: DocumentType.Invoice,
      creditorId: OWNER_ID,
      debtorId: 'customer',
      amount: 117,
      currencyCode: Currency.Ils,
      vat: 17,
      serialNumber: 'SO-7',
      date: '2025-04-01',
      description: 'Consulting',
    });
  });

  it('reads VAT from the input VAT category on debit 2 of an expense', () => {
    const derived = deriveDocumentFromLedgerInput(
      { ...EXPENSE_INPUT, debitEntity2: INPUT_VAT, debitLocalAmount2: 17 },
      CTX,
    );
    expect(derived.vat).toBe(17);
  });

  it('reads VAT from the output VAT category on credit 2 of an income', () => {
    const derived = deriveDocumentFromLedgerInput(
      { ...INCOME_INPUT, creditEntity2: OUTPUT_VAT, creditLocalAmount2: 17 },
      CTX,
    );
    expect(derived.vat).toBe(17);
  });

  it('sets VAT to 0 when slot 2 holds another tax category', () => {
    const derived = deriveDocumentFromLedgerInput(
      { ...EXPENSE_INPUT, debitEntity2: 'other-category' },
      CTX,
    );
    expect(derived.vat).toBe(0);
  });

  it('sets VAT to 0 when slot 2 is empty, and maps absent optional values to null', () => {
    const derived = deriveDocumentFromLedgerInput(
      {
        debitEntity1: 'expense-category',
        debitLocalAmount1: 100,
        creditEntity1: 'supplier',
        creditLocalAmount1: 100,
        currency: Currency.Ils,
        invoiceDate: '2025-03-12',
        valueDate: '2025-03-14',
      },
      CTX,
    );
    expect(derived).toMatchObject({ vat: 0, serialNumber: null, description: null, amount: 100 });
  });

  it('never takes VAT from slot 2 on the counterparty side', () => {
    // Expense: VAT category on credit 2 (the supplier's side) is not the document's VAT
    const expense = deriveDocumentFromLedgerInput(
      {
        ...EXPENSE_INPUT,
        debitEntity2: null,
        debitLocalAmount2: null,
        debitLocalAmount1: 117,
        creditLocalAmount1: 100,
        creditEntity2: INPUT_VAT,
        creditLocalAmount2: 17,
      },
      CTX,
    );
    expect(expense.vat).toBe(0);

    // Income: VAT category on debit 2 (the customer's side) is not the document's VAT
    const income = deriveDocumentFromLedgerInput(
      {
        ...INCOME_INPUT,
        creditEntity2: null,
        creditLocalAmount2: null,
        creditLocalAmount1: 117,
        debitLocalAmount1: 100,
        debitEntity2: OUTPUT_VAT,
        debitLocalAmount2: 17,
      },
      CTX,
    );
    expect(income.vat).toBe(0);
  });

  it('uses the foreign amounts for a foreign-currency record', () => {
    const derived = deriveDocumentFromLedgerInput(
      {
        ...EXPENSE_INPUT,
        currency: Currency.Usd,
        debitLocalAmount1: 360,
        debitForeignAmount1: 100,
        creditLocalAmount1: 421.2,
        creditForeignAmount1: 117,
        debitLocalAmount2: 61.2,
        debitForeignAmount2: 17,
      },
      CTX,
    );
    expect(derived).toMatchObject({ amount: 117, vat: 17, currencyCode: Currency.Usd });
  });

  it('uses the foreign amounts for a foreign-currency income', () => {
    const derived = deriveDocumentFromLedgerInput(
      {
        ...INCOME_INPUT,
        currency: Currency.Eur,
        debitLocalAmount1: 468,
        debitForeignAmount1: 117,
        creditLocalAmount1: 400,
        creditForeignAmount1: 100,
        creditLocalAmount2: 68,
        creditForeignAmount2: 17,
      },
      CTX,
    );
    expect(derived).toMatchObject({
      creditorId: OWNER_ID,
      debtorId: 'customer',
      amount: 117,
      vat: 17,
      currencyCode: Currency.Eur,
    });
  });

  it('sets VAT to 0 for a foreign-currency record whose slot 2 is not a VAT category', () => {
    const derived = deriveDocumentFromLedgerInput(
      {
        ...EXPENSE_INPUT,
        currency: Currency.Usd,
        debitLocalAmount1: 360,
        debitForeignAmount1: 100,
        creditLocalAmount1: 421.2,
        creditForeignAmount1: 117,
        debitEntity2: 'other-category',
        debitLocalAmount2: 61.2,
        debitForeignAmount2: 17,
      },
      CTX,
    );
    expect(derived).toMatchObject({ amount: 117, vat: 0, currencyCode: Currency.Usd });
  });

  it('rejects a record with a business on both main sides', () => {
    expect(() =>
      deriveDocumentFromLedgerInput({ ...EXPENSE_INPUT, debitEntity1: 'customer' }, CTX),
    ).toThrow('A document needs exactly one business among the main debit and credit entities');
  });

  it('rejects a record with no business on the main sides', () => {
    expect(() =>
      deriveDocumentFromLedgerInput({ ...EXPENSE_INPUT, creditEntity1: 'other-category' }, CTX),
    ).toThrow('A document needs exactly one business among the main debit and credit entities');
  });

  it('rejects an expense whose counterparty is the charge owner', () => {
    expect(() =>
      deriveDocumentFromLedgerInput({ ...EXPENSE_INPUT, creditEntity1: OWNER_ID }, CTX),
    ).toThrow("A document's counterparty cannot be the charge owner");
  });

  it('rejects an income whose counterparty is the charge owner', () => {
    expect(() =>
      deriveDocumentFromLedgerInput({ ...INCOME_INPUT, debitEntity1: OWNER_ID }, CTX),
    ).toThrow("A document's counterparty cannot be the charge owner");
  });
});
