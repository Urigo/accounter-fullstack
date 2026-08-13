import { describe, expect, it, afterEach } from 'vitest';
import { PayloadValidationError, validatePayload } from '../validate-payload.js';
import { _resetRunState, startRun, type ScrapeTask } from '../scrape-runner.js';
import type { ServerMessage } from '../../shared/ws-protocol.js';

// Synthetic values only — never lifted from a real bank capture. Every key the
// executions payload schema asserts, so a test can delete one at a time.
const MINIMAL_EXECUTION: Record<string, unknown> = {
  Security: '1234567',
  TradeDate: '2024-01-15T00:00:00.0000000+02:00',
  ValueDate: '2024-01-16T00:00:00.0000000+02:00',
  SettlementDate: '2024-01-17T00:00:00.0000000+02:00',
  TradeType: 'קניה',
  TransactionType: 'קניה',
  NV: 10,
  TradePrice: 100,
  NetValueTradeCurrency: -1000,
  PaymentType: null,
  PaymentDate: null,
  ExDate: null,
  CancelDate: null,
  Branch: 615,
  Account: 100000,
  AccountName: 'לקוח לדוגמה',
  ExecutingBranch: '615',
  FinancialAccountBranch: '615',
  FinancialAccountNumber: '100000',
  ISIN: 'US0000000001',
  Symbol: 'EXMP',
  SymbolOSI: 'EXMP US',
  EngName: 'EXAMPLE CORP',
  HebName: 'EXAMPLE CORP',
  EngNameFull: 'EXAMPLE CORP',
  HebNameFull: 'EXAMPLE CORP',
  SecurityGroup: 'מניות ניע"ז',
  SecuritySubGroup: null,
  IssueCurrency: 'דולר ארה"ב',
  IssuerCountry: 'ארצות הברית',
  IssuerCountryCode: 'US',
  IssuerExchange: 'NYSE',
  ExchangeCountry: 'ארצות הברית',
  IsTradable: 'סחיר',
  IsUSEquity: 'כן',
  IsJumbo: false,
  ImpliedAssetMult: 1,
  ExpiryDate: null,
  TradeCurrency: 'דולר ארה"ב',
  SettlementCurrency: 'דולר ארה"ב',
  CommissionsCurrency: 'שקל חדש',
  PaymentCurrency: null,
  TradeGrossValueTradeCurrency: 1000,
  TradeGrossValueNIS: 3700,
  NetValueNIS: -3.7,
  NetValueSettlementCurrency: -1000,
  SettlementPrice: 0,
  TradeCommissionPercent: 0.1,
  TradeCommissionValueNIS: 3.7,
  TradeCommissionValueTradeCurrency: 1,
  AgentCommissionValueTradeCurrency: 0,
  ManagementFeesPercent: 0,
  ManagementFeesValueNIS: 0,
  ManagementFeesValueTradeCurrency: 0,
  IsraeTaxValue: 0,
  IsraelTaxPercent: 0,
  IsraelTaxValueByPaymentsSettlementCurrency: 0,
  ForeignTaxPercent: 0,
  ForeignTaxValueSettlementCurrency: 0,
  CapitalTaxPercent: 0,
  CapitalTaxValueSettlementCurrency: 0,
  PostDeductionTaxValueNIS: 0,
  PreviousActionsDeductions: 0,
  PostActionDeductionBalance: 0,
  NominalProfitLossNIS: 0,
  NominalProfitLossLinkage: 0,
  RealProfitLossNIS: 0,
  AccumulatedInterest: 0,
  FundPlusAccumulatedInerestValue: 1000,
  PeymentPecentage: 0,
  PaymentLinkingValue: 0,
  ExDateBalance: 0,
  IssueCurrencyToTradeCurrencyRate: 1,
  TradeCurrnecyRate: 1,
  PersonalCurrencyRate: 3.7,
  PaymentName: null,
  OrderOrigin: null,
  OrderType: null,
  OrderSubject: null,
  OrderedNV: 0,
  ExecutedNV: 0,
  OrderedValue: 0,
  ExecutionDate: '0001-01-01T00:00:00.0000000',
  LastTranactionDate: '2024-01-15T00:00:00.0000000+02:00',
  IsCancelTransaction: 'לא',
};

describe('validatePayload — valid fixtures', () => {
  it('accepts a minimal poalim-ils payload', () => {
    const result = validatePayload('poalim-ils', {
      transactions: [
        {
          activityDescription: 'Credit',
          activityTypeCode: 1,
          eventAmount: 100,
          eventDate: 20240101,
          serialNumber: 1,
          transactionType: 'REGULAR',
          currentBalance: 5000,
          referenceNumber: 12345,
        },
      ],
      retrievalTransactionData: { accountNumber: 100000, branchNumber: 600, bankNumber: 12 },
    });
    expect(result.transactions).toHaveLength(1);
  });

  it('accepts a poalim-ils payload with extra fields (passthrough)', () => {
    const result = validatePayload('poalim-ils', {
      transactions: [],
      retrievalTransactionData: { accountNumber: 1, branchNumber: 2, bankNumber: 12 },
      unknownField: 'should be kept',
    });
    expect((result as Record<string, unknown>)['unknownField']).toBe('should be kept');
  });

  it('accepts a minimal poalim-foreign payload', () => {
    const result = validatePayload('poalim-foreign', {
      balancesAndLimitsDataList: [
        {
          currencySwiftCode: 'USD',
          currencyCode: 1,
          transactions: [],
        },
      ],
    });
    expect(result.balancesAndLimitsDataList).toHaveLength(1);
  });

  it('accepts a minimal poalim-swift payload', () => {
    const result = validatePayload('poalim-swift', { swiftsList: [] });
    expect(result.swiftsList).toHaveLength(0);
  });

  it('accepts a minimal poalim-securities-info payload', () => {
    const result = validatePayload('poalim-securities-info', {
      View: { Meta: { '-AsOfDate': '2024-01-15T10:00:00.000+02:00', Security: [] } },
    });
    expect(result.View.Meta.Security).toHaveLength(0);
  });

  it('accepts a poalim-securities-info payload alongside unmodelled View siblings', () => {
    const result = validatePayload('poalim-securities-info', {
      View: {
        Account: { OnlineValue: 1 },
        Orders: { Rezef: { Order: [] } },
        Meta: {
          '-AsOfDate': '2024-01-15T10:00:00.000+02:00',
          Security: [
            {
              '-Key': '1234567',
              EngName: 'Example Corp',
              HebName: 'אקזמפל',
              ItemType: 'Equity',
              IsEtf: false,
              IsForeign: true,
              CurrencyCode: 'USD',
              Exchange: 'NYQ',
              EquityType: 1,
              AllowedOrderDirection: 'BuyAndSell',
              EquitySubType: 1,
              EngSymbol: 'EXMP',
              HebSymbol: 'EXMP',
              Symbol: 'EXMP',
              ExpirationDate: null,
              StockType: 'Equity',
              CreationEquityNum: null,
              ContractType: null,
            },
          ],
        },
      },
    });
    expect(result.View.Meta.Security[0]?.['-Key']).toBe('1234567');
  });

  it('defaults a missing Security array to [] (account with no portfolio)', () => {
    const result = validatePayload('poalim-securities-info', {
      View: { Meta: { '-AsOfDate': '2024-01-15T10:00:00.000+02:00' } },
    });
    expect(result.View.Meta.Security).toEqual([]);
  });

  it('rejects a poalim-securities-info payload with no Meta', () => {
    expect(() => validatePayload('poalim-securities-info', { View: { Account: {} } })).toThrow();
  });

  // Every field the vars mapper reads must be asserted; a `.loose()` gap would
  // type it `unknown` and ship it to the mutation unchecked.
  it.each([
    'IsEtf',
    'AllowedOrderDirection',
    'EngSymbol',
    'HebSymbol',
    'Symbol',
    'ExpirationDate',
    'StockType',
    'CreationEquityNum',
    'ContractType',
  ])('rejects a poalim-securities-info security missing %s', field => {
    const security: Record<string, unknown> = {
      '-Key': '1234567',
      EngName: 'Example Corp',
      HebName: 'אקזמפל',
      ItemType: 'Equity',
      IsEtf: false,
      IsForeign: true,
      CurrencyCode: 'USD',
      Exchange: 'NYQ',
      EquityType: 1,
      AllowedOrderDirection: 'BuyAndSell',
      EquitySubType: 1,
      EngSymbol: 'EXMP',
      HebSymbol: 'EXMP',
      Symbol: 'EXMP',
      ExpirationDate: null,
      StockType: 'Equity',
      CreationEquityNum: null,
      ContractType: null,
    };
    delete security[field];
    expect(() =>
      validatePayload('poalim-securities-info', {
        View: { Meta: { '-AsOfDate': '2024-01-15T10:00:00.000+02:00', Security: [security] } },
      }),
    ).toThrow();
  });

  it('accepts a minimal poalim-securities-transactions payload', () => {
    const result = validatePayload('poalim-securities-transactions', {
      Account: { PageState: 'ZXhhbXBsZQ==', Execution: [] },
    });
    expect(result.Account.Execution).toHaveLength(0);
  });

  it('defaults a missing Execution array to [] (no activity in range)', () => {
    const result = validatePayload('poalim-securities-transactions', {
      Account: { PageState: 'ZXhhbXBsZQ==' },
    });
    expect(result.Account.Execution).toEqual([]);
  });

  it('rejects a poalim-securities-transactions payload with no Account', () => {
    expect(() => validatePayload('poalim-securities-transactions', { View: {} })).toThrow();
  });

  it('accepts a well-formed execution', () => {
    const result = validatePayload('poalim-securities-transactions', {
      Account: { Execution: [MINIMAL_EXECUTION] },
    });
    expect(result.Account.Execution).toHaveLength(1);
  });

  // Every field the vars mapper reads must be asserted; a gap would type it
  // `unknown` and ship it to the mutation unchecked.
  it.each(Object.keys(MINIMAL_EXECUTION))(
    'rejects a poalim-securities-transactions execution missing %s',
    field => {
      const execution: Record<string, unknown> = { ...MINIMAL_EXECUTION };
      delete execution[field];
      expect(() =>
        validatePayload('poalim-securities-transactions', { Account: { Execution: [execution] } }),
      ).toThrow();
    },
  );

  it('rejects an unmodelled field rather than passing it through unchecked', () => {
    expect(() =>
      validatePayload('poalim-securities-transactions', {
        Account: { Execution: [{ ...MINIMAL_EXECUTION, SomeNewBankField: 1 }] },
      }),
    ).toThrow(/SomeNewBankField/);
  });

  it.each([
    ['an unknown currency', { TradeCurrency: 'אירו', SettlementCurrency: 'אירו' }],
    ['an unknown transaction type', { TransactionType: 'העברה' }],
    ['a malformed ISIN', { ISIN: 'US123' }],
    ['a malformed timestamp', { TradeDate: '2024-01-15' }],
    ['a negative quantity', { NV: -1 }],
    ['a tax rate expressed as a fraction above 100', { IsraelTaxPercent: 120 }],
    ['a value the bank only ever sends as null', { OrderType: 'LIMIT' }],
    ['a trade type contradicting the transaction type', { TradeType: 'מכירה' }],
    ['a non-trading trade type on a buy', { TradeType: 'העברה לחובת הפקדון' }],
    ['payment fields on a plain trade', { PaymentType: 'דיבידנד' }],
    ['a cancelled flag with no cancel date', { IsCancelTransaction: 'כן' }],
    ['an account number disagreeing with Account', { FinancialAccountNumber: '999999' }],
  ])('rejects %s', (_label, overrides) => {
    expect(() =>
      validatePayload('poalim-securities-transactions', {
        Account: { Execution: [{ ...MINIMAL_EXECUTION, ...overrides }] },
      }),
    ).toThrow(PayloadValidationError);
  });

  it('accepts a two-sided deposit transfer under the העברות category', () => {
    const result = validatePayload('poalim-securities-transactions', {
      Account: {
        Execution: [
          {
            ...MINIMAL_EXECUTION,
            TransactionType: 'העברות',
            TradeType: 'העברה לחובת הפקדון (דו צדדית)',
            NV: 0,
            TradePrice: 0,
          },
        ],
      },
    });
    expect(result.Account.Execution).toHaveLength(1);
  });

  it('reports the failing field, the value and the fix', () => {
    try {
      validatePayload('poalim-securities-transactions', {
        Account: { Execution: [{ ...MINIMAL_EXECUTION, TradeCurrency: 'אירו' }] },
      });
      expect.unreachable('expected the payload to be rejected');
    } catch (error) {
      const { message } = error as PayloadValidationError;
      expect(message).toContain('poalim-securities-transactions');
      expect(message).toContain('Account.Execution.0.TradeCurrency');
      expect(message).toContain('"אירו"');
      expect(message).toContain('Known values are');
      // The path already names the field; the message must not repeat it.
      expect(message).not.toContain('TradeCurrency: TradeCurrency:');
    }
  });

  it('caps a long issue list instead of dumping every row', () => {
    const executions = Array.from({ length: 15 }, () => ({ ...MINIMAL_EXECUTION, NV: -1 }));
    try {
      validatePayload('poalim-securities-transactions', { Account: { Execution: executions } });
      expect.unreachable('expected the payload to be rejected');
    } catch (error) {
      const { message } = error as PayloadValidationError;
      expect(message).toContain('15 issues');
      expect(message).toContain('…and 5 more.');
    }
  });

  it('accepts a minimal isracard payload', () => {
    const result = validatePayload('isracard', {
      Header: { Status: '1', Message: null },
      CardsTransactionsListBean: {
        cardNumberList: ['012345'],
        Index0: { '@AllCards': 'AllCards', CurrentCardTransactions: [] },
      },
    });
    expect(result.Header.Status).toBe('1');
  });

  it('accepts amex with the same shape as isracard', () => {
    const result = validatePayload('amex', {
      Header: { Status: '1', Message: null },
      CardsTransactionsListBean: {
        cardNumberList: ['343434'],
        Index0: { '@AllCards': 'AllCards', CurrentCardTransactions: [] },
      },
    });
    expect(result.Header.Status).toBe('1');
  });

  it('accepts a minimal cal payload', () => {
    const result = validatePayload('cal', [
      { card: '1234', month: '2024-01', transactions: [] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.card).toBe('1234');
  });

  it('accepts a minimal discount payload', () => {
    const result = validatePayload('discount', [
      { accountNumber: 'ACC-001', month: '2024-01', balance: 5000, transactions: [] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.accountNumber).toBe('ACC-001');
    expect(result[0]!.balance).toBe(5000);
  });

  it('accepts a minimal max payload', () => {
    const result = validatePayload('max', [{ accountNumber: '1234', txns: [] }]);
    expect(result).toHaveLength(1);
    expect(result[0]!.accountNumber).toBe('1234');
  });

  it('accepts an empty max payload', () => {
    const result = validatePayload('max', []);
    expect(result).toEqual([]);
  });

  it('accepts a currency-rates payload', () => {
    const result = validatePayload('currency-rates', [
      { date: '2024-01-01', currency: 'USD', rate: 3.712 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.currency).toBe('USD');
  });
});

describe('validatePayload — invalid fixtures', () => {
  it('throws PayloadValidationError for wrong transactions type in poalim-ils', () => {
    expect(() =>
      validatePayload('poalim-ils', {
        transactions: 'not-an-array',
        retrievalTransactionData: { accountNumber: 1, branchNumber: 2, bankNumber: 12 },
      }),
    ).toThrow(PayloadValidationError);
  });

  it('error message includes the payload type', () => {
    try {
      validatePayload('poalim-ils', { transactions: 42 });
    } catch (e) {
      expect(e).toBeInstanceOf(PayloadValidationError);
      expect((e as PayloadValidationError).message).toContain('poalim-ils');
      expect((e as PayloadValidationError).payloadType).toBe('poalim-ils');
    }
  });

  it('throws for missing required field in discount payload', () => {
    expect(() =>
      validatePayload('discount', [
        { accountNumber: 'ACC-001', month: '2024-01' }, // missing balance and transactions
      ]),
    ).toThrow(PayloadValidationError);
  });

  it('throws for invalid transaction type in poalim-ils', () => {
    expect(() =>
      validatePayload('poalim-ils', {
        transactions: [
          {
            activityDescription: 'X',
            activityTypeCode: 1,
            eventAmount: 100,
            eventDate: 20240101,
            serialNumber: 1,
            transactionType: 'INVALID_TYPE',
            currentBalance: 5000,
            referenceNumber: 1,
          },
        ],
        retrievalTransactionData: { accountNumber: 1, branchNumber: 2, bankNumber: 12 },
      }),
    ).toThrow(PayloadValidationError);
  });

  it('throws for wrong currency in currency-rates', () => {
    expect(() =>
      validatePayload('currency-rates', [{ date: '2024-01-01', currency: 'XYZ', rate: 1.0 }]),
    ).toThrow(PayloadValidationError);
  });
});

describe('runner integration — task-error on PayloadValidationError', () => {
  afterEach(() => {
    _resetRunState();
  });

  it('emits task-error (not a crash) when validatePayload throws inside run()', async () => {
    const events: ServerMessage[] = [];

    const task: ScrapeTask = {
      sourceId: 'bad-src',
      nickname: 'bad-src',
      type: 'poalim',
      run: async () => {
        // Deliberately pass invalid data to trigger PayloadValidationError
        validatePayload('poalim-ils', { transactions: 'not-an-array' });
        return {
          inserted: 0,
          skipped: 0,
          insertedIds: [],
          insertedTransactions: [],
          changedTransactions: [],
        };
      },
    };

    await startRun([task], false, msg => events.push(msg));

    const taskError = events.find(e => e.type === 'task-error');
    expect(taskError).toBeTruthy();
    expect((taskError as { sourceId: string }).sourceId).toBe('bad-src');
    expect(events.at(-1)).toMatchObject({ type: 'run-complete', totalInserted: 0, totalSkipped: 0 });
  });
});
