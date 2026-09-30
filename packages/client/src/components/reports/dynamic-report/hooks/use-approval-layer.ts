import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'sonner';
import { useClient } from 'urql';
import {
  DynamicReportSnapshotDocument,
  type AccountantStatus,
  type DynamicReportLeafApprovalInput,
} from '../../../../gql/graphql.js';
import {
  applyBulk,
  applyOverride,
  buildApprovalsInput,
  buildApprovalStats,
  buildEffectiveStatuses,
  countedLeafIds,
  deriveLeafStatuses,
  deriveSaveStatuses,
  approvalsDisabledReason as getApprovalsDisabledReason,
  needsReviewVisibility,
  summarizeApprovals,
  type ApprovalOverrides,
  type ApprovalStats,
  type ApprovalSummary,
  type EffectiveApproval,
  type ReviewVisibility,
} from '../utils/approvals.js';
import type { Baseline } from '../utils/diff.js';
import type { CustomData, FlatNode } from '../utils/types.js';
import type { BaselineSnapshot } from './use-baseline-diff.js';

export type ApprovalLayerInput = {
  reportTree: FlatNode<CustomData>[];
  /**
   * Staged statuses and their setter. The state stays with DynamicReport, which also clears it on
   * template switches, scope changes and saves; this layer only reads it and stages into it.
   */
  approvalOverrides: ApprovalOverrides;
  setApprovalOverrides: Dispatch<SetStateAction<ApprovalOverrides>>;
  /** From useBaselineDiff. */
  baseline: Baseline | null;
  baselineSnapshot: BaselineSnapshot | null;
  latestBaselineId: string | null;
  activeBaselineId: string | null;
  snapshotFetching: boolean;
  /** The period and owner on screen. */
  fromDate: string;
  toDate: string;
  scopeOwnerId: string;
  /** Whether a saved template is loaded (currentTemplate is set). */
  hasTemplate: boolean;
  /** The ?review=1 param: the Needs review filter as the user set it. */
  reviewOnly: boolean;
  /**
   * The rest of the report's loading state, taken as is: the loaded template's name is compared
   * with the selected one unnormalised, so with no template selected (undefined vs null) this layer
   * reads as loading, exactly as before the move.
   */
  templateNodesFetching: boolean;
  businessSumsFetching: boolean;
  loadedTemplateName: string | undefined;
  selectedTemplateName: string | null;
  hasBusinessSums: boolean;
};

export type ApprovalLayer = {
  /** Each counted leaf's status as derived from the baseline, before staged overrides. */
  leafStatuses: Map<string, EffectiveApproval>;
  /** Each counted leaf's status as shown: derived, with the staged overrides on top. */
  effectiveStatuses: Map<string, EffectiveApproval>;
  approvalStats: ApprovalStats;
  approvalSummary: ApprovalSummary;
  /** The Needs review overlay, or null while the filter is off. */
  reviewVisibility: ReviewVisibility | null;
  /** True until the statuses on screen are final. */
  isApprovalDataLoading: boolean;
  /** Why statuses can't be changed right now, or null when they can. */
  approvalsDisabledReason: string | null;
  handleLeafApprovalChange: (entityId: string, status: AccountantStatus) => void;
  handleBranchApprovalChange: (branchId: string, status: AccountantStatus) => void;
  /** The statuses a Resave or Capture sends, or null (after telling the user) when it mustn't save. */
  resolveSaveApprovals: () => Promise<DynamicReportLeafApprovalInput[] | null>;
};

/**
 * The accountant-approval layer: derives each leaf's status from the baseline, lays the staged
 * overrides on top, rolls them up, and resolves what a save sends. A pure move out of DynamicReport.
 */
export function useApprovalLayer({
  reportTree,
  approvalOverrides,
  setApprovalOverrides,
  baseline,
  baselineSnapshot,
  latestBaselineId,
  activeBaselineId,
  snapshotFetching,
  fromDate,
  toDate,
  scopeOwnerId,
  hasTemplate,
  reviewOnly,
  templateNodesFetching,
  businessSumsFetching,
  loadedTemplateName,
  selectedTemplateName,
  hasBusinessSums,
}: ApprovalLayerInput): ApprovalLayer {
  // Only a comparable baseline's statuses apply: another period's or owner's approvals answer a
  // different question, so without one every leaf reads UNAPPROVED.
  const baselineApprovals = baseline ? (baselineSnapshot?.approvals ?? null) : null;
  const leafStatuses = useMemo(
    () => deriveLeafStatuses(reportTree, baselineApprovals, baseline?.fingerprints ?? new Map()),
    [reportTree, baselineApprovals, baseline],
  );

  const effectiveStatuses = useMemo(
    () => buildEffectiveStatuses(leafStatuses, approvalOverrides),
    [leafStatuses, approvalOverrides],
  );

  const approvalStats = useMemo(
    () => buildApprovalStats(reportTree, entityId => effectiveStatuses.get(entityId)?.status),
    [reportTree, effectiveStatuses],
  );

  const approvalSummary = useMemo(() => summarizeApprovals(effectiveStatuses), [effectiveStatuses]);

  // The Needs review filter only narrows what the report panel renders. Editing, drag and drop,
  // saving and the CSV all keep working on the full reportTree, and the saved isOpen is untouched.
  // Statuses live on a template's snapshots, so the filter applies only with a template loaded.
  const isReviewFilterOn = reviewOnly && hasTemplate;
  const reviewVisibility = useMemo(
    () =>
      isReviewFilterOn
        ? needsReviewVisibility(reportTree, entityId => effectiveStatuses.get(entityId)?.status)
        : null,
    [isReviewFilterOn, reportTree, effectiveStatuses],
  );

  // Statuses are saved with the template's latest snapshot, so they can only change when there is
  // a template, its latest baseline is the one on screen, and the statuses derived from it are final.
  // Not having the template's snapshot list yet counts as loading, not as "no baseline": with no
  // list, latestBaselineId is null and every leaf would read UNAPPROVED.
  const isApprovalDataLoading =
    templateNodesFetching ||
    businessSumsFetching ||
    snapshotFetching ||
    loadedTemplateName !== selectedTemplateName ||
    !hasBusinessSums ||
    (!!activeBaselineId && baselineSnapshot?.id !== activeBaselineId);
  const approvalsDisabledReason = getApprovalsDisabledReason({
    hasTemplate,
    isLoading: isApprovalDataLoading,
    isLatestBaseline: activeBaselineId === latestBaselineId,
  });

  const handleLeafApprovalChange = useCallback(
    (entityId: string, status: AccountantStatus) => {
      setApprovalOverrides(prev => applyOverride(prev, entityId, status, leafStatuses));
    },
    [setApprovalOverrides, leafStatuses],
  );

  const handleBranchApprovalChange = useCallback(
    (branchId: string, status: AccountantStatus) => {
      const leafIds = countedLeafIds(reportTree, branchId);
      setApprovalOverrides(prev => applyBulk(prev, leafIds, status, leafStatuses));
    },
    [setApprovalOverrides, reportTree, leafStatuses],
  );

  const client = useClient();

  // The statuses a Resave or Capture sends. The server stamps them against the newest comparable
  // snapshot, so they have to be that snapshot's statuses plus the staged ones. When it is the
  // baseline on screen (or there is none) that is exactly effectiveStatuses. While an older baseline
  // is pinned, the statuses on screen are that older save's, and sending them would write them back
  // as fresh choices — so the newest one is fetched and the statuses derived from it instead.
  // Returns null, after telling the user, when it can't be read: saving without statuses would
  // drop every one of them. The same goes while the report is still loading: until the snapshot
  // list arrives latestBaselineId reads as "no baseline", every leaf as UNAPPROVED, and sending that
  // would overwrite the stored statuses.
  const resolveSaveApprovals = useCallback(async (): Promise<
    DynamicReportLeafApprovalInput[] | null
  > => {
    if (isApprovalDataLoading) {
      toast.error('Error', {
        description: 'The report is still loading, so nothing was saved. Try again in a moment',
      });
      return null;
    }
    if (!latestBaselineId || baselineSnapshot?.id === latestBaselineId) {
      return buildApprovalsInput(reportTree, effectiveStatuses);
    }
    const { data, error } = await client
      .query(
        DynamicReportSnapshotDocument,
        { id: latestBaselineId },
        { requestPolicy: 'network-only' },
      )
      .toPromise();
    const latest = data?.dynamicReportSnapshot;
    if (error || !latest) {
      toast.error('Error', {
        description: 'Could not load the latest save’s statuses, so nothing was saved',
      });
      return null;
    }
    const statuses = deriveSaveStatuses(
      reportTree,
      latest,
      { fromDate, toDate, scopeOwnerId },
      approvalOverrides,
    );
    return buildApprovalsInput(reportTree, statuses);
  }, [
    isApprovalDataLoading,
    latestBaselineId,
    baselineSnapshot,
    reportTree,
    effectiveStatuses,
    client,
    fromDate,
    toDate,
    scopeOwnerId,
    approvalOverrides,
  ]);

  return {
    leafStatuses,
    effectiveStatuses,
    approvalStats,
    approvalSummary,
    reviewVisibility,
    isApprovalDataLoading,
    approvalsDisabledReason,
    handleLeafApprovalChange,
    handleBranchApprovalChange,
    resolveSaveApprovals,
  };
}
