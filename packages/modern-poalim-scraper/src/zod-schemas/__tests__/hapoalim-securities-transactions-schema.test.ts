import { describe, expect, it } from 'vitest';
import {
  describeSecuritiesTransactionsError,
  HapoalimSecuritiesTransactionsSchema,
} from '../hapoalim-securities-transactions-schema.js';

// Synthetic fixtures only — never lifted from a real bank capture.
const buy = {
  Security: '1234567',
  ValueDate: '2024-01-16T00:00:00.0000000+02:00',
  TradeCommissionPercent: 0.1,
  TradeGrossValueTradeCurrency: 1000,
  IsraeTaxValue: 0,
  PaymentType: null,
  TransactionType: 'קניה',
  TradeGrossValueNIS: 3700,
  TradeDate: '2024-01-15T00:00:00.0000000+02:00',
  TradeCommissionValueNIS: 3.7,
  CapitalTaxValueSettlementCurrency: 0,
  HebNameFull: 'EXAMPLE CORP',
  EngNameFull: 'EXAMPLE CORP',
  IssueCurrency: 'דולר ארה"ב',
  Branch: 615,
  Account: 100_000,
  HebName: 'EXAMPLE CORP',
  EngName: 'EXAMPLE CORP',
  NominalProfitLossNIS: 0,
  TradeCommissionValueTradeCurrency: 1,
  SettlementDate: '2024-01-17T00:00:00.0000000+02:00',
  NetValueNIS: -3.7,
  PaymentName: null,
  PaymentDate: null,
  NetValueTradeCurrency: -1000,
  ManagementFeesPercent: 0,
  TradeCurrency: 'דולר ארה"ב',
  NominalProfitLossLinkage: 0,
  TradeType: 'קניה',
  AccountName: 'לקוח לדוגמה',
  ExDate: null,
  PeymentPecentage: 0,
  ManagementFeesValueNIS: 0,
  RealProfitLossNIS: 0,
  IssueCurrencyToTradeCurrencyRate: 1,
  SecurityGroup: 'מניות ניע"ז',
  CancelDate: null,
  PostDeductionTaxValueNIS: 0,
  ExDateBalance: 0,
  ManagementFeesValueTradeCurrency: 0,
  Symbol: 'EXMP',
  NV: 10,
  ExecutingBranch: '615',
  AgentCommissionValueTradeCurrency: 0,
  CapitalTaxPercent: 0,
  SettlementCurrency: 'דולר ארה"ב',
  NetValueSettlementCurrency: -1000,
  SymbolOSI: 'EXMP US',
  ExpiryDate: null,
  PaymentLinkingValue: 0,
  FinancialAccountBranch: '615',
  PreviousActionsDeductions: 0,
  TradePrice: 100,
  TradeCurrnecyRate: 1,
  ISIN: 'US0000000001',
  LastTranactionDate: '2024-01-15T00:00:00.0000000+02:00',
  PersonalCurrencyRate: 3.7,
  PostActionDeductionBalance: 0,
  FinancialAccountNumber: '100000',
  IssuerCountryCode: 'US',
  AccumulatedInterest: 0,
  OrderOrigin: null,
  FundPlusAccumulatedInerestValue: 1000,
  IssuerCountry: 'ארצות הברית',
  IsraelTaxPercent: 0,
  CommissionsCurrency: 'שקל חדש',
  IsraelTaxValueByPaymentsSettlementCurrency: 0,
  IsCancelTransaction: 'לא',
  IssuerExchange: 'NYSE',
  PaymentCurrency: null,
  ForeignTaxPercent: 0,
  ForeignTaxValueSettlementCurrency: 0,
  ExchangeCountry: 'ארצות הברית',
  SettlementPrice: 0,
  ImpliedAssetMult: 1,
  IsTradable: 'סחיר',
  IsUSEquity: 'כן',
  OrderedNV: 0,
  ExecutedNV: 0,
  OrderType: null,
  OrderedValue: 0,
  ExecutionDate: '0001-01-01T00:00:00.0000000',
  IsJumbo: false,
  SecuritySubGroup: null,
  OrderSubject: null,
};

// An Israeli mutual fund: the bank sends the same string in all four name
// fields, and its language follows the security — Hebrew here, Latin for the
// foreign holdings above. Hence EngName carrying Hebrew text is correct, and
// the schema's EngName === HebName invariant holds either way.
const israeliFund = {
  ...buy,
  Security: '7654321',
  ISIN: 'IL0001234567',
  Symbol: 'YL MONEY K',
  SymbolOSI: null,
  EngName: 'י.ל. כספית כשרה',
  HebName: 'י.ל. כספית כשרה',
  EngNameFull: 'י.ל. כספית כשרה',
  HebNameFull: 'י.ל. כספית כשרה',
  SecurityGroup: 'קרן נאמנות',
  IssueCurrency: 'שקל חדש',
  TradeCurrency: 'שקל חדש',
  SettlementCurrency: 'שקל חדש',
  IssuerCountry: 'ישראל',
  IssuerCountryCode: 'IL',
  IssuerExchange: 'ישראל',
  ExchangeCountry: 'ישראל',
  IsUSEquity: 'לא',
};

// A corporate action: the payment-related keys the bank leaves null on a trade
// are populated here, and the trade-related ones go to zero.
const dividend = {
  ...buy,
  TransactionType: 'תשלומים ואירועי חברה',
  TradeType: 'דבידנד תשלום',
  PaymentType: 'דיבידנד',
  PaymentDate: '2024-02-05T00:00:00.0000000+02:00',
  ExDate: '2024-01-30T00:00:00.0000000+02:00',
  ExDateBalance: 10,
  PeymentPecentage: 2.25,
  NV: 0,
  TradePrice: 0,
  ForeignTaxPercent: 30,
  ForeignTaxValueSettlementCurrency: 6.75,
};

// A two-sided deposit transfer. Account 615-466803 files these under the
// `העברות` transaction type, while another account files the one-sided variants
// under `תשלומים ואירועי חברה` — which is why the schema no longer ties a
// non-trading TradeType to one particular TransactionType.
const transfer = {
  ...buy,
  TransactionType: 'העברות',
  TradeType: 'העברה לחובת הפקדון (דו צדדית)',
  NV: 0,
  TradePrice: 0,
};

function response(executions: unknown[], extra: Record<string, unknown> = {}) {
  return {
    Account: {
      PageState: 'ZXhhbXBsZQ==',
      Execution: executions,
      ...extra,
    },
  };
}

describe('HapoalimSecuritiesTransactionsSchema', () => {
  it('accepts a trade execution', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([buy]));
    expect(result.success).toBe(true);
  });

  it('accepts a Hebrew-named local security', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([israeliFund]));
    expect(result.success).toBe(true);
  });

  it('accepts a corporate-action execution', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([dividend]));
    expect(result.success).toBe(true);
  });

  it('accepts a two-sided deposit transfer', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([transfer]));
    expect(result.success).toBe(true);
  });

  // The same transfer TradeType shows up under two different TransactionTypes
  // across accounts, so the pairing is not asserted beyond buys and sells.
  it('accepts a transfer TradeType under either non-trading TransactionType', () => {
    for (const TransactionType of ['העברות', 'תשלומים ואירועי חברה']) {
      const result = HapoalimSecuritiesTransactionsSchema.safeParse(
        response([{ ...transfer, TransactionType }]),
      );
      expect(result.success).toBe(true);
    }
  });

  it('accepts an empty execution list', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([]));
    expect(result.success).toBe(true);
  });

  // A portfolio with no activity in the requested range omits Execution entirely.
  it('defaults a missing Execution list to an empty array', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse({
      Account: { PageState: 'ZXhhbXBsZQ==' },
    });
    expect(result.success).toBe(true);
    expect(result.data?.Account.Execution).toEqual([]);
  });

  it('accepts a response with no PageState', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse({
      Account: { Execution: [buy] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a response with no Account', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse({ Foo: {} });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown field on an execution, naming the key', () => {
    const payload = response([{ ...buy, SomeNewBankField: 'whatever' }]);
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(describeSecuritiesTransactionsError(payload, result.error!)).toContain(
      'SomeNewBankField',
    );
  });

  it('rejects an execution missing a required identity field', () => {
    const { TradeDate: _omitted, ...withoutTradeDate } = buy;
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([withoutTradeDate]));
    expect(result.success).toBe(false);
  });

  it('accepts nulls in the payment and corporate-action fields', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([buy]));
    expect(result.data?.Account.Execution[0]).toMatchObject({
      PaymentType: null,
      PaymentDate: null,
      ExDate: null,
      CancelDate: null,
      OrderType: null,
    });
  });

  it('rejects a numeric field sent as a string', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, TradePrice: '100' }]),
    );
    expect(result.success).toBe(false);
  });

  // ── formats ────────────────────────────────────────────────────────────────

  it.each([
    ['a date-only string', '2024-01-15'],
    ['an ISO string without the 7-digit fraction', '2024-01-15T00:00:00+02:00'],
    ['a millisecond-precision string', '2024-01-15T00:00:00.000+02:00'],
  ])('rejects TradeDate sent as %s', (_label, tradeDate) => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, TradeDate: tradeDate }]),
    );
    expect(result.success).toBe(false);
  });

  // ExecutionDate carries the 0001-01-01 sentinel, which has no offset.
  it('accepts a timestamp with no UTC offset', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([buy]));
    expect(result.success).toBe(true);
  });

  it.each([
    ['too short', 'US123'],
    ['not starting with two letters', '1S0000000001'],
    ['ending in a letter', 'US000000000A'],
  ])('rejects an ISIN that is %s', (_label, isin) => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([{ ...buy, ISIN: isin }]));
    expect(result.success).toBe(false);
  });

  it.each([['12345'], ['123456789'], ['ABC1234']])(
    'rejects the security number %s',
    security => {
      const result = HapoalimSecuritiesTransactionsSchema.safeParse(
        response([{ ...buy, Security: security }]),
      );
      expect(result.success).toBe(false);
    },
  );

  it('rejects an empty security name', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, EngName: '', HebName: '' }]),
    );
    expect(result.success).toBe(false);
  });

  // ── closed vocabularies ────────────────────────────────────────────────────

  it.each([
    ['TradeCurrency', 'אירו'],
    ['TransactionType', 'העברה'],
    ['TradeType', 'שינוי'],
    ['PaymentType', 'בונוס'],
    ['SecurityGroup', 'אופציות'],
    ['IsCancelTransaction', 'yes'],
    ['IsUSEquity', 'true'],
    ['IsTradable', 'לא סחיר'],
  ])('rejects an unknown %s and points at the constant to extend', (field, value) => {
    const payload = response([{ ...buy, [field]: value }]);
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(describeSecuritiesTransactionsError(payload, result.error!)).toContain(
      'Known values are',
    );
  });

  // ── ranges ─────────────────────────────────────────────────────────────────

  it.each(['NV', 'TradePrice', 'TradeGrossValueNIS', 'AccumulatedInterest'])(
    'rejects a negative %s',
    field => {
      const result = HapoalimSecuritiesTransactionsSchema.safeParse(
        response([{ ...buy, [field]: -1 }]),
      );
      expect(result.success).toBe(false);
    },
  );

  it('accepts a negative net value — a buy costs money', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(response([buy]));
    expect(result.success).toBe(true);
    expect(result.data?.Account.Execution[0]?.NetValueTradeCurrency).toBe(-1000);
  });

  it('accepts a refunded (negative) commission', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, TradeCommissionValueNIS: -3.7 }]),
    );
    expect(result.success).toBe(true);
  });

  // 23% arrives as 23; 0.23 would mean the bank switched to fractions and every
  // stored tax rate would silently be off by two orders of magnitude.
  it('rejects a percentage above 100', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, IsraelTaxPercent: 101 }]),
    );
    expect(result.success).toBe(false);
  });

  it('accepts the -1 sentinel for PersonalCurrencyRate but not another negative', () => {
    expect(
      HapoalimSecuritiesTransactionsSchema.safeParse(
        response([{ ...buy, PersonalCurrencyRate: -1 }]),
      ).success,
    ).toBe(true);
    expect(
      HapoalimSecuritiesTransactionsSchema.safeParse(
        response([{ ...buy, PersonalCurrencyRate: -3.7 }]),
      ).success,
    ).toBe(false);
  });

  it('rejects a value the bank has only ever sent as null', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, OrderType: 'LIMIT' }]),
    );
    expect(result.success).toBe(false);
  });

  // ── cross-field invariants ─────────────────────────────────────────────────

  it('rejects a TradeType that contradicts its TransactionType', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, TransactionType: 'קניה', TradeType: 'מכירה' }]),
    );
    expect(result.success).toBe(false);
  });

  it.each([
    ['a trade type under a non-trading transaction type', { TransactionType: 'העברות' }],
    ['a non-trading trade type under a buy', { TradeType: 'העברה לחובת הפקדון' }],
  ])('rejects %s', (_label, overrides) => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, ...overrides }]),
    );
    expect(result.success).toBe(false);
  });

  it.each(['PaymentType', 'PaymentDate', 'ExDate'])(
    'rejects a half-filled payment block missing %s',
    field => {
      const result = HapoalimSecuritiesTransactionsSchema.safeParse(
        response([{ ...dividend, [field]: null }]),
      );
      expect(result.success).toBe(false);
    },
  );

  // Whether a transfer carries a payment block is the bank's choice; only
  // consistency within the block is asserted.
  it('accepts a transfer with or without a payment block', () => {
    expect(
      HapoalimSecuritiesTransactionsSchema.safeParse(response([transfer])).success,
    ).toBe(true);
    expect(
      HapoalimSecuritiesTransactionsSchema.safeParse(
        response([
          {
            ...transfer,
            PaymentType: 'פידיון',
            PaymentDate: '2024-02-05T00:00:00.0000000+02:00',
            ExDate: '2024-01-30T00:00:00.0000000+02:00',
          },
        ]),
      ).success,
    ).toBe(true);
  });

  it('rejects a plain trade that carries payment fields', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, PaymentType: 'דיבידנד' }]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a cancelled execution with no CancelDate', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, IsCancelTransaction: 'כן' }]),
    );
    expect(result.success).toBe(false);
  });

  it('accepts a CancelDate on an execution that is not itself cancelled', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, CancelDate: '2024-02-01T00:00:00.0000000+02:00' }]),
    );
    expect(result.success).toBe(true);
  });

  it('rejects account identifiers that disagree with each other', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, FinancialAccountNumber: '999999' }]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a cross-currency settlement', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, SettlementCurrency: 'שקל חדש' }]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects diverging Hebrew and English names', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, HebName: 'אקזמפל' }]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects IsUSEquity that disagrees with the issuer country', () => {
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(
      response([{ ...buy, IssuerCountryCode: 'IL' }]),
    );
    expect(result.success).toBe(false);
  });
});

describe('describeSecuritiesTransactionsError', () => {
  function failureFor(rows: unknown[]) {
    const payload = response(rows);
    const result = HapoalimSecuritiesTransactionsSchema.safeParse(payload);
    return describeSecuritiesTransactionsError(payload, result.error!);
  }

  it('names the security and trade date of the offending execution', () => {
    const message = failureFor([buy, { ...dividend, PaymentDate: null }]);
    expect(message).toContain('Account.Execution.1.PaymentDate');
    expect(message).toContain('[security 1234567, traded 2024-01-15]');
  });

  it('reports how many issues were found', () => {
    expect(failureFor([{ ...buy, NV: -1 }])).toContain('1 issue');
  });

  it('does not repeat the field name after the path', () => {
    const message = failureFor([{ ...buy, NV: -1 }]);
    expect(message).toContain('Account.Execution.0.NV: expected a value of 0 or more');
    expect(message).not.toContain('NV: NV:');
  });

  it('caps the list and says how many were omitted', () => {
    const message = describeSecuritiesTransactionsError(
      response(Array.from({ length: 12 }, () => ({ ...buy, NV: -1 }))),
      HapoalimSecuritiesTransactionsSchema.safeParse(
        response(Array.from({ length: 12 }, () => ({ ...buy, NV: -1 }))),
      ).error!,
      3,
    );
    expect(message).toContain('…and 9 more.');
  });
});
