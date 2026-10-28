import { describe, expect, it } from 'vitest';
import {
  calculateSecurityPosition,
  isOpenPosition,
  type PositionExecution,
} from '../security-position.helper.js';

let nextId = 0;

function execution(overrides: Partial<PositionExecution> = {}): PositionExecution {
  nextId += 1;
  return {
    id: `execution-${nextId}`,
    trade_date: '2024-03-10',
    trade_type: 'קניה',
    security: '1111111',
    is_cancel_transaction: 'לא',
    nv: '10',
    trade_gross_value_trade_currency: null,
    net_value_trade_currency: '-1000.00',
    net_value_settlement_currency: null,
    net_value_nis: null,
    trade_currency: 'דולר ארה"ב',
    settlement_currency: 'דולר ארה"ב',
    bank_number: 12,
    branch_number: 600,
    account_number: 111111,
    ...overrides,
  };
}

describe('calculateSecurityPosition', () => {
  it('is empty with no executions', () => {
    const position = calculateSecurityPosition([]);

    expect(position.quantity).toBe(0);
    expect(position.averageCost).toBeNull();
    expect(position.historyStartDate).toBeNull();
    // No currency means no amount can be reported: the resolver returns null rather than
    // letting formatFinancialAmount fall back to the local currency and claim ILS 0.
    expect(position.currency).toBeNull();
  });

  it('adds bought units and subtracts sold ones', () => {
    const position = calculateSecurityPosition([
      execution({ nv: '10' }),
      execution({ nv: '4', trade_type: 'מכירה', net_value_trade_currency: '480.00' }),
    ]);

    expect(position.quantity).toBe(6);
  });

  it('averages what was paid per unit bought', () => {
    const position = calculateSecurityPosition([
      execution({ nv: '10', net_value_trade_currency: '-1000.00' }),
      execution({ nv: '10', net_value_trade_currency: '-1400.00' }),
    ]);

    expect(position.averageCost).toBe(120);
    expect(position.totalBought).toBe(2400);
  });

  it('leaves the position untouched for cash-only actions', () => {
    const position = calculateSecurityPosition([
      execution({ nv: '10' }),
      execution({ nv: '0', trade_type: 'דבידנד תשלום', net_value_trade_currency: '22.50' }),
      execution({ nv: '0', trade_type: 'ריבית תשלום', net_value_trade_currency: '5.00' }),
    ]);

    expect(position.quantity).toBe(10);
    expect(position.totalSold).toBe(0);
  });

  it('follows deposit transfers in and out', () => {
    const position = calculateSecurityPosition([
      execution({ nv: '10', trade_type: 'העברה לזכות הפקדון' }),
      execution({ nv: '3', trade_type: 'העברה לחובת הפקדון' }),
      execution({ nv: '2', trade_type: 'הטבה חלוקת מניות' }),
    ]);

    expect(position.quantity).toBe(9);
  });

  it('counts a redemption as leaving the holding, and as proceeds', () => {
    const position = calculateSecurityPosition([
      execution({ nv: '10' }),
      execution({ nv: '10', trade_type: 'פדיון', net_value_trade_currency: '1050.00' }),
    ]);

    expect(position.quantity).toBe(0);
    expect(position.totalSold).toBe(1050);
  });

  it('leaves out a cancelled buy the bank reports as a sale', () => {
    const position = calculateSecurityPosition([
      execution({ nv: '10', net_value_trade_currency: '-1000.00' }),
      execution({ trade_date: '2024-04-01', nv: '5', net_value_trade_currency: '-600.00' }),
      execution({
        trade_date: '2024-04-01',
        trade_type: 'מכירה',
        is_cancel_transaction: 'כן',
        nv: '5',
        net_value_trade_currency: '600.00',
      }),
    ]);

    expect(position.quantity).toBe(10);
    expect(position.totalBought).toBe(1000);
    expect(position.totalSold).toBe(0);
    expect(position.averageCost).toBe(100);
  });

  it('leaves out a cancelled sale reported with its values negated', () => {
    const position = calculateSecurityPosition([
      execution({ nv: '10' }),
      execution({
        trade_date: '2024-04-01',
        trade_type: 'מכירה',
        nv: '4',
        net_value_trade_currency: '480.00',
      }),
      execution({
        trade_date: '2024-04-02',
        trade_type: 'מכירה',
        is_cancel_transaction: 'כן',
        nv: '-4',
        net_value_trade_currency: '-480.00',
      }),
    ]);

    expect(position.quantity).toBe(10);
    expect(position.totalSold).toBe(0);
  });

  it('still dates its history from a cancelled execution', () => {
    const position = calculateSecurityPosition([
      execution({ trade_date: '2024-01-05', nv: '5', net_value_trade_currency: '-600.00' }),
      execution({
        trade_date: '2024-01-05',
        trade_type: 'מכירה',
        is_cancel_transaction: 'כן',
        nv: '5',
        net_value_trade_currency: '600.00',
      }),
      execution({ trade_date: '2024-03-10' }),
    ]);

    expect(position.historyStartDate).toBe('2024-01-05');
    expect(position.quantity).toBe(10);
  });

  it('reports the span the derivation is based on, whatever order rows arrive in', () => {
    const position = calculateSecurityPosition([
      execution({ trade_date: '2024-06-01' }),
      execution({ trade_date: '2023-02-15' }),
      execution({ trade_date: '2024-01-20' }),
    ]);

    expect(position.historyStartDate).toBe('2023-02-15');
    expect(position.lastExecutionDate).toBe('2024-06-01');
  });

  it('carries the currency the executions are quoted in', () => {
    expect(calculateSecurityPosition([execution()]).currency).toBe('דולר ארה"ב');
  });
});

describe('isOpenPosition', () => {
  it('reads an untouched security as closed', () => {
    expect(isOpenPosition(calculateSecurityPosition([]))).toBe(false);
  });

  it('reads a fully sold fractional holding as closed despite the float residue', () => {
    // Fractional units are the norm for ETFs and mutual funds, and summing them does not land
    // back on zero — which is the whole reason the predicate needs an epsilon.
    const position = calculateSecurityPosition([
      execution({ nv: '0.1' }),
      execution({ nv: '0.2' }),
      execution({ nv: '0.3', trade_type: 'מכירה', net_value_trade_currency: '30.00' }),
    ]);

    expect(position.quantity).not.toBe(0);
    expect(isOpenPosition(position)).toBe(false);
  });

  it('reads a holding still visible at four decimals as open', () => {
    expect(isOpenPosition({ quantity: 0.0001 })).toBe(true);
  });

  it('reads a residue below the printed precision as closed', () => {
    expect(isOpenPosition({ quantity: 5e-7 })).toBe(false);
  });

  it('reads a negative holding as open, since it means the history starts mid-life', () => {
    expect(isOpenPosition({ quantity: -5 })).toBe(true);
  });
});
