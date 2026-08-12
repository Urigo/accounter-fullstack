import { describe, expect, it } from 'vitest';
import { HapoalimSecuritiesSchema } from '../hapoalim-securities-schema.js';

// Synthetic fixtures only — never lifted from a real bank capture.
const equity = {
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

// The bank sends nulls rather than omitting keys; local funds have no symbols.
const fund = {
  ...equity,
  '-Key': '7654321',
  EngName: 'Example Fund',
  ItemType: 'Fund',
  IsEtf: null,
  IsForeign: false,
  CurrencyCode: 'ILS',
  Exchange: '',
  EquityType: 5,
  AllowedOrderDirection: null,
  EquitySubType: 12,
  EngSymbol: null,
  HebSymbol: null,
  Symbol: null,
  StockType: null,
};

function response(securities: unknown[], extra: Record<string, unknown> = {}) {
  return {
    View: {
      Meta: { '-AsOfDate': '2024-01-15T17:14:14.1886720+02:00', Security: securities },
      ...extra,
    },
  };
}

describe('HapoalimSecuritiesSchema', () => {
  it('accepts a fully-populated security', () => {
    const result = HapoalimSecuritiesSchema.safeParse(response([equity]));
    expect(result.success).toBe(true);
    expect(result.data?.View.Meta.Security).toHaveLength(1);
  });

  it('accepts nulls on every nullable field', () => {
    const result = HapoalimSecuritiesSchema.safeParse(response([fund]));
    expect(result.success).toBe(true);
    expect(result.data?.View.Meta.Security[0]?.AllowedOrderDirection).toBeNull();
  });

  it('accepts an empty securities list', () => {
    const result = HapoalimSecuritiesSchema.safeParse(response([]));
    expect(result.success).toBe(true);
  });

  it('preserves unmodelled View siblings (Account, Orders) rather than rejecting them', () => {
    const result = HapoalimSecuritiesSchema.safeParse(
      response([equity], { Account: { OnlineValue: 1 }, Orders: { Rezef: { Order: [] } } }),
    );
    expect(result.success).toBe(true);
    expect(result.data?.View).toHaveProperty('Account');
    expect(result.data?.View).toHaveProperty('Orders');
  });

  it('rejects an unknown key on a security, so bank-side additions surface', () => {
    const result = HapoalimSecuritiesSchema.safeParse(
      response([{ ...equity, SomeNewBankField: 'x' }]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a security missing a required field', () => {
    const { EngName: _dropped, ...withoutEngName } = equity;
    const result = HapoalimSecuritiesSchema.safeParse(response([withoutEngName]));
    expect(result.success).toBe(false);
  });

  it('rejects a response without Meta', () => {
    const result = HapoalimSecuritiesSchema.safeParse({ View: { Account: {} } });
    expect(result.success).toBe(false);
  });
});
