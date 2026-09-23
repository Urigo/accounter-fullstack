import { describe, expect, it } from 'vitest';
import { AccountantStatus } from '../../../../gql/graphql.js';
import {
  applyBulk,
  applyOverride,
  approvalsDisabledReason,
  branchApprovalTooltip,
  branchStatus,
  buildApprovalsInput,
  buildApprovalStats,
  buildEffectiveStatuses,
  countedLeafIds,
  deriveLeafStatuses,
  deriveSaveStatuses,
  dropSavedOverrides,
  formatApprovalDate,
  formatApprovalProgress,
  leafApprovalTooltip,
  needsReviewVisibility,
  resolveStatus,
  summarizeApprovals,
  type ApprovalOverrides,
  type DynamicReportLeafApproval,
  type EffectiveApproval,
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

describe('applyOverride', () => {
  const derived = new Map<string, EffectiveApproval>([
    ['a', { status: AccountantStatus.Unapproved }],
    ['b', { status: AccountantStatus.Approved, setAt: SET_AT, setBy: 'Dana', isSystem: false }],
  ]);

  it('stages a status that differs from the derived one, in a new map', () => {
    const before: ApprovalOverrides = new Map();
    const after = applyOverride(before, 'a', AccountantStatus.Approved, derived);
    expect(after).not.toBe(before);
    expect(before.size).toBe(0);
    expect([...after]).toEqual([['a', AccountantStatus.Approved]]);
  });

  it('drops the override when the status equals the derived status', () => {
    const before: ApprovalOverrides = new Map([['b', AccountantStatus.Pending]]);
    const after = applyOverride(before, 'b', AccountantStatus.Approved, derived);
    expect(after).not.toBe(before);
    expect(after.has('b')).toBe(false);
    expect(before.get('b')).toBe(AccountantStatus.Pending);
  });

  it('replaces an earlier override', () => {
    const before: ApprovalOverrides = new Map([['a', AccountantStatus.Approved]]);
    const after = applyOverride(before, 'a', AccountantStatus.Pending, derived);
    expect(after.get('a')).toBe(AccountantStatus.Pending);
  });

  it('treats a leaf with no derived status as unapproved', () => {
    const after = applyOverride(new Map(), 'unknown', AccountantStatus.Unapproved, derived);
    expect(after.size).toBe(0);
  });
});

describe('countedLeafIds', () => {
  const nodes = [
    branch('root', 'report'),
    leaf('a', 'root'),
    branch('nested', 'root'),
    leaf('b', 'nested'),
    leaf('hidden', 'nested', { isHidden: true }),
    branch('deeper', 'nested'),
    leaf('c', 'deeper'),
    branch('other', 'report'),
    leaf('d', 'other'),
  ];

  it('reaches leaves in nested branches and skips hidden leaves and branches', () => {
    expect(countedLeafIds(nodes, 'root').sort()).toEqual(['a', 'b', 'c']);
  });

  it('stays inside the subtree', () => {
    expect(countedLeafIds(nodes, 'nested').sort()).toEqual(['b', 'c']);
    expect(countedLeafIds(nodes, 'other')).toEqual(['d']);
  });

  it('is empty for a branch with no counted leaves or an unknown id', () => {
    expect(countedLeafIds([branch('empty', 'report')], 'empty')).toEqual([]);
    expect(countedLeafIds(nodes, 'missing')).toEqual([]);
  });
});

describe('applyBulk', () => {
  const derived = new Map<string, EffectiveApproval>([
    ['a', { status: AccountantStatus.Unapproved }],
    ['b', { status: AccountantStatus.Approved, setAt: SET_AT, setBy: 'Dana', isSystem: false }],
    ['c', { status: AccountantStatus.Pending, isDerived: true }],
  ]);

  it('stages the status on every leaf that would not show it anyway, in a new map', () => {
    const before: ApprovalOverrides = new Map();
    const after = applyBulk(before, ['a', 'b', 'c'], AccountantStatus.Approved, derived);
    expect(after).not.toBe(before);
    expect(before.size).toBe(0);
    expect([...after].sort()).toEqual([
      ['a', AccountantStatus.Approved],
      ['c', AccountantStatus.Approved],
    ]);
  });

  it('drops earlier overrides on leaves whose derived status matches', () => {
    const before: ApprovalOverrides = new Map([
      ['b', AccountantStatus.Pending],
      ['x', AccountantStatus.Pending],
    ]);
    const after = applyBulk(before, ['a', 'b'], AccountantStatus.Approved, derived);
    expect(after.has('b')).toBe(false);
    expect(after.get('a')).toBe(AccountantStatus.Approved);
    // Leaves outside the subtree keep their staged status.
    expect(after.get('x')).toBe(AccountantStatus.Pending);
  });

  it('works with countedLeafIds to reach nested leaves only', () => {
    const nodes = [
      branch('root', 'report'),
      branch('nested', 'root'),
      leaf('a', 'nested'),
      leaf('hidden', 'nested', { isHidden: true }),
      leaf('outside', 'report'),
    ];
    const after = applyBulk(
      new Map(),
      countedLeafIds(nodes, 'root'),
      AccountantStatus.Pending,
      deriveLeafStatuses(nodes, null, new Map()),
    );
    expect([...after]).toEqual([['a', AccountantStatus.Pending]]);
  });
});

describe('dropSavedOverrides', () => {
  const saved: ApprovalOverrides = new Map([
    ['a', AccountantStatus.Approved],
    ['b', AccountantStatus.Pending],
  ]);

  it('clears everything when nothing was staged during the save', () => {
    expect(dropSavedOverrides(saved, saved).size).toBe(0);
  });

  it('keeps what was changed or added while the save was in flight', () => {
    const current = new Map([
      ['a', AccountantStatus.Approved], // sent as is: saved
      ['b', AccountantStatus.Unapproved], // changed after sending: still unsaved
      ['c', AccountantStatus.Approved], // added after sending: still unsaved
    ]);
    expect([...dropSavedOverrides(current, saved)]).toEqual([
      ['b', AccountantStatus.Unapproved],
      ['c', AccountantStatus.Approved],
    ]);
  });
});

describe('resolveStatus', () => {
  const derived = new Map<string, EffectiveApproval>([
    ['a', { status: AccountantStatus.Approved, setAt: SET_AT, setBy: 'Dana', isSystem: false }],
  ]);

  it('returns a staged override, marked as staged', () => {
    const overrides: ApprovalOverrides = new Map([['a', AccountantStatus.Unapproved]]);
    expect(resolveStatus('a', derived, overrides)).toEqual({
      status: AccountantStatus.Unapproved,
      isStaged: true,
    });
  });

  it('falls back to the derived status', () => {
    expect(resolveStatus('a', derived, new Map())).toBe(derived.get('a'));
  });

  it('returns undefined for a leaf it knows nothing about', () => {
    expect(resolveStatus('x', derived, new Map())).toBeUndefined();
  });
});

describe('buildEffectiveStatuses', () => {
  it('overlays overrides on the derived statuses and ignores overrides for absent leaves', () => {
    const derived = new Map<string, EffectiveApproval>([
      ['a', { status: AccountantStatus.Unapproved }],
      ['b', { status: AccountantStatus.Pending }],
    ]);
    const overrides: ApprovalOverrides = new Map([
      ['a', AccountantStatus.Approved],
      ['gone', AccountantStatus.Approved],
    ]);
    const effective = buildEffectiveStatuses(derived, overrides);
    expect([...effective.keys()]).toEqual(['a', 'b']);
    expect(effective.get('a')).toEqual({ status: AccountantStatus.Approved, isStaged: true });
    expect(effective.get('b')).toBe(derived.get('b'));
  });

  it('returns the derived map itself when nothing is staged', () => {
    const derived = new Map<string, EffectiveApproval>([
      ['a', { status: AccountantStatus.Unapproved }],
    ]);
    expect(buildEffectiveStatuses(derived, new Map())).toBe(derived);
  });

  it('feeds buildApprovalStats with the effective statuses', () => {
    const nodes = [branch('b', 'report'), leaf('a', 'b'), leaf('c', 'b')];
    const derived = deriveLeafStatuses(nodes, null, new Map());
    const effective = buildEffectiveStatuses(derived, new Map([['a', AccountantStatus.Approved]]));
    const stats = buildApprovalStats(nodes, id => effective.get(id)?.status);
    expect(stats.get('b')).toEqual({ approved: 1, pending: 0, unapproved: 1 });
  });
});

describe('leafApprovalTooltip for staged changes', () => {
  it('reads "Unsaved change"', () => {
    expect(leafApprovalTooltip({ status: AccountantStatus.Approved, isStaged: true })).toBe(
      'Unsaved change',
    );
  });
});

describe('approvalsDisabledReason', () => {
  const ready = { hasTemplate: true, isLoading: false, isLatestBaseline: true };

  it('is null when a saved template is loaded against its latest baseline', () => {
    expect(approvalsDisabledReason(ready)).toBeNull();
  });

  it('asks for a saved template when none is loaded', () => {
    expect(approvalsDisabledReason({ ...ready, hasTemplate: false })).toBe(
      'Load a saved template',
    );
  });

  it('explains that an older baseline is read-only', () => {
    expect(approvalsDisabledReason({ ...ready, isLatestBaseline: false })).toBe(
      'Viewing an older baseline — switch to Last save to review',
    );
  });

  it('waits while the data loads', () => {
    expect(approvalsDisabledReason({ ...ready, isLoading: true })).toBe('Loading…');
  });

  it('puts the missing template first', () => {
    expect(
      approvalsDisabledReason({ hasTemplate: false, isLoading: true, isLatestBaseline: false }),
    ).toBe('Load a saved template');
  });
});

describe('buildApprovalsInput', () => {
  it('lists every counted leaf with its effective status, UNAPPROVED included', () => {
    const nodes = [
      branch('b', 'report'),
      leaf('a', 'b'),
      leaf('c', 'b'),
      leaf('d', 'report'),
      leaf('hidden', 'b', { isHidden: true }),
    ];
    const statuses = new Map<string, EffectiveApproval>([
      ['a', { status: AccountantStatus.Approved, isStaged: true }],
      ['c', { status: AccountantStatus.Pending, isDerived: true }],
      ['d', { status: AccountantStatus.Unapproved }],
      ['hidden', { status: AccountantStatus.Approved }],
    ]);
    expect(buildApprovalsInput(nodes, statuses)).toEqual([
      { entityId: 'a', status: AccountantStatus.Approved },
      { entityId: 'c', status: AccountantStatus.Pending },
      { entityId: 'd', status: AccountantStatus.Unapproved },
    ]);
  });

  it('sends UNAPPROVED for a counted leaf with no known status', () => {
    expect(buildApprovalsInput([leaf('a', 'report')], new Map())).toEqual([
      { entityId: 'a', status: AccountantStatus.Unapproved },
    ]);
  });

  it('is empty for a tree with no counted leaves', () => {
    expect(buildApprovalsInput([branch('b', 'report')], new Map())).toEqual([]);
  });
});

describe('deriveSaveStatuses', () => {
  const scope = { fromDate: '2026-01-01', toDate: '2026-03-31', scopeOwnerId: 'owner' };
  const tree = [leaf('a', 'report', { fingerprint: 'fp-new' }), leaf('b', 'report')];
  const snapshot = {
    ...scope,
    values: [
      { entityId: 'a', fingerprint: 'fp-old' },
      { entityId: 'b', fingerprint: null },
    ],
    approvals: [approval('a', AccountantStatus.Approved), approval('b', AccountantStatus.Pending)],
  };

  it('derives from a comparable snapshot, including the fingerprint regression', () => {
    const result = deriveSaveStatuses(tree, snapshot, scope, new Map());
    expect(result.get('a')?.status).toBe(AccountantStatus.Pending);
    expect(result.get('b')?.status).toBe(AccountantStatus.Pending);
  });

  it('lays the staged overrides on top', () => {
    const result = deriveSaveStatuses(
      tree,
      snapshot,
      scope,
      new Map([['b', AccountantStatus.Approved]]),
    );
    expect(result.get('b')?.status).toBe(AccountantStatus.Approved);
  });

  it('ignores a snapshot for another period or owner', () => {
    for (const other of [
      { ...snapshot, fromDate: '2025-01-01' },
      { ...snapshot, toDate: '2025-12-31' },
      { ...snapshot, scopeOwnerId: 'someone-else' },
    ]) {
      const result = deriveSaveStatuses(tree, other, scope, new Map());
      expect(result.get('a')?.status).toBe(AccountantStatus.Unapproved);
      expect(result.get('b')?.status).toBe(AccountantStatus.Unapproved);
    }
  });

  it('reads every leaf as UNAPPROVED when there is no snapshot', () => {
    const result = deriveSaveStatuses(tree, null, scope, new Map());
    expect([...result.values()].map(value => value.status)).toEqual([
      AccountantStatus.Unapproved,
      AccountantStatus.Unapproved,
    ]);
  });
});

describe('summarizeApprovals', () => {
  it('counts every status and the total', () => {
    const statuses = new Map<string, EffectiveApproval>([
      ['a', { status: AccountantStatus.Approved }],
      ['b', { status: AccountantStatus.Approved }],
      ['c', { status: AccountantStatus.Pending, isDerived: true }],
      ['d', { status: AccountantStatus.Unapproved }],
      ['e', { status: AccountantStatus.Pending, isStaged: true }],
    ]);
    expect(summarizeApprovals(statuses)).toEqual({
      approved: 2,
      pending: 2,
      unapproved: 1,
      total: 5,
    });
  });

  it('returns zeros for no leaves', () => {
    expect(summarizeApprovals(new Map())).toEqual({
      approved: 0,
      pending: 0,
      unapproved: 0,
      total: 0,
    });
  });
});

describe('formatApprovalProgress', () => {
  it('shows approved over total and the pending count', () => {
    expect(formatApprovalProgress({ approved: 124, pending: 6, unapproved: 20, total: 150 })).toBe(
      '124 / 150 approved · 6 pending',
    );
  });

  it('omits the pending part when nothing is pending', () => {
    expect(formatApprovalProgress({ approved: 3, pending: 0, unapproved: 2, total: 5 })).toBe(
      '3 / 5 approved',
    );
  });

  it('returns null when there are no counted leaves', () => {
    expect(formatApprovalProgress({ approved: 0, pending: 0, unapproved: 0, total: 0 })).toBeNull();
  });
});

describe('needsReviewVisibility', () => {
  const statuses = new Map<string, AccountantStatus>([
    ['a1', AccountantStatus.Approved],
    ['a2', AccountantStatus.Pending],
    ['b1', AccountantStatus.Approved],
    ['b2', AccountantStatus.Approved],
    ['c1', AccountantStatus.Unapproved],
  ]);
  const statusOf = (id: string) => statuses.get(id);

  // report
  // ├─ A (branch)
  // │  ├─ a1 approved
  // │  └─ A2 (branch)
  // │     └─ a2 pending
  // ├─ B (branch, fully approved)
  // │  ├─ b1 approved
  // │  └─ b2 approved
  // ├─ c1 unapproved (root leaf)
  // └─ E (empty branch)
  const nodes = [
    branch('A', 'report'),
    leaf('a1', 'A'),
    branch('A2', 'A'),
    leaf('a2', 'A2'),
    branch('B', 'report'),
    leaf('b1', 'B'),
    leaf('b2', 'B'),
    leaf('c1', 'report'),
    branch('E', 'report'),
  ];

  it('shows non-approved counted leaves and all their ancestors', () => {
    const { visibleIds } = needsReviewVisibility(nodes, statusOf);
    expect([...visibleIds].sort()).toEqual(['A', 'A2', 'a2', 'c1']);
  });

  it('force-opens exactly the ancestors of the shown leaves', () => {
    const { forceOpenIds } = needsReviewVisibility(nodes, statusOf);
    expect([...forceOpenIds].sort()).toEqual(['A', 'A2']);
  });

  it('excludes a fully approved subtree and an empty branch', () => {
    const { visibleIds } = needsReviewVisibility(nodes, statusOf);
    for (const id of ['B', 'b1', 'b2', 'E', 'a1']) {
      expect(visibleIds.has(id)).toBe(false);
    }
  });

  it('treats a leaf with no known status as unapproved', () => {
    const { visibleIds } = needsReviewVisibility([branch('X', 'report'), leaf('x', 'X')], () =>
      undefined,
    );
    expect([...visibleIds].sort()).toEqual(['X', 'x']);
  });

  it('skips hidden leaves', () => {
    const { visibleIds, forceOpenIds } = needsReviewVisibility(
      [branch('H', 'report'), leaf('h', 'H', { isHidden: true })],
      () => AccountantStatus.Unapproved,
    );
    expect(visibleIds.size).toBe(0);
    expect(forceOpenIds.size).toBe(0);
  });
});
