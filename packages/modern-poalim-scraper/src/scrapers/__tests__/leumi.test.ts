import { describe, expect, it } from 'vitest';
import { validate } from '../leumi/broker.js';
import {
  foreignAccountActivitySchema,
  mapLeumiCurrencyLabel,
  parseLeumiAmount,
} from '../leumi/foreign-transactions.js';
import { ilsTransactionSchema, soStatusSchema } from '../leumi/schemas.js';

// Made-up values in the shape the bank sends. No real account data.
const ilsTransaction = {
  DateUTC: '2026-01-14T22:00:00.002Z',
  DateSO: '15/01/2026',
  Amount: -120.5,
  Credit: 0,
  Debit: 120.5,
  TransactionSign: false,
  Description: 'הוראת קבע',
  RunningBalance: 1000,
  EffectiveDateUTC: '2026-01-14T22:00:00.002Z',
  EffectiveDateSO: '15/01/2026',
  ReferenceNumberLong: 12_345,
  TypeInt: 4,
  AdditionalDescriptionIdentifier: false,
  AdditionalData: null,
  AdditionalActivityTypeInt: 0,
  SegmentationFlagInt: 0,
  ExtensionTypeCode: 0,
  CreditCardIndex: 0,
  Period: 1,
  IfLinkInt: 0,
  InvoiceStatus: null,
  CheckNumberLong: 12_345,
  FITID: '202601150012345',
  TrxIndex: 0,
};

const foreignActivity = {
  account: { value: '2', label: 'דולר ארה"ב ... 12345/67 094 דולר ארה"ב' },
  currencyLabel: 'דולר ארה"ב',
  currency: 'USD',
  asOfDate: '26/11/26',
  balance: '1,234.56',
  lastActionDate: '07/07/26',
  fromDate: '27/11/24',
  toDate: '26/11/26',
  headers: ['תאריך', 'תיאור', 'אסמכתא', 'חובה', 'זכות', 'יתרה'],
  transactions: [
    {
      date: '07/07/26',
      description: 'המרה-אינטרנט',
      reference: '700000001',
      debit: '10.00',
      credit: '',
      balance: '1,234.56',
    },
  ],
};

describe('leumi schemas', () => {
  it('accepts a shekel transaction in the shape the bank sends', () => {
    expect(ilsTransactionSchema.safeParse(ilsTransaction).success).toBe(true);
  });

  it('rejects a field the bank did not send before', () => {
    const result = ilsTransactionSchema.safeParse({ ...ilsTransaction, NewField: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects a value in a field that was only ever null', () => {
    const result = ilsTransactionSchema.safeParse({ ...ilsTransaction, InvoiceStatus: 'PAID' });
    expect(result.success).toBe(false);
  });

  it('rejects a date that is not in the bank format', () => {
    const result = ilsTransactionSchema.safeParse({ ...ilsTransaction, DateSO: '2026-01-15' });
    expect(result.success).toBe(false);
  });

  it('accepts both an empty and a "no data" status', () => {
    expect(soStatusSchema.safeParse({ Status: true, SOStatusItem: null }).success).toBe(true);
    expect(
      soStatusSchema.safeParse({
        Status: true,
        SOStatusItem: [
          { Code: 2, Message: 'NO DATA', ResourceID: 'NoDataInfo', GlobalResourceID: null },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('validate', () => {
  it('returns the raw data with the verdict, also when it does not match', () => {
    const raw = { ...ilsTransaction, NewField: 1 };
    const result = validate(ilsTransactionSchema, raw, true);
    expect(result.isValid).toBe(false);
    expect(result.data).toBe(raw);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('does not check when validation is off', () => {
    const result = validate(ilsTransactionSchema, { anything: true }, false);
    expect(result).toEqual({ data: { anything: true }, isValid: null, errors: null });
  });
});

describe('leumi foreign-currency activity', () => {
  it('accepts a page in the expected shape', () => {
    expect(foreignAccountActivitySchema.safeParse(foreignActivity).success).toBe(true);
  });

  it('rejects a row that fills both the debit and the credit column', () => {
    const result = foreignAccountActivitySchema.safeParse({
      ...foreignActivity,
      transactions: [{ ...foreignActivity.transactions[0], credit: '10.00' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a table whose columns changed', () => {
    const result = foreignAccountActivitySchema.safeParse({
      ...foreignActivity,
      headers: ['תאריך', 'תיאור', 'אסמכתא', 'זכות', 'חובה', 'יתרה'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown currency instead of guessing one', () => {
    const result = foreignAccountActivitySchema.safeParse({ ...foreignActivity, currency: null });
    expect(result.success).toBe(false);
  });

  it('maps the currency names the page prints', () => {
    expect(mapLeumiCurrencyLabel('דולר ארה"ב')).toBe('USD');
    expect(mapLeumiCurrencyLabel("דולר ארה''ב")).toBe('USD');
    expect(mapLeumiCurrencyLabel('  אירו ')).toBe('EUR');
    expect(mapLeumiCurrencyLabel('דולר קנדי')).toBe('CAD');
    expect(mapLeumiCurrencyLabel('מטבע לא מוכר')).toBeNull();
  });

  it('parses amounts and refuses anything else', () => {
    expect(parseLeumiAmount('1,234.56')).toBe(1234.56);
    expect(parseLeumiAmount('-0.50')).toBe(-0.5);
    expect(() => parseLeumiAmount('')).toThrow();
    expect(() => parseLeumiAmount('12')).toThrow();
  });
});
