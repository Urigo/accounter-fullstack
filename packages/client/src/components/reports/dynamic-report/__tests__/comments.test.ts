import { describe, expect, it } from 'vitest';
import {
  ancestorIds,
  buildCommentStats,
  COMMENTS_NEED_TEMPLATE,
  commentsDisabledReason,
  detachedThreads,
  groupDiscussions,
  indexThreads,
  isSendable,
  MAX_COMMENT_LENGTH,
  messagePeriodChip,
  nodePath,
  openBelowLabel,
  revealVisibility,
  type CommentMessage,
  type CommentThread,
} from '../utils/comments.js';
import type { CustomData, FlatNode } from '../utils/types.js';
import { mergeVisibility } from '../utils/visibility.js';

function leaf(id: string, parent: string, extra: Partial<CustomData> = {}): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value: 1, ...extra },
  };
}

function branch(id: string, parent: string): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Branch ${id}`,
    droppable: true,
    data: { nodeType: 'synthetic-branch', isOpen: false },
  };
}

const VIEW = { fromDate: '2026-01-01', toDate: '2026-12-31', scopeOwnerId: 'owner-1' };

function message(id: string, extra: Partial<CommentMessage> = {}): CommentMessage {
  return {
    id,
    content: `Message ${id}`,
    createdAt: '2026-09-01T10:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    author: 'Dana',
    isMine: false,
    ...VIEW,
    ...extra,
  };
}

function thread(
  nodeId: string,
  extra: Partial<CommentThread> = {},
  messages: CommentMessage[] = [message(`${nodeId}-m1`)],
): CommentThread {
  return {
    id: `t-${nodeId}`,
    nodeId,
    nodeKind: 'LEAF',
    nodeLabel: `Label ${nodeId}`,
    createdAt: '2026-09-01T10:00:00.000Z',
    resolvedAt: null,
    resolvedBy: null,
    messages,
    ...extra,
  };
}

// report
// ├─ A
// │  ├─ a1
// │  ├─ a2 (hidden: no activity in the period)
// │  └─ A1
// │     └─ a3
// ├─ B
// │  └─ b1
// └─ r1
const tree = [
  branch('A', 'report'),
  leaf('a1', 'A'),
  leaf('a2', 'A', { isHidden: true }),
  branch('A1', 'A'),
  leaf('a3', 'A1'),
  branch('B', 'report'),
  leaf('b1', 'B'),
  leaf('r1', 'report'),
];

describe('indexThreads', () => {
  it('summarises each thread by node id', () => {
    const index = indexThreads([
      thread('a1', {}, [
        message('m1', { createdAt: '2026-09-01T10:00:00.000Z' }),
        message('m2', { createdAt: '2026-09-02T10:00:00.000Z' }),
      ]),
      thread('B', { resolvedAt: '2026-09-03T00:00:00.000Z', nodeKind: 'BRANCH' }),
    ]);
    expect(index.get('a1')).toEqual({
      threadId: 't-a1',
      isOpen: true,
      messageCount: 2,
      lastMessageAt: new Date('2026-09-02T10:00:00.000Z'),
    });
    expect(index.get('B')?.isOpen).toBe(false);
    expect(index.has('b1')).toBe(false);
  });

  it('leaves deleted messages out of the count, but not out of the last-message time', () => {
    const index = indexThreads([
      thread('a1', {}, [
        message('m1'),
        message('m2', {
          content: null,
          deletedAt: '2026-09-05T00:00:00.000Z',
          createdAt: '2026-09-04T00:00:00.000Z',
        }),
      ]),
    ]);
    expect(index.get('a1')?.messageCount).toBe(1);
    expect(index.get('a1')?.lastMessageAt).toEqual(new Date('2026-09-04T00:00:00.000Z'));
  });

  it('gives a thread with no messages a null last-message time', () => {
    expect(indexThreads([thread('a1', {}, [])]).get('a1')).toMatchObject({
      messageCount: 0,
      lastMessageAt: null,
    });
  });

  it('returns an empty index for no threads', () => {
    expect(indexThreads([]).size).toBe(0);
  });
});

describe('buildCommentStats', () => {
  it('counts the open threads below each branch, including nested ones', () => {
    const stats = buildCommentStats(tree, indexThreads([thread('a1'), thread('a3')]));
    expect(stats.get('A')).toEqual({ own: undefined, openBelow: 2 });
    expect(stats.get('A1')).toEqual({ own: undefined, openBelow: 1 });
    expect(stats.get('B')).toEqual({ own: undefined, openBelow: 0 });
    expect(stats.get('a1')?.own?.threadId).toBe('t-a1');
    expect(stats.get('a1')?.openBelow).toBe(0);
  });

  it('gives a branch its own thread, and counts it for the branches above but not itself', () => {
    const stats = buildCommentStats(
      tree,
      indexThreads([thread('A1', { nodeKind: 'BRANCH' }), thread('a3')]),
    );
    expect(stats.get('A1')?.own?.threadId).toBe('t-A1');
    expect(stats.get('A1')?.openBelow).toBe(1);
    expect(stats.get('A')?.openBelow).toBe(2);
  });

  it('does not count resolved threads as open', () => {
    const stats = buildCommentStats(
      tree,
      indexThreads([thread('a1', { resolvedAt: '2026-09-03T00:00:00.000Z' }), thread('b1')]),
    );
    expect(stats.get('A')?.openBelow).toBe(0);
    expect(stats.get('a1')?.own?.isOpen).toBe(false);
    expect(stats.get('B')?.openBelow).toBe(1);
  });

  it('skips hidden leaves, so their threads light up no branch', () => {
    const stats = buildCommentStats(tree, indexThreads([thread('a2')]));
    expect(stats.has('a2')).toBe(false);
    expect(stats.get('A')?.openBelow).toBe(0);
  });

  it('gives every node an entry, with nothing to report when there are no threads', () => {
    const stats = buildCommentStats(tree, new Map());
    expect(stats.get('r1')).toEqual({ own: undefined, openBelow: 0 });
    expect(stats.get('A')).toEqual({ own: undefined, openBelow: 0 });
    // Every node but the hidden leaf.
    expect(stats.size).toBe(tree.length - 1);
  });

  it('ignores threads on nodes that are not in the tree', () => {
    const stats = buildCommentStats(tree, indexThreads([thread('gone')]));
    expect([...stats.values()].every(entry => entry.openBelow === 0 && !entry.own)).toBe(true);
  });
});

describe('detachedThreads', () => {
  it('leaves threads on visible rows out', () => {
    expect(detachedThreads([thread('a1'), thread('A1'), thread('r1')], tree, new Set())).toEqual(
      [],
    );
  });

  it('lists a thread on a leaf hidden by no activity in the period', () => {
    const t = thread('a2');
    expect(detachedThreads([t], tree, new Set())).toEqual([
      { thread: t, reason: 'hidden-in-period', isGhost: false },
    ]);
  });

  it('lists a thread on a leaf dragged back to the bank as not in the report', () => {
    // The leaf is simply absent from the report tree; the bank tree is never consulted.
    const t = thread('bank-leaf');
    expect(detachedThreads([t], tree, new Set())).toEqual([
      { thread: t, reason: 'not-in-report', isGhost: false },
    ]);
  });

  it('lists a thread on a deleted branch as not in the report', () => {
    const withoutB = tree.filter(node => node.id !== 'B' && node.parent !== 'B');
    const t = thread('B', { nodeKind: 'BRANCH' });
    expect(detachedThreads([t], withoutB, new Set())).toEqual([
      { thread: t, reason: 'not-in-report', isGhost: false },
    ]);
  });

  it('lists a thread on a discarded unsaved branch as not in the report', () => {
    // An unsaved branch that got a thread, then was dropped by a template reload.
    const t = thread('branch-unsaved', { nodeKind: 'BRANCH' });
    expect(detachedThreads([t], tree, new Set())[0]?.reason).toBe('not-in-report');
  });

  it('marks a node that left the report since the baseline as a ghost', () => {
    const t = thread('b1');
    const withoutB1 = tree.filter(node => node.id !== 'b1');
    expect(detachedThreads([t], withoutB1, new Set(['b1']))).toEqual([
      { thread: t, reason: 'not-in-report', isGhost: true },
    ]);
  });

  it('does not treat a ghost id that is back in the report as detached', () => {
    expect(detachedThreads([thread('b1')], tree, new Set(['b1']))).toEqual([]);
  });

  it('keeps the threads in the order given', () => {
    const threads = [thread('x'), thread('a2'), thread('y')];
    expect(detachedThreads(threads, tree, new Set()).map(entry => entry.thread.nodeId)).toEqual([
      'x',
      'a2',
      'y',
    ]);
  });
});

describe('ancestorIds', () => {
  it('lists the ancestors nearest first', () => {
    expect(ancestorIds(tree, 'a3')).toEqual(['A1', 'A']);
  });

  it('is empty for a top-level node and for an unknown id', () => {
    expect(ancestorIds(tree, 'r1')).toEqual([]);
    expect(ancestorIds(tree, 'A')).toEqual([]);
    expect(ancestorIds(tree, 'nope')).toEqual([]);
  });

  it('stops on a parent link that loops', () => {
    const looped = [{ ...branch('X', 'Y') }, { ...branch('Y', 'X') }, leaf('x1', 'X')];
    expect(ancestorIds(looped, 'x1')).toEqual(['X', 'Y']);
  });
});

describe('nodePath', () => {
  it('gives the ancestors’ row texts from the top down', () => {
    expect(nodePath(tree, 'a3')).toEqual(['Branch A', 'Branch A1']);
    expect(nodePath(tree, 'r1')).toEqual([]);
  });
});

describe('revealVisibility', () => {
  it('shows the node and its ancestors, and opens the ancestors only', () => {
    expect(revealVisibility(tree, 'a3')).toEqual({
      visibleIds: new Set(['a3', 'A1', 'A']),
      forceOpenIds: new Set(['A1', 'A']),
    });
  });

  it('is null for a node that is not in the tree', () => {
    expect(revealVisibility(tree, 'gone')).toBeNull();
  });

  it('adds the revealed row to a narrowed Needs review overlay', () => {
    const review = { visibleIds: new Set(['B', 'b1']), forceOpenIds: new Set(['B']) };
    const merged = mergeVisibility(review, revealVisibility(tree, 'a3'));
    expect(merged?.visibleIds).toEqual(new Set(['B', 'b1', 'a3', 'A1', 'A']));
    expect(merged?.forceOpenIds).toEqual(new Set(['B', 'A1', 'A']));
  });

  it('keeps every row shown when Needs review is off, only opening the ancestors', () => {
    const merged = mergeVisibility(
      { visibleIds: null, forceOpenIds: new Set() },
      revealVisibility(tree, 'a3'),
    );
    expect(merged?.visibleIds).toBeNull();
    expect(merged?.forceOpenIds).toEqual(new Set(['A1', 'A']));
  });

  it('never touches the nodes’ saved isOpen', () => {
    const before = JSON.stringify(tree);
    revealVisibility(tree, 'a3');
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('messagePeriodChip', () => {
  it('is null when the period and owner match the view', () => {
    expect(messagePeriodChip(message('m'), VIEW)).toBeNull();
  });

  it('shows the period when it differs', () => {
    expect(
      messagePeriodChip(message('m', { fromDate: '2025-01-01', toDate: '2025-12-31' }), VIEW),
    ).toBe('2025-01-01 – 2025-12-31');
    // Only one end differing is still another period.
    expect(messagePeriodChip(message('m', { toDate: '2026-06-30' }), VIEW)).toBe(
      '2026-01-01 – 2026-06-30',
    );
  });

  it('shows the owner when only the owner differs', () => {
    const names = new Map([['owner-2', 'Acme Ltd']]);
    expect(
      messagePeriodChip(message('m', { scopeOwnerId: 'owner-2' }), VIEW, id => names.get(id)),
    ).toBe('Acme Ltd');
  });

  it('falls back to "another owner" for an owner it cannot name', () => {
    expect(messagePeriodChip(message('m', { scopeOwnerId: 'owner-9' }), VIEW)).toBe(
      'another owner',
    );
  });

  it('shows both when both differ', () => {
    expect(
      messagePeriodChip(
        message('m', { fromDate: '2025-01-01', toDate: '2025-12-31', scopeOwnerId: 'owner-2' }),
        VIEW,
        () => 'Acme Ltd',
      ),
    ).toBe('2025-01-01 – 2025-12-31 · Acme Ltd');
  });
});

describe('commentsDisabledReason', () => {
  it('asks for a saved template, and is null once there is one', () => {
    expect(commentsDisabledReason({ hasTemplate: false })).toBe(COMMENTS_NEED_TEMPLATE);
    expect(COMMENTS_NEED_TEMPLATE).toBe('Save the template to start a discussion');
    expect(commentsDisabledReason({ hasTemplate: true })).toBeNull();
  });
});

describe('groupDiscussions', () => {
  it('splits attached threads by status and keeps detached ones apart, in order', () => {
    const open1 = thread('a1');
    const resolved = thread('A1', { resolvedAt: '2026-09-03T00:00:00.000Z' });
    const open2 = thread('b1');
    const hidden = thread('a2');
    const gone = thread('gone', { resolvedAt: '2026-09-03T00:00:00.000Z' });
    const threads = [open1, resolved, hidden, open2, gone];
    const detached = detachedThreads(threads, tree, new Set());
    const groups = groupDiscussions(threads, detached);
    expect(groups.open).toEqual([open1, open2]);
    expect(groups.resolved).toEqual([resolved]);
    expect(groups.detached.map(entry => [entry.thread.nodeId, entry.reason])).toEqual([
      ['a2', 'hidden-in-period'],
      ['gone', 'not-in-report'],
    ]);
  });

  it('gives empty groups for no threads', () => {
    expect(groupDiscussions([], [])).toEqual({ open: [], resolved: [], detached: [] });
  });
});

describe('openBelowLabel', () => {
  it('reads naturally for one and for many', () => {
    expect(openBelowLabel(1)).toBe('1 open thread inside');
    expect(openBelowLabel(2)).toBe('2 open threads inside');
  });
});

describe('isSendable', () => {
  it('blocks empty and whitespace-only drafts', () => {
    expect(isSendable('')).toBe(false);
    expect(isSendable('  \n\t ')).toBe(false);
  });

  it('allows up to the limit once trimmed, and blocks beyond it', () => {
    expect(isSendable('ok')).toBe(true);
    expect(isSendable(`  ${'x'.repeat(MAX_COMMENT_LENGTH)}  `)).toBe(true);
    expect(isSendable('x'.repeat(MAX_COMMENT_LENGTH + 1))).toBe(false);
  });
});
