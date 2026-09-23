import { describe, expect, it } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import { buildSnapshotInput } from '../utils/snapshot.js';

const OWNER = '11111111-1111-1111-1111-111111111111';
const ENTITY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ENTITY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function sum(id: string, raw: number, ledgerFingerprint: string) {
  return { business: { id }, total: { raw }, ledgerFingerprint };
}

describe('buildSnapshotInput', () => {
  const base = {
    fromDate: '2026-01-01' as TimelessDateString,
    toDate: '2026-03-31' as TimelessDateString,
    scopeOwnerId: OWNER,
  };

  it('copies each business ledgerFingerprint into its value', () => {
    const input = buildSnapshotInput({
      ...base,
      businessSums: [sum(ENTITY_A, 100, 'fp-a'), sum(ENTITY_B, -50, 'fp-b')],
    });
    expect(input.values).toEqual([
      { entityId: ENTITY_A, value: -100, fingerprint: 'fp-a' },
      { entityId: ENTITY_B, value: 50, fingerprint: 'fp-b' },
    ]);
  });

  it('carries the period and scope owner through unchanged', () => {
    const input = buildSnapshotInput({ ...base, businessSums: [] });
    expect(input).toEqual({ ...base, values: [] });
  });

  it('includes approvals when given', () => {
    const approvals = [
      { entityId: ENTITY_A, status: AccountantStatus.Approved },
      { entityId: ENTITY_B, status: AccountantStatus.Unapproved },
    ];
    const input = buildSnapshotInput({ ...base, businessSums: [], approvals });
    expect(input.approvals).toEqual(approvals);
  });

  it('includes an empty approvals list when given one', () => {
    const input = buildSnapshotInput({ ...base, businessSums: [], approvals: [] });
    expect(input.approvals).toEqual([]);
  });

  it('omits the approvals key when none are given (Save as new)', () => {
    const input = buildSnapshotInput({ ...base, businessSums: [] });
    expect('approvals' in input).toBe(false);
  });
});
