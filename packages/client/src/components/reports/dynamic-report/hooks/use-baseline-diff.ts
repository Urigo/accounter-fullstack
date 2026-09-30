import { useMemo } from 'react';
import { useQuery } from 'urql';
import {
  DynamicReportSnapshotDocument,
  type DynamicReportSnapshotQuery,
  type DynamicReportTemplateQuery,
} from '../../../../gql/graphql.js';
import { pickLatestBaselineId } from '../utils/baseline.js';
import {
  buildReportDiff,
  findNewEntityIds,
  type Baseline,
  type ReportDiff,
} from '../utils/diff.js';
import type { CustomData, FlatNode } from '../utils/types.js';

export type BaselineSnapshot = NonNullable<DynamicReportSnapshotQuery['dynamicReportSnapshot']>;

type TemplateSnapshots = NonNullable<DynamicReportTemplateQuery['dynamicReport']>['snapshots'];

export type BaselineDiffInput = {
  /** The loaded template query, whose snapshot list the baselines are picked from. */
  templateNodesData: DynamicReportTemplateQuery | undefined;
  /** The period and owner on screen: the scope a baseline must match to be compared against. */
  fromDate: string;
  toDate: string;
  scopeOwnerId: string;
  /** The ?baseline= param: a pinned snapshot id, or null for "Last save". */
  selectedBaselineId: string | null;
  reportTree: FlatNode<CustomData>[];
  /** The figures on screen: one entry per entity with ledger activity in the period. */
  businessSums: readonly { business: { id: string } }[];
};

export type BaselineDiff = {
  /** The template's snapshots, newest first; empty until the template loads. */
  snapshots: TemplateSnapshots;
  /** The newest snapshot for the scope on screen, or the head when none matches. */
  latestBaselineId: string | null;
  /** The pinned baseline when it exists, otherwise latestBaselineId. */
  activeBaselineId: string | null;
  /** The active baseline as read, or null until it arrives. */
  baselineSnapshot: BaselineSnapshot | null;
  snapshotFetching: boolean;
  /** Whether baselineSnapshot covers the period and owner on screen. */
  isBaselineComparable: boolean;
  /** The comparable baseline, or null while the diff is suspended. */
  baseline: Baseline | null;
  reportDiff: ReportDiff | null;
  /** Entities with activity now that the baseline never saw; undefined without a baseline. */
  newEntityIds: Set<string> | undefined;
};

/**
 * The change-tracking layer: which saved snapshot the report is compared against, and the diff
 * against it. A pure move out of DynamicReport; picking a baseline (handleBaselineChange) stays
 * there, since it goes through the scope guard.
 */
export function useBaselineDiff({
  templateNodesData,
  fromDate,
  toDate,
  scopeOwnerId,
  selectedBaselineId,
  reportTree,
  businessSums,
}: BaselineDiffInput): BaselineDiff {
  const snapshots = useMemo(
    () => templateNodesData?.dynamicReport?.snapshots ?? [],
    [templateNodesData],
  );
  // "Last save" is the newest snapshot for the period and owner on screen, so a save made for
  // another period or owner does not displace it. Only when none matches does the head stand in,
  // and the diff then stays suspended because it is not comparable.
  const latestBaselineId = useMemo(
    () => pickLatestBaselineId(snapshots, { fromDate, toDate, scopeOwnerId }),
    [snapshots, fromDate, toDate, scopeOwnerId],
  );
  const activeBaselineId =
    snapshots.find(snapshot => snapshot.id === selectedBaselineId)?.id ?? latestBaselineId;

  const [{ data: snapshotData, fetching: snapshotFetching }] = useQuery({
    query: DynamicReportSnapshotDocument,
    variables: { id: activeBaselineId ?? '' },
    pause: !activeBaselineId,
  });

  const baselineSnapshot = snapshotData?.dynamicReportSnapshot ?? null;

  // A snapshot is only comparable to a report computed over the same period for the same owner.
  // Anything else — a deep link's date override, a different owner — and the figures are answers to
  // a different question, so the diff is suspended rather than shown wrong.
  const isBaselineComparable =
    !!baselineSnapshot &&
    baselineSnapshot.fromDate === fromDate &&
    baselineSnapshot.toDate === toDate &&
    baselineSnapshot.scopeOwnerId === scopeOwnerId;

  const baseline = useMemo<Baseline | null>(() => {
    if (!baselineSnapshot || !isBaselineComparable) return null;
    return {
      tree: baselineSnapshot.tree,
      values: new Map(baselineSnapshot.values.map(value => [value.entityId, value.value])),
      // Legacy rows carry no fingerprint; leaving them out suppresses the `records` change kind.
      fingerprints: new Map(
        baselineSnapshot.values.flatMap(value =>
          value.fingerprint == null ? [] : [[value.entityId, value.fingerprint] as const],
        ),
      ),
    };
  }, [baselineSnapshot, isBaselineComparable]);

  const reportDiff = useMemo(
    () => (baseline ? buildReportDiff(reportTree, baseline) : null),
    [reportTree, baseline],
  );

  const newEntityIds = useMemo(
    () =>
      baseline
        ? findNewEntityIds(
            businessSums.map(sum => sum.business.id),
            baseline,
          )
        : undefined,
    [businessSums, baseline],
  );

  return {
    snapshots,
    latestBaselineId,
    activeBaselineId,
    baselineSnapshot,
    snapshotFetching,
    isBaselineComparable,
    baseline,
    reportDiff,
    newEntityIds,
  };
}
