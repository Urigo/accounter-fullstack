import { describe, expect, it } from 'vitest';
import type { UploadPoalimSecuritiesTransactionsMutationVariables } from '../gql/index.js';
import { poalimSecuritiesTransactionsVars } from '../graphql/mutations.js';
import { PoalimSecuritiesTransactionsPayloadSchema } from '../payload-schemas/poalim-securities-transactions.schema.js';
import type { PoalimSecuritiesTransactionsPayload } from '../payload-schemas/poalim-securities-transactions.schema.js';

const bankAccount = { bankNumber: 12, branchNumber: 615, accountNumber: 100_000 };

/** Codegen types a list input as `T | T[]`; normalise so tests can index it. */
function rows(vars: UploadPoalimSecuritiesTransactionsMutationVariables) {
  return [vars.transactions].flat();
}

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

const dividend = {
  ...buy,
  TransactionType: 'תשלומים ואירועי חברה',
  TradeType: 'דבידנד תשלום',
  PaymentType: 'דיבידנד',
  PaymentDate: '2024-02-05T00:00:00.0000000+02:00',
  ExDate: '2024-01-30T00:00:00.0000000+02:00',
  NV: 0,
  TradePrice: 0,
  ForeignTaxPercent: 30,
  ForeignTaxValueSettlementCurrency: 6.75,
};

/**
 * Parsed rather than cast: the mapper only ever sees validated payloads, so the
 * fixtures have to satisfy the strict payload schema to be worth testing against.
 */
function payload(executions: unknown[]): PoalimSecuritiesTransactionsPayload {
  return PoalimSecuritiesTransactionsPayloadSchema.parse({
    Account: { PageState: 'ZXhhbXBsZQ==', Execution: executions },
  });
}

describe('poalimSecuritiesTransactionsVars', () => {
  it('maps one input row per execution', () => {
    const vars = poalimSecuritiesTransactionsVars(payload([buy, dividend]), bankAccount);
    expect(rows(vars)).toHaveLength(2);
  });

  it('stamps the requested account coordinates on every row', () => {
    const vars = poalimSecuritiesTransactionsVars(payload([buy, dividend]), bankAccount);
    for (const row of rows(vars)) {
      expect(row).toMatchObject({ bankNumber: 12, branchNumber: 615, accountNumber: 100_000 });
    }
  });

  it('maps the identity fields a row is deduplicated on', () => {
    const vars = poalimSecuritiesTransactionsVars(payload([buy]), bankAccount);
    expect(rows(vars)[0]).toMatchObject({
      security: '1234567',
      tradeDate: '2024-01-15T00:00:00.0000000+02:00',
      valueDate: '2024-01-16T00:00:00.0000000+02:00',
      settlementDate: '2024-01-17T00:00:00.0000000+02:00',
      tradeType: 'קניה',
      transactionType: 'קניה',
      nv: 10,
      tradePrice: 100,
      netValueTradeCurrency: -1000,
    });
  });

  it('renames the bank\'s all-caps abbreviations to camelCase', () => {
    const vars = poalimSecuritiesTransactionsVars(payload([buy]), bankAccount);
    expect(rows(vars)[0]).toMatchObject({
      isin: 'US0000000001',
      symbolOsi: 'EXMP US',
      isUsEquity: 'כן',
      tradeGrossValueNis: 3700,
      netValueNis: -3.7,
      nominalProfitLossNis: 0,
      orderedNv: 0,
      executedNv: 0,
    });
  });

  it("keeps the bank's misspelled field names", () => {
    const vars = poalimSecuritiesTransactionsVars(payload([buy]), bankAccount);
    expect(rows(vars)[0]).toMatchObject({
      israeTaxValue: 0,
      peymentPecentage: 0,
      tradeCurrnecyRate: 1,
      lastTranactionDate: '2024-01-15T00:00:00.0000000+02:00',
      fundPlusAccumulatedInerestValue: 1000,
    });
  });

  it('carries the corporate-action fields of a payment row', () => {
    const vars = poalimSecuritiesTransactionsVars(payload([dividend]), bankAccount);
    expect(rows(vars)[0]).toMatchObject({
      tradeType: 'דבידנד תשלום',
      paymentType: 'דיבידנד',
      paymentDate: '2024-02-05T00:00:00.0000000+02:00',
      exDate: '2024-01-30T00:00:00.0000000+02:00',
      foreignTaxValueSettlementCurrency: 6.75,
    });
  });

  it('carries Hebrew security names through unchanged', () => {
    const vars = poalimSecuritiesTransactionsVars(payload([israeliFund]), bankAccount);
    expect(rows(vars)[0]).toMatchObject({
      engName: 'י.ל. כספית כשרה',
      hebName: 'י.ל. כספית כשרה',
      securityGroup: 'קרן נאמנות',
      tradeCurrency: 'שקל חדש',
    });
  });

  it('passes nulls through rather than dropping them', () => {
    const vars = poalimSecuritiesTransactionsVars(payload([buy]), bankAccount);
    expect(rows(vars)[0]).toMatchObject({
      paymentType: null,
      paymentDate: null,
      exDate: null,
      cancelDate: null,
      orderType: null,
      orderSubject: null,
      securitySubGroup: null,
      expiryDate: null,
    });
  });

  it('preserves the false isJumbo flag rather than coercing it to null', () => {
    const vars = poalimSecuritiesTransactionsVars(payload([buy]), bankAccount);
    expect(rows(vars)[0]?.isJumbo).toBe(false);
  });

  it('returns an empty list for a portfolio with no activity', () => {
    const vars = poalimSecuritiesTransactionsVars(payload([]), bankAccount);
    expect(rows(vars)).toEqual([]);
  });
});
