import { describe, expect, it } from 'vitest';
import { checkAccounts, type AccountRecord } from '../check-accounts.js';
import { leumiCreditCardVars, leumiForeignVars, leumiIlsVars } from '../graphql/mutations.js';
import { leumiChargeCurrency, leumiCycleDates, type LeumiIlsData } from '../scrapers/leumi.js';

// Made-up values in the shapes the bank sends. No real account data.
const ilsTransaction: LeumiIlsData['transactions'][number] = {
  DateUTC: '2026-01-14T22:00:00.002Z',
  DateSO: '15/01/2026',
  Amount: -120.5,
  Credit: 0,
  Debit: 120.5,
  TransactionSign: false,
  Description: 'הוראת קבע',
  RunningBalance: 1000,
  EffectiveDateUTC: '2026-01-15T22:00:00.002Z',
  EffectiveDateSO: '16/01/2026',
  ReferenceNumberLong: 12_345,
  TypeInt: 4,
  AdditionalDescriptionIdentifier: false,
  AdditionalData: null,
  AdditionalActivityTypeInt: 0,
  SegmentationFlagInt: 0,
  ExtensionTypeCode: 5,
  CreditCardIndex: 0,
  Period: 1,
  IfLinkInt: 7,
  InvoiceStatus: null,
  CheckNumberLong: 12_345,
  FITID: '202601150012345',
  TrxIndex: 3,
};

describe('leumiIlsVars', () => {
  it('maps a booked transaction, with dates as calendar days', () => {
    const { transactions } = leumiIlsVars([
      { accountNumber: '99900000000001', branchNumber: 700, transactions: [ilsTransaction] },
    ]);
    expect(transactions).toEqual([
      {
        accountNumber: '99900000000001',
        date: '2026-01-15',
        effectiveDate: '2026-01-16',
        amount: -120.5,
        credit: 0,
        debit: 120.5,
        description: 'הוראת קבע',
        additionalData: undefined,
        runningBalance: 1000,
        referenceNumber: '12345',
        checkNumber: '12345',
        fitid: '202601150012345',
        typeCode: 4,
        additionalActivityType: 0,
        extensionTypeCode: 5,
        segmentationFlag: 0,
        creditCardIndex: 0,
        ifLink: 7,
      },
    ]);
  });

  it('refuses a date that is not in the bank format', () => {
    expect(() =>
      leumiIlsVars([
        {
          accountNumber: '1',
          branchNumber: 700,
          transactions: [{ ...ilsTransaction, DateSO: '2026-01-15' }],
        },
      ]),
    ).toThrow(/Not a Leumi date/);
  });
});

describe('leumiForeignVars', () => {
  const activity = {
    account: { value: '2', label: 'דולר ארה"ב' },
    currencyLabel: 'דולר ארה"ב',
    currency: 'USD',
    asOfDate: '26/11/26',
    balance: '1,234.56',
    lastActionDate: '07/07/26',
    fromDate: '27/11/24',
    toDate: '26/11/26',
    headers: ['תאריך', 'תיאור', 'אסמכתא', 'חובה', 'זכות', 'יתרה'] as [
      'תאריך',
      'תיאור',
      'אסמכתא',
      'חובה',
      'זכות',
      'יתרה',
    ],
    transactions: [
      {
        date: '07/07/26',
        description: 'המרה-אינטרנט',
        reference: '700000001',
        debit: '2,752.33',
        credit: '',
        balance: '1,234.56',
      },
    ],
  };

  it('turns the page text into numbers and a full date', () => {
    const { transactions } = leumiForeignVars([
      { accountNumber: '9990000002', branchNumber: 700, activity },
    ]);
    expect(transactions).toEqual([
      {
        accountNumber: '9990000002',
        currency: 'USD',
        date: '2026-07-07',
        description: 'המרה-אינטרנט',
        reference: '700000001',
        debit: 2752.33,
        credit: 0,
        balance: 1234.56,
      },
    ]);
  });

  it('refuses an amount it cannot read instead of storing a guess', () => {
    const broken = {
      ...activity,
      transactions: [{ ...activity.transactions[0]!, balance: '12' }],
    };
    expect(() => leumiForeignVars([{ accountNumber: '1', branchNumber: 700, activity: broken }])).toThrow(
      /Not a Leumi amount/,
    );
  });
});

describe('leumiCreditCardVars', () => {
  const transaction = {
    CardTransactionId: 'TX-1',
    // Midnight in Israel, in summer (UTC+3) and in winter (UTC+2).
    DateDealUTC: '2026-07-04T21:00:00.003Z',
    DebitCardDebitPeriodUTC: '2026-12-09T22:00:00.002Z',
    DebitCardFirmName: 'Some shop                 ',
    DealDescription: '',
    AmountDouble: 300,
    TransactionCurrency: '-1',
    NextPaymentAmountDouble: 100,
    TypeOfTransaction: 111,
  };

  it('reads the dates as calendar days in Israel and trims the merchant', () => {
    const { transactions } = leumiCreditCardVars([
      {
        cardLast4: '9901',
        relatedAccountNumber: '99900000000001',
        transactions: [{ chargeCurrency: 'ILS', tableId: 1, transaction }],
      },
    ]);
    expect(transactions).toEqual([
      {
        cardLast4: '9901',
        relatedAccountNumber: '99900000000001',
        cardTransactionId: 'TX-1',
        dealDate: '2026-07-05',
        debitDate: '2026-12-10',
        merchantName: 'Some shop',
        dealDescription: '',
        dealAmount: 300,
        dealCurrencyCode: '-1',
        chargeAmount: 100,
        chargeCurrency: 'ILS',
        transactionType: 111,
        tableId: 1,
      },
    ]);
  });
});

describe('leumiCycleDates', () => {
  it('covers every month in range plus the cycle after it, across a year end', () => {
    expect(leumiCycleDates(new Date(2025, 10, 20), new Date(2026, 0, 3))).toEqual([
      '2025-11-01T00:00:00',
      '2025-12-01T00:00:00',
      '2026-01-01T00:00:00',
      '2026-02-01T00:00:00',
    ]);
  });
});

describe('leumiChargeCurrency', () => {
  it('maps the bank codes it knows and refuses the rest', () => {
    expect(leumiChargeCurrency('1')).toBe('USD');
    expect(leumiChargeCurrency('49')).toBe('EUR');
    expect(leumiChargeCurrency('080')).toBe('ILS');
    expect(() => leumiChargeCurrency('7')).toThrow(/unknown currency code/);
  });
});

describe('checkAccounts for Leumi', () => {
  const record = (
    sourceType: AccountRecord['sourceType'],
    accountNumber: string,
    status: AccountRecord['status'],
  ): AccountRecord => ({ id: accountNumber, sourceId: 'leumi-1', sourceType, accountNumber, status });

  it('identifies bank accounts by full number', () => {
    const result = checkAccounts(
      'leumi',
      [{ accountNumber: 'A' }, { accountNumber: 'B' }, { accountNumber: 'C' }],
      [record('leumi', 'A', 'accepted'), record('leumi', 'B', 'ignored')],
    );
    expect(result).toEqual({ accepted: ['A'], ignored: ['B'], unknown: ['C'] });
  });

  it('keeps cards apart from bank accounts with the same digits', () => {
    const result = checkAccounts(
      'leumi-credit-card',
      [{ cardLast4: '9901' }],
      [record('leumi', '9901', 'accepted')],
    );
    expect(result.unknown).toEqual(['9901']);
  });
});
