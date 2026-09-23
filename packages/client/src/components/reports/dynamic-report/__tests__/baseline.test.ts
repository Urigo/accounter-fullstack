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

  it('requires all three of fromDate, toDate and scopeOwnerId to match', () => {
    const snapshots = [
      snapshot('same-dates-other-owner', { scopeOwnerId: OWNER_B }),
      snapshot('same-owner-other-period', { fromDate: '2024-01-01', toDate: '2024-12-31' }),
    ];
    // Nothing matches, so the head is the fallback, not the owner-matching one.
    expect(pickLatestBaselineId(snapshots, view)).toBe('same-dates-other-owner');
  });

  it('falls back to the newest snapshot when none matches', () => {
    const snapshots = [
      snapshot('newest', { fromDate: '2024-01-01', toDate: '2024-12-31' }),
      snapshot('older', { scopeOwnerId: OWNER_B }),
    ];
    expect(pickLatestBaselineId(snapshots, view)).toBe('newest');
  });
});
