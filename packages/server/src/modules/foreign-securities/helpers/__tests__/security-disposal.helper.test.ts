import { describe, expect, it } from 'vitest';
import type { SecurityExecutionRow } from '../../types.js';
import {
  costBasisProblem,
} from '../security-disposal.helper.js';

/*
 * The arithmetic of a disposal out of FIFO lots. All values are made up.
 */

describe('costBasisProblem', () => {
  const sale = {
    security: '1234567',
    symbol: 'ABC',
    isin: 'US0000000001',
    trade_type: 'מכירה',
    trade_date: '2025-03-01',
    nominal_profit_loss_nis: '0',
  } as unknown as SecurityExecutionRow;
  const complete = {
    redeemedUnits: 10,
    costForeign: 1000,
    coveredUnits: 10,
    unknownCostUnits: 0,
    missingUnits: 0,
    historyStartDate: '2024-01-10' as const,
    openingPositionUnknown: false,
    lots: [],
  };

  it('is null when every unit has a known cost', () => {
    expect(costBasisProblem(sale, complete)).toBeNull();
  });

  it('says a sale is missing purchases', () => {
    expect(
      costBasisProblem(sale, { ...complete, coveredUnits: 6, missingUnits: 4, costForeign: 600 }),
    ).toContain('Could not find the purchase of 4 of 10 units of ABC (US0000000001) sold on 2025-03-01');
  });

  it('says a redemption is missing purchases', () => {
    expect(
      costBasisProblem(
        { ...sale, trade_type: 'פדיון' },
        { ...complete, coveredUnits: 6, missingUnits: 4, costForeign: 600 },
      ),
    ).toContain('redeemed on 2025-03-01');
  });
});
