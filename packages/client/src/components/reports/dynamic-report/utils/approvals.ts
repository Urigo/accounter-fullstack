import { AccountantStatus, type DynamicReportLeafApprovalInput } from '../../../../gql/graphql.js';
import {
  getDescendantIds,
  isFinancialEntityNode,
  type CustomData,
  type FlatNode,
} from './types.js';

/** A leaf's stored status, as a snapshot read returns it. */
export type DynamicReportLeafApproval = {
  entityId: string;
  status: AccountantStatus;
  setAt: Date | string;
  /** Display name of the user who set it; null for a system stamp or a user who is gone. */
  setBy?: string | null;
  isSystem: boolean;
};

/** The status a leaf shows, plus the stamp it came from when there is one. */
export type EffectiveApproval = {
  status: AccountantStatus;
  setBy?: string | null;
  setAt?: Date | string;
  isSystem?: boolean;
  /**
   * The stored status was APPROVED but the leaf's ledger records have changed since, so it reads
   * PENDING. Nothing has been written yet: the regression is only persisted by the next save.
   */
  isDerived?: boolean;
  /** The user changed this status and hasn't saved yet. A staged status carries no stamp. */
  isStaged?: boolean;
};

/** Statuses the user has chosen but not saved, keyed by entity id. */
export type ApprovalOverrides = ReadonlyMap<string, AccountantStatus>;

export type ApprovalCounts = { approved: number; pending: number; unapproved: number };

export type ApprovalStats = Map<string, ApprovalCounts>;

/** A counted leaf is a visible financial-entity leaf. Ghost rows never reach the live tree. */
function isCountedLeaf(node: FlatNode<CustomData>): boolean {
  return isFinancialEntityNode(node) && !node.data.isHidden;
}

/**
 * Resolves each counted leaf's status from the baseline snapshot (spec R3, steps 2 and 3):
 * - a stored status stands, except that a stored APPROVED whose baseline fingerprint differs from
 *   the leaf's current fingerprint reads PENDING;
 * - a leaf with no stored status, or any leaf when there is no approvals list, is UNAPPROVED.
 *
 * Leaf node ids are financial entity ids, so the result is keyed by both.
 */
export function deriveLeafStatuses(
  tree: FlatNode<CustomData>[],
  approvals: readonly DynamicReportLeafApproval[] | null,
  baselineFingerprints: Map<string, string>,
): Map<string, EffectiveApproval> {
  const stored = new Map((approvals ?? []).map(approval => [approval.entityId, approval]));
  const result = new Map<string, EffectiveApproval>();

  for (const node of tree) {
    if (!isCountedLeaf(node)) continue;

    const approval = stored.get(node.id);
    if (!approval) {
      result.set(node.id, { status: AccountantStatus.Unapproved });
      continue;
    }

    const stamp = {
      setAt: approval.setAt,
      setBy: approval.setBy ?? null,
      isSystem: approval.isSystem,
    };
    const baselineFingerprint = baselineFingerprints.get(node.id);
    // A legacy baseline has no fingerprint to compare with, so its approvals are taken as they are.
    const recordsChanged =
      baselineFingerprint !== undefined && baselineFingerprint !== node.data.fingerprint;

    if (approval.status === AccountantStatus.Approved && recordsChanged) {
      result.set(node.id, { status: AccountantStatus.Pending, ...stamp, isDerived: true });
    } else {
      result.set(node.id, { status: approval.status, ...stamp });
    }
  }

  return result;
}

/**
 * Counts approved / pending / unapproved counted leaves under every node in one post-order pass,
 * mirroring buildNodeStats. Hidden leaves get no entry and contribute nothing. A counted leaf that
 * statusOf doesn't know is counted as unapproved.
 */
export function buildApprovalStats(
  nodes: FlatNode<CustomData>[],
  statusOf: (entityId: string) => AccountantStatus | undefined,
): ApprovalStats {
  const nodeById = new Map<string, FlatNode<CustomData>>();
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    nodeById.set(n.id, n);
    const siblings = childrenOf.get(n.parent);
    if (siblings) siblings.push(n.id);
    else childrenOf.set(n.parent, [n.id]);
  }

  const result: ApprovalStats = new Map();
  const empty: ApprovalCounts = { approved: 0, pending: 0, unapproved: 0 };

  function visit(nodeId: string): ApprovalCounts {
    const cached = result.get(nodeId);
    if (cached) return cached;

    const node = nodeById.get(nodeId);
    if (!node) return empty;

    if (isFinancialEntityNode(node)) {
      if (node.data.isHidden) return empty;
      const status = statusOf(node.id) ?? AccountantStatus.Unapproved;
      const counts: ApprovalCounts = {
        approved: status === AccountantStatus.Approved ? 1 : 0,
        pending: status === AccountantStatus.Pending ? 1 : 0,
        unapproved: status === AccountantStatus.Unapproved ? 1 : 0,
      };
      result.set(nodeId, counts);
      return counts;
    }

    const counts: ApprovalCounts = { approved: 0, pending: 0, unapproved: 0 };
    for (const childId of childrenOf.get(nodeId) ?? []) {
      const child = visit(childId);
      counts.approved += child.approved;
      counts.pending += child.pending;
      counts.unapproved += child.unapproved;
    }
    result.set(nodeId, counts);
    return counts;
  }

  for (const n of nodes) {
    visit(n.id);
  }

  return result;
}

/**
 * Stages a leaf's status (spec R2). Returns a new map. Choosing the status the leaf would show
 * anyway drops the override, so toggling a leaf back leaves nothing staged.
 */
export function applyOverride(
  overrides: ApprovalOverrides,
  entityId: string,
  status: AccountantStatus,
  derived: ReadonlyMap<string, EffectiveApproval>,
): Map<string, AccountantStatus> {
  const next = new Map(overrides);
  stageInPlace(next, entityId, status, derived);
  return next;
}

function stageInPlace(
  overrides: Map<string, AccountantStatus>,
  entityId: string,
  status: AccountantStatus,
  derived: ReadonlyMap<string, EffectiveApproval>,
): void {
  const derivedStatus = derived.get(entityId)?.status ?? AccountantStatus.Unapproved;
  if (status === derivedStatus) {
    overrides.delete(entityId);
  } else {
    overrides.set(entityId, status);
  }
}

/** The counted leaves in a branch's subtree, at any depth: the leaves a bulk set reaches (spec R7). */
export function countedLeafIds(nodes: FlatNode<CustomData>[], rootId: string): string[] {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  return getDescendantIds(nodes, rootId).filter(id => {
    const node = nodeById.get(id);
    return !!node && isCountedLeaf(node);
  });
}

/**
 * Stages one status for many leaves at once (spec R7), applying applyOverride's rule to each:
 * leaves that would show that status anyway end up with nothing staged. Returns a new map, copied
 * once.
 */
export function applyBulk(
  overrides: ApprovalOverrides,
  leafIds: readonly string[],
  status: AccountantStatus,
  derived: ReadonlyMap<string, EffectiveApproval>,
): Map<string, AccountantStatus> {
  const next = new Map(overrides);
  for (const entityId of leafIds) {
    stageInPlace(next, entityId, status, derived);
  }
  return next;
}

/**
 * What stays staged after a save that sent `saved`: only what the user changed or added while the
 * save was in flight. Everything it sent is in the new snapshot now.
 */
export function dropSavedOverrides(
  current: ApprovalOverrides,
  saved: ApprovalOverrides,
): ApprovalOverrides {
  if (current === saved) return new Map();
  const next = new Map(current);
  for (const [entityId, status] of saved) {
    if (next.get(entityId) === status) next.delete(entityId);
  }
  return next;
}

/** A staged override wins over the derived status (spec R3, step 1). */
export function resolveStatus(
  entityId: string,
  derived: ReadonlyMap<string, EffectiveApproval>,
  overrides: ApprovalOverrides,
): EffectiveApproval | undefined {
  const override = overrides.get(entityId);
  if (override !== undefined) {
    return { status: override, isStaged: true };
  }
  return derived.get(entityId);
}

/**
 * The status every counted leaf shows: its derived status with the staged overrides laid on top.
 * Overrides for leaves that are no longer counted (removed or hidden) are ignored.
 */
export function buildEffectiveStatuses(
  derived: Map<string, EffectiveApproval>,
  overrides: ApprovalOverrides,
): Map<string, EffectiveApproval> {
  if (overrides.size === 0) return derived;
  const result = new Map<string, EffectiveApproval>();
  for (const entityId of derived.keys()) {
    const effective = resolveStatus(entityId, derived, overrides);
    if (effective) result.set(entityId, effective);
  }
  return result;
}

/**
 * The approvals a Resave or Capture sends: every counted leaf with the status it shows, UNAPPROVED
 * included. The server stamps each entry against the snapshot the save follows, so an unchanged
 * status keeps its stamp and a derived regression is recorded as a system one.
 */
export function buildApprovalsInput(
  tree: FlatNode<CustomData>[],
  statuses: ReadonlyMap<string, EffectiveApproval>,
): DynamicReportLeafApprovalInput[] {
  return tree.filter(isCountedLeaf).map(node => ({
    entityId: node.id,
    status: statuses.get(node.id)?.status ?? AccountantStatus.Unapproved,
  }));
}

/** The parts of a snapshot read that the statuses derive from. */
type ApprovalSnapshotLike = {
  fromDate: string;
  toDate: string;
  scopeOwnerId: string;
  values: readonly { entityId: string; fingerprint?: string | null }[];
  approvals: readonly DynamicReportLeafApproval[];
};

/**
 * Effective statuses derived from a given snapshot rather than from the baseline on screen. A save
 * must send the statuses of the snapshot it follows (the latest comparable one), even while an
 * older baseline is pinned for viewing, or it would write that older save's statuses back as fresh
 * user choices. A snapshot for another period or owner carries no statuses that apply.
 */
export function deriveSaveStatuses(
  tree: FlatNode<CustomData>[],
  snapshot: ApprovalSnapshotLike | null,
  scope: { fromDate: string; toDate: string; scopeOwnerId: string },
  overrides: ApprovalOverrides,
): Map<string, EffectiveApproval> {
  const comparable =
    !!snapshot &&
    snapshot.fromDate === scope.fromDate &&
    snapshot.toDate === scope.toDate &&
    snapshot.scopeOwnerId === scope.scopeOwnerId;
  const fingerprints = new Map<string, string>();
  if (comparable) {
    for (const value of snapshot.values) {
      if (value.fingerprint != null) fingerprints.set(value.entityId, value.fingerprint);
    }
  }
  const derived = deriveLeafStatuses(tree, comparable ? snapshot.approvals : null, fingerprints);
  return buildEffectiveStatuses(derived, overrides);
}

/**
 * Why statuses can't be changed right now, or null when they can (spec R12). Statuses are saved
 * with a template's snapshot, so there must be one; an older baseline is a read-only history view;
 * and while the figures or the baseline load, the derived statuses aren't final yet.
 */
export function approvalsDisabledReason({
  hasTemplate,
  isLoading,
  isLatestBaseline,
}: {
  hasTemplate: boolean;
  isLoading: boolean;
  isLatestBaseline: boolean;
}): string | null {
  if (!hasTemplate) return 'Load a saved template';
  if (isLoading) return 'Loading…';
  if (!isLatestBaseline) return 'Viewing an older baseline — switch to Last save to review';
  return null;
}

/** Worst status wins (spec R5); null for a branch with no counted leaves. */
export function branchStatus(counts: ApprovalCounts | undefined): AccountantStatus | null {
  if (!counts) return null;
  if (counts.unapproved > 0) return AccountantStatus.Unapproved;
  if (counts.pending > 0) return AccountantStatus.Pending;
  if (counts.approved > 0) return AccountantStatus.Approved;
  return null;
}

export function formatApprovalDate(date: Date | string): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const STATUS_VERB: Record<AccountantStatus, string> = {
  [AccountantStatus.Approved]: 'Approved',
  [AccountantStatus.Pending]: 'Marked pending',
  [AccountantStatus.Unapproved]: 'Marked unapproved',
};

/**
 * Who set a leaf's status and when (spec R4), or "Unsaved change" for a staged one; null when there
 * is no stored stamp.
 */
export function leafApprovalTooltip(approval: EffectiveApproval): string | null {
  if (approval.isStaged) return 'Unsaved change';
  if (approval.setAt == null) return null;
  const date = formatApprovalDate(approval.setAt);
  if (approval.isSystem) {
    return `Returned to pending · ledger changed after approval · ${date}`;
  }
  const who = approval.setBy ?? 'a former user';
  if (approval.isDerived) {
    return `Returned to pending · ledger changed after approval by ${who} · ${date}`;
  }
  return `${STATUS_VERB[approval.status]} by ${who} · ${date}`;
}

/** Counts summary for a branch (spec R6). */
export function branchApprovalTooltip(counts: ApprovalCounts): string {
  return `${counts.approved} approved · ${counts.pending} pending · ${counts.unapproved} unapproved`;
}

export type ApprovalSummary = ApprovalCounts & { total: number };

/** Report-wide counts over the counted leaves' effective statuses (spec R19). */
export function summarizeApprovals(
  statuses: ReadonlyMap<string, EffectiveApproval>,
): ApprovalSummary {
  const summary: ApprovalSummary = { approved: 0, pending: 0, unapproved: 0, total: 0 };
  for (const { status } of statuses.values()) {
    summary.total += 1;
    if (status === AccountantStatus.Approved) summary.approved += 1;
    else if (status === AccountantStatus.Pending) summary.pending += 1;
    else summary.unapproved += 1;
  }
  return summary;
}

/** The toolbar's progress line, e.g. "124 / 150 approved · 6 pending"; null with no counted leaves. */
export function formatApprovalProgress(summary: ApprovalSummary): string | null {
  if (summary.total === 0) return null;
  const approved = `${summary.approved} / ${summary.total} approved`;
  return summary.pending > 0 ? `${approved} · ${summary.pending} pending` : approved;
}

export type ReviewVisibility = {
  /** Rows the Needs review filter shows: non-approved counted leaves and all their ancestors. */
  visibleIds: Set<string>;
  /** The shown leaves' ancestors, rendered open whatever their saved isOpen says. */
  forceOpenIds: Set<string>;
};

/**
 * What the Needs review filter shows (spec R20): every counted leaf that isn't approved, plus its
 * ancestors. A counted leaf for which `statusOf` returns undefined is treated as unapproved, as in
 * buildApprovalStats, and a fully approved subtree is left out entirely. This is a render-time
 * overlay: it never touches the nodes, so the template's saved isOpen is unchanged.
 */
export function needsReviewVisibility(
  nodes: FlatNode<CustomData>[],
  statusOf: (entityId: string) => AccountantStatus | undefined,
): ReviewVisibility {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const visibleIds = new Set<string>();
  const forceOpenIds = new Set<string>();

  for (const node of nodes) {
    if (!isCountedLeaf(node)) continue;
    if ((statusOf(node.id) ?? AccountantStatus.Unapproved) === AccountantStatus.Approved) continue;
    visibleIds.add(node.id);
    // Walk up until the tree root (which isn't a node) or an ancestor another leaf already added.
    let parent = nodeById.get(node.parent);
    while (parent && !forceOpenIds.has(parent.id)) {
      forceOpenIds.add(parent.id);
      visibleIds.add(parent.id);
      parent = nodeById.get(parent.parent);
    }
  }

  return { visibleIds, forceOpenIds };
}
