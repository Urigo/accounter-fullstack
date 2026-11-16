import { describe, expect, it } from 'vitest';
import { pickLatestBaselineId } from '../utils/baseline.js';

const OWNER_A = '00000000-0000-0000-0000-00000000000a';
const OWNER_B = '00000000-0000-0000-0000-00000000000b';

const view = { fromDate: '2025-01-01', toDate: '2025-12-31', scopeOwnerId: OWNER_A };

function snapshot(
  id: string,
  overrides: Partial<{ fromDate: string; toDate: string; scopeOwnerId: string }> = {},
) {
  return { id, ...view, ...overrides };
}

describe('pickLatestBaselineId', () => {
  it('returns null for an empty list', () => {
    expect(pickLatestBaselineId([], view)).toBeNull();
  });

  it('returns the head when it matches the view', () => {
    const snapshots = [snapshot('s3'), snapshot('s2'), snapshot('s1')];
    expect(pickLatestBaselineId(snapshots, view)).toBe('s3');
  });

  it('skips newer snapshots for another period or owner and picks the newest match', () => {
    const snapshots = [
      snapshot('other-from', { fromDate: '2024-01-01' }),
      snapshot('other-to', { toDate: '2025-06-30' }),
      snapshot('other-owner', { scopeOwnerId: OWNER_B }),
      snapshot('match-new'),
      snapshot('match-old'),
    ];
    expect(pickLatestBaselineId(snapshots, view)).toBe('match-new');
  });

  it('requires all three of fromDate, toDate and scopeOwnerId to match exactly', () => {
    const snapshots = [
      snapshot('same-dates-other-owner', { scopeOwnerId: OWNER_B }),
      snapshot('same-owner-half-year', { fromDate: '2025-01-01', toDate: '2025-06-30' }),
    ];
    // Nothing matches (or has the same shape), so the head is the fallback.
    expect(pickLatestBaselineId(snapshots, view)).toBe('same-dates-other-owner');
  });

  it('falls back to the newest snapshot when none matches', () => {
    const snapshots = [
      snapshot('newest', { fromDate: '2024-03-01', toDate: '2024-09-30' }),
      snapshot('older', { scopeOwnerId: OWNER_B }),
    ];
    expect(pickLatestBaselineId(snapshots, view)).toBe('newest');
  });

  describe('same-shape tier', () => {
    const priorBalanceSheet = { fromDate: '1900-01-01', toDate: '2024-12-31' };
    const priorProfitAndLoss = { fromDate: '2024-01-01', toDate: '2024-12-31' };

    it("picks last year's profit and loss over a newer balance sheet for a P&L view", () => {
      const snapshots = [
        snapshot('prior-bs', priorBalanceSheet),
        snapshot('prior-pnl', priorProfitAndLoss),
      ];
      expect(pickLatestBaselineId(snapshots, view)).toBe('prior-pnl');
    });

    it("picks last year's balance sheet over a newer profit and loss for a BS view", () => {
      const bsView = { fromDate: '1900-01-01', toDate: '2025-12-31', scopeOwnerId: OWNER_A };
      const snapshots = [
        snapshot('prior-pnl', priorProfitAndLoss),
        snapshot('prior-bs', priorBalanceSheet),
      ];
      expect(pickLatestBaselineId(snapshots, bsView)).toBe('prior-bs');
    });

    it('prefers an exact match over a newer same-shape snapshot', () => {
      const snapshots = [snapshot('prior-pnl', priorProfitAndLoss), snapshot('exact')];
      expect(pickLatestBaselineId(snapshots, view)).toBe('exact');
    });

    it('ignores same-shape snapshots of another owner', () => {
      const snapshots = [
        snapshot('other-owner-pnl', { ...priorProfitAndLoss, scopeOwnerId: OWNER_B }),
        snapshot('own-pnl', { fromDate: '2023-01-01', toDate: '2023-12-31' }),
      ];
      expect(pickLatestBaselineId(snapshots, view)).toBe('own-pnl');
    });

    it('does not treat a half-year as the same shape as a full year', () => {
      const snapshots = [
        snapshot('half-year', { fromDate: '2024-01-01', toDate: '2024-06-30' }),
        snapshot('prior-pnl', priorProfitAndLoss),
      ];
      expect(pickLatestBaselineId(snapshots, view)).toBe('prior-pnl');
    });
  });
});
