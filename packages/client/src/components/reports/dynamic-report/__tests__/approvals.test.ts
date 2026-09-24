import { describe, expect, it } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import {
  branchApprovalTooltip,
  branchStatus,
  buildApprovalStats,
  deriveLeafStatuses,
  formatApprovalDate,
  leafApprovalTooltip,
  type DynamicReportLeafApproval,
} from '../utils/approvals.js';
import type { CustomData, FlatNode } from '../utils/types.js';

const SET_AT = '2026-03-01T10:00:00.000Z';

function leaf(
  id: string,
  parent: string,
  overrides: Partial<CustomData> = {},
): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: id,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value: 100, ...overrides },
  };
}

function branch(id: string, parent: string): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: id,
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: true },
  };
}

function approval(
  entityId: string,
  status: AccountantStatus,
  overrides: Partial<DynamicReportLeafApproval> = {},
): DynamicReportLeafApproval {
  return { entityId, status, setAt: SET_AT, setBy: 'Dana', isSystem: false, ...overrides };
}

describe('deriveLeafStatuses', () => {
  it('keeps a stored status whose fingerprint still matches, with its attribution', () => {
    const tree = [leaf('a', 'report', { fingerprint: 'fp-a' })];
    const result = deriveLeafStatuses(
      tree,
      [approval('a', AccountantStatus.Approved)],
      new Map([['a', 'fp-a']]),
    );
    expect(result.get('a')).toEqual({
      status: AccountantStatus.Approved,
      setAt: SET_AT,
      setBy: 'Dana',
      isSystem: false,
    });
  });

  it('turns a stored APPROVED into a derived PENDING when the fingerprint changed', () => {
    const tree = [leaf('a', 'report', { fingerprint: 'fp-new' })];
    const result = deriveLeafStatuses(
      tree,
      [approval('a', AccountantStatus.Approved)],
      new Map([['a', 'fp-old']]),
    );
    expect(result.get('a')).toMatchObject({
      status: AccountantStatus.Pending,
      isDerived: true,
      setBy: 'Dana',
    });
  });

  it('keeps a stored APPROVED when the baseline has no fingerprint for the leaf (legacy)', () => {
    const tree = [leaf('a', 'report', { fingerprint: 'fp-new' })];
    const result = deriveLeafStatuses(tree, [approval('a', AccountantStatus.Approved)], new Map());
    expect(result.get('a')?.status).toBe(AccountantStatus.Approved);
    expect(result.get('a')?.isDerived).toBeUndefined();
  });

  it('does not derive anything from a changed fingerprint on non-approved statuses', () => {
    const tree = [
      leaf('p', 'report', { fingerprint: 'fp-new' }),
      leaf('u', 'report', { fingerprint: 'fp-new' }),
    ];
    const result = deriveLeafStatuses(
      tree,
      [approval('p', AccountantStatus.Pending), approval('u', AccountantStatus.Unapproved)],
      new Map([
        ['p', 'fp-old'],
        ['u', 'fp-old'],
      ]),
    );
    expect(result.get('p')).toMatchObject({ status: AccountantStatus.Pending });
    expect(result.get('p')?.isDerived).toBeUndefined();
    expect(result.get('u')).toMatchObject({ status: AccountantStatus.Unapproved });
  });

  it('gives UNAPPROVED to a leaf with no stored entry', () => {
    const tree = [leaf('a', 'report'), leaf('b', 'report')];
    const result = deriveLeafStatuses(tree, [approval('a', AccountantStatus.Approved)], new Map());
    expect(result.get('b')).toEqual({ status: AccountantStatus.Unapproved });
  });

  it('gives UNAPPROVED to every leaf when there is no approvals list', () => {
    const tree = [branch('x', 'report'), leaf('a', 'x'), leaf('b', 'report')];
    const result = deriveLeafStatuses(tree, null, new Map());
    expect([...result.entries()]).toEqual([
      ['a', { status: AccountantStatus.Unapproved }],
      ['b', { status: AccountantStatus.Unapproved }],
    ]);
  });

  it('leaves out hidden leaves and branches', () => {
    const tree = [branch('x', 'report'), leaf('a', 'x'), leaf('h', 'x', { isHidden: true })];
    const result = deriveLeafStatuses(tree, [approval('h', AccountantStatus.Approved)], new Map());
    expect(result.has('h')).toBe(false);
    expect(result.has('x')).toBe(false);
    expect(result.has('a')).toBe(true);
  });

  it('counts a leaf that nets to zero', () => {
    const tree = [leaf('z', 'report', { value: 0 })];
    const result = deriveLeafStatuses(tree, null, new Map());
    expect(result.has('z')).toBe(true);
  });
});

describe('buildApprovalStats', () => {
  const statuses = new Map<string, AccountantStatus>([
    ['a', AccountantStatus.Approved],
    ['b', AccountantStatus.Pending],
    ['c', AccountantStatus.Unapproved],
    ['d', AccountantStatus.Approved],
  ]);
  const statusOf = (id: string) => statuses.get(id);

  it('rolls counts up through nested branches', () => {
    const tree = [
      branch('top', 'report'),
      branch('mid', 'top'),
      leaf('a', 'mid'),
      leaf('b', 'mid'),
      leaf('c', 'top'),
      leaf('d', 'report'),
    ];
    const stats = buildApprovalStats(tree, statusOf);
    expect(stats.get('mid')).toEqual({ approved: 1, pending: 1, unapproved: 0 });
    expect(stats.get('top')).toEqual({ approved: 1, pending: 1, unapproved: 1 });
    expect(stats.get('d')).toEqual({ approved: 1, pending: 0, unapproved: 0 });
  });

  it('skips hidden leaves', () => {
    const tree = [branch('top', 'report'), leaf('a', 'top'), leaf('c', 'top', { isHidden: true })];
    const stats = buildApprovalStats(tree, statusOf);
    expect(stats.get('top')).toEqual({ approved: 1, pending: 0, unapproved: 0 });
    expect(stats.has('c')).toBe(false);
  });

  it('counts a leaf with no known status as unapproved', () => {
    const tree = [branch('top', 'report'), leaf('unknown', 'top')];
    expect(buildApprovalStats(tree, statusOf).get('top')).toEqual({
      approved: 0,
      pending: 0,
      unapproved: 1,
    });
  });

  it('gives an empty branch zero counts', () => {
    const stats = buildApprovalStats([branch('empty', 'report')], statusOf);
    expect(stats.get('empty')).toEqual({ approved: 0, pending: 0, unapproved: 0 });
  });
});

describe('branchStatus', () => {
  it('is UNAPPROVED when any leaf is unapproved', () => {
    expect(branchStatus({ approved: 5, pending: 2, unapproved: 1 })).toBe(
      AccountantStatus.Unapproved,
    );
  });

  it('is PENDING when none is unapproved but some are pending', () => {
    expect(branchStatus({ approved: 5, pending: 1, unapproved: 0 })).toBe(AccountantStatus.Pending);
  });

  it('is APPROVED when all are approved', () => {
    expect(branchStatus({ approved: 3, pending: 0, unapproved: 0 })).toBe(
      AccountantStatus.Approved,
    );
  });

  it('is null when there are no counted leaves', () => {
    expect(branchStatus({ approved: 0, pending: 0, unapproved: 0 })).toBeNull();
    expect(branchStatus(undefined)).toBeNull();
  });
});

describe('leafApprovalTooltip', () => {
  const date = formatApprovalDate(SET_AT);

  it('attributes a user stamp', () => {
    expect(leafApprovalTooltip({ status: AccountantStatus.Approved, setAt: SET_AT, setBy: 'Dana' })).toBe(
      `Approved by Dana · ${date}`,
    );
    expect(
      leafApprovalTooltip({ status: AccountantStatus.Unapproved, setAt: SET_AT, setBy: 'Dana' }),
    ).toBe(`Marked unapproved by Dana · ${date}`);
  });

  it('names a former user when the stamp has no resolvable name', () => {
    expect(
      leafApprovalTooltip({
        status: AccountantStatus.Pending,
        setAt: SET_AT,
        setBy: null,
        isSystem: false,
      }),
    ).toBe(`Marked pending by a former user · ${date}`);
  });

  it('explains a system stamp', () => {
    expect(
      leafApprovalTooltip({
        status: AccountantStatus.Pending,
        setAt: SET_AT,
        setBy: null,
        isSystem: true,
      }),
    ).toBe(`Returned to pending · ledger changed after approval · ${date}`);
  });

  it('explains a derived regression that has not been saved yet', () => {
    expect(
      leafApprovalTooltip({
        status: AccountantStatus.Pending,
        setAt: SET_AT,
        setBy: 'Dana',
        isSystem: false,
        isDerived: true,
      }),
    ).toBe(`Returned to pending · ledger changed after approval by Dana · ${date}`);
  });

  it('shows nothing for a leaf with no stored status', () => {
    expect(leafApprovalTooltip({ status: AccountantStatus.Unapproved })).toBeNull();
  });
});

describe('branchApprovalTooltip', () => {
  it('lists the counts', () => {
    expect(branchApprovalTooltip({ approved: 7, pending: 2, unapproved: 1 })).toBe(
      '7 approved · 2 pending · 1 unapproved',
    );
  });
});
