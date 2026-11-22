import { describe, expect, it } from 'vitest';
import { Currency } from '../../../../shared/enums.js';
import type { LedgerProto, TimelessDateString } from '../../../../shared/types/index.js';
import type { AssetDisposalResult } from '../../../depreciation/helpers/asset-depreciation.helper.js';
import { buildDisposalLedgerEntries } from '../depreciation-disposal-ledger.helper.js';

const ASSET = 'tax-category-computers';
const AD = 'tax-category-accumulated-depreciation';
const GAIN = 'tax-category-disposal-gain';
const LOSS = 'tax-category-disposal-loss';
const CLEARING = 'tax-category-asset-sale-proceeds';
const DATE = '2025-07-01' as TimelessDateString;

function build(result: Partial<AssetDisposalResult>, proceedsAccountId: string | null = ASSET) {
  return buildDisposalLedgerEntries({
    disposal: { id: 'disposal', disposalDate: DATE },
    result: {
      id: 'disposal',
      disposalDate: DATE,
      disposedCost: 0,
      accumulatedDepreciation: 0,
      netBookValue: 0,
      proceeds: 0,
      gainLoss: 0,
      ...result,
    },
    accounts: {
      assetAccountId: ASSET,
      accumulatedDepreciationAccountId: AD,
      proceedsAccountId,
      gainAccountId: GAIN,
      lossAccountId: LOSS,
    },
    chargeId: 'charge',
    ownerId: 'owner',
    currency: Currency.Ils,
  });
}

/** Net debit per account (credit negative) */
function net(entries: LedgerProto[]) {
  const balance = new Map<string, number>();
  for (const entry of entries) {
    balance.set(
      entry.debitAccountID1!,
      (balance.get(entry.debitAccountID1!) ?? 0) + entry.localCurrencyDebitAmount1,
    );
    balance.set(
      entry.creditAccountID1!,
      (balance.get(entry.creditAccountID1!) ?? 0) - entry.localCurrencyCreditAmount1,
    );
  }
  return Object.fromEntries([...balance.entries()].filter(([, amount]) => amount !== 0));
}

describe('buildDisposalLedgerEntries', () => {
  it('books a cost refund as released depreciation and a gain', () => {
    // ₪20,000 refunded on an asset whose refunded slice had ₪5,007 of depreciation
    const { entries, errors } = build({
      disposedCost: 20_000,
      accumulatedDepreciation: 5007,
      netBookValue: 14_993,
      proceeds: 20_000,
      gainLoss: 5007,
    });
    expect(errors).toEqual([]);
    expect(
      entries.map(entry => [
        entry.debitAccountID1,
        entry.creditAccountID1,
        entry.localCurrencyDebitAmount1,
      ]),
    ).toEqual([
      [AD, ASSET, 5007],
      [ASSET, GAIN, 5007],
    ]);
    expect(entries.every(entry => entry.valueDate === DATE && entry.invoiceDate === DATE)).toBe(
      true,
    );
    // the refund charge already credited the asset with the ₪20,000 itself
    expect(net(entries)).toEqual({ [AD]: 5007, [GAIN]: -5007 });
  });

  it('removes the disposed cost from the asset on a sale at a loss', () => {
    const { entries, errors } = build({
      disposedCost: 100_000,
      accumulatedDepreciation: 18_732,
      netBookValue: 81_268,
      proceeds: 50_000,
      gainLoss: -31_268,
    });
    expect(errors).toEqual([]);
    // with the charge's own Cr asset 50,000, the asset is credited the full 100,000
    expect(net(entries)).toEqual({ [AD]: 18_732, [LOSS]: 31_268, [ASSET]: -50_000 });
  });

  it('moves proceeds booked to another account onto the asset', () => {
    const { entries } = build(
      {
        disposedCost: 100_000,
        accumulatedDepreciation: 37_568,
        netBookValue: 62_432,
        proceeds: 70_000,
        gainLoss: 7568,
      },
      CLEARING,
    );
    expect(net(entries)).toEqual({
      [CLEARING]: 70_000,
      [AD]: 37_568,
      [GAIN]: -7568,
      [ASSET]: -100_000,
    });
  });

  it('writes off a fully depreciated asset with no gain or loss', () => {
    const { entries, errors } = build(
      { disposedCost: 10_000, accumulatedDepreciation: 10_000, netBookValue: 0 },
      null,
    );
    expect(errors).toEqual([]);
    expect(net(entries)).toEqual({ [AD]: 10_000, [ASSET]: -10_000 });
  });

  it('reports a missing gain or loss category', () => {
    const result = buildDisposalLedgerEntries({
      disposal: { id: 'disposal', disposalDate: DATE },
      result: {
        id: 'disposal',
        disposalDate: DATE,
        disposedCost: 1000,
        accumulatedDepreciation: 0,
        netBookValue: 1000,
        proceeds: 0,
        gainLoss: -1000,
      },
      accounts: { assetAccountId: ASSET, accumulatedDepreciationAccountId: AD },
      chargeId: 'charge',
      ownerId: 'owner',
      currency: Currency.Ils,
    });
    expect(result.errors).toHaveLength(1);
  });
});
