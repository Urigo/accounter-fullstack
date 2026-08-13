import { describe, expect, it } from 'vitest';
import type { UploadPoalimSecuritiesMutationVariables } from '../gql/index.js';
import { poalimSecuritiesInfoVars } from '../graphql/mutations.js';
import type { PoalimSecuritiesInfoPayload } from '../payload-schemas/poalim-securities-info.schema.js';

const bankAccount = { bankNumber: 12, branchNumber: 615, accountNumber: 100000 };

/** Codegen types a list input as `T | T[]`; normalise so tests can index it. */
function rows(vars: UploadPoalimSecuritiesMutationVariables) {
  return [vars.securities].flat();
}

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

// A local fund: the bank sends nulls rather than omitting the keys.
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

const asOfDate = '2024-01-15T17:14:14.1886720+02:00';

function payload(securities: unknown[]): PoalimSecuritiesInfoPayload {
  return {
    View: { Meta: { '-AsOfDate': asOfDate, Security: securities } },
  } as unknown as PoalimSecuritiesInfoPayload;
}

describe('poalimSecuritiesInfoVars', () => {
  it('maps one input row per security', () => {
    const vars = poalimSecuritiesInfoVars(payload([equity, fund]), bankAccount);
    expect(rows(vars)).toHaveLength(2);
  });

  it('stamps account coordinates, which the response body does not carry', () => {
    const vars = poalimSecuritiesInfoVars(payload([equity]), bankAccount);
    expect(rows(vars)[0]).toMatchObject({
      bankNumber: 12,
      branchNumber: 615,
      accountNumber: 100000,
    });
  });

  it('applies the shared -AsOfDate to every row', () => {
    const vars = poalimSecuritiesInfoVars(payload([equity, fund]), bankAccount);
    expect(rows(vars).map(s => s.asOfDate)).toEqual([asOfDate, asOfDate]);
  });

  it('renames the -Key field to securityKey', () => {
    const vars = poalimSecuritiesInfoVars(payload([equity]), bankAccount);
    expect(rows(vars)[0]?.securityKey).toBe('1234567');
  });

  it('maps every source field to its camelCase input field', () => {
    const vars = poalimSecuritiesInfoVars(payload([equity]), bankAccount);
    expect(rows(vars)[0]).toMatchObject({
      engName: 'Example Corp',
      hebName: 'אקזמפל',
      itemType: 'Equity',
      isEtf: false,
      isForeign: true,
      currencyCode: 'USD',
      exchange: 'NYQ',
      equityType: 1,
      allowedOrderDirection: 'BuyAndSell',
      equitySubType: 1,
      engSymbol: 'EXMP',
      hebSymbol: 'EXMP',
      symbol: 'EXMP',
      stockType: 'Equity',
    });
  });

  it('passes nulls through rather than dropping them', () => {
    const vars = poalimSecuritiesInfoVars(payload([fund]), bankAccount);
    expect(rows(vars)[0]).toMatchObject({
      isEtf: null,
      allowedOrderDirection: null,
      engSymbol: null,
      hebSymbol: null,
      symbol: null,
      stockType: null,
      expirationDate: null,
      creationEquityNum: null,
      contractType: null,
    });
  });

  it('preserves an empty-string exchange rather than coercing it to null', () => {
    const vars = poalimSecuritiesInfoVars(payload([fund]), bankAccount);
    expect(rows(vars)[0]?.exchange).toBe('');
  });

  it('returns an empty list for a portfolio with no securities', () => {
    const vars = poalimSecuritiesInfoVars(payload([]), bankAccount);
    expect(rows(vars)).toEqual([]);
  });
});
