import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toast } from 'sonner';
import { Client, Provider, type Exchange, type OperationResult } from 'urql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { map, pipe } from 'wonka';
import { AccountantStatus, type DynamicReportTemplateQuery } from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import {
  useApprovalLayer,
  type ApprovalLayer,
  type ApprovalLayerInput,
} from '../hooks/use-approval-layer.js';
import {
  useBaselineDiff,
  type BaselineDiff,
  type BaselineSnapshot,
} from '../hooks/use-baseline-diff.js';
import type { ApprovalOverrides } from '../utils/approvals.js';
import type { CustomData, FlatNode } from '../utils/types.js';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ── fixtures ────────────────────────────────────────────────────────────────────

const FROM = '2026-01-01' as TimelessDateString;
const TO = '2026-06-30' as TimelessDateString;
const OWNER = 'owner-1';

function leaf(id: string, parent: string, value: number): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value, fingerprint: `fp-${id}` },
  };
}

const branchB: FlatNode<CustomData> = {
  id: 'b',
  parent: 'report',
  text: 'Branch b',
  droppable: true,
  data: { nodeType: 'synthetic-branch', isOpen: true },
};

const reportTree = [branchB, leaf('a', 'b', 10), leaf('c', 'b', 20)];

function snapshot(
  id: string,
  approvals: { entityId: string; status: AccountantStatus }[],
  scope: { fromDate?: TimelessDateString; toDate?: TimelessDateString } = {},
): BaselineSnapshot {
  return {
    id,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    fromDate: scope.fromDate ?? FROM,
    toDate: scope.toDate ?? TO,
    scopeOwnerId: OWNER,
    tree: reportTree.map(node => ({
      id: node.id,
      parent: node.parent,
      text: node.text,
      droppable: node.droppable,
      data: {
        nodeType: node.data.nodeType,
        isOpen: node.data.isOpen,
        hebrewText: null,
        sortCode: null,
      },
    })),
    values: [
      { entityId: 'a', value: 10, fingerprint: 'fp-a' },
      { entityId: 'c', value: 15, fingerprint: 'fp-c' },
    ],
    approvals: approvals.map(approval => ({
      ...approval,
      setAt: new Date('2026-07-01T00:00:00Z'),
      setBy: 'Dana',
      isSystem: false,
    })),
  };
}

/** The template query's snapshot list, newest first, as the hooks read it. */
function templateData(
  snapshots: { id: string; fromDate?: TimelessDateString }[],
): DynamicReportTemplateQuery {
  return {
    dynamicReport: {
      id: 'owner-1-T',
      name: 'T',
      isLocked: false,
      updated: new Date('2026-07-01T00:00:00Z'),
      fromDate: FROM,
      toDate: TO,
      snapshots: snapshots.map(s => ({
        id: s.id,
        createdAt: new Date('2026-07-01T00:00:00Z'),
        fromDate: s.fromDate ?? FROM,
        toDate: TO,
        scopeOwnerId: OWNER,
      })),
      template: [],
    },
  };
}

/** Answers DynamicReportSnapshot from `snapshots` by id, synchronously; records the ids asked. */
function mockClient(snapshots: Record<string, BaselineSnapshot>, asked: string[]): Client {
  const exchange: Exchange = () => operations$ =>
    pipe(
      operations$,
      map((operation): OperationResult => {
        const id = (operation.variables as { id: string }).id;
        // urql may execute one query more than once while mounting; record each id once.
        if (operation.kind === 'query' && !asked.includes(id)) asked.push(id);
        return {
          operation,
          data: { dynamicReportSnapshot: snapshots[id] ?? null },
          error: undefined,
          extensions: undefined,
          hasNext: false,
          stale: false,
        };
      }),
    );
  return new Client({ url: '/graphql', exchanges: [exchange] });
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(toast.error).mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// ── useBaselineDiff ─────────────────────────────────────────────────────────────

function renderBaselineDiff(
  client: Client,
  input: Partial<Parameters<typeof useBaselineDiff>[0]>,
): { current: BaselineDiff } {
  const result = {} as { current: BaselineDiff };
  function Probe(): null {
    result.current = useBaselineDiff({
      templateNodesData: undefined,
      fromDate: FROM,
      toDate: TO,
      scopeOwnerId: OWNER,
      selectedBaselineId: null,
      reportTree,
      businessSums: [
        { business: { id: 'a' } },
        { business: { id: 'c' } },
        { business: { id: 'n' } },
      ],
      ...input,
    });
    return null;
  }
  act(() =>
    root.render(
      <Provider value={client}>
        <Probe />
      </Provider>,
    ),
  );
  return result;
}

describe('useBaselineDiff', () => {
  it('compares against the newest snapshot for the scope on screen', () => {
    const asked: string[] = [];
    const client = mockClient({ s2: snapshot('s2', []) }, asked);
    const result = renderBaselineDiff(client, {
      templateNodesData: templateData([
        { id: 'other', fromDate: '2025-01-01' as TimelessDateString },
        { id: 's2' },
      ]),
    });
    expect(result.current.latestBaselineId).toBe('s2');
    expect(result.current.activeBaselineId).toBe('s2');
    expect(asked).toEqual(['s2']);
    expect(result.current.isBaselineComparable).toBe(true);
    expect(result.current.reportDiff?.byNodeId.get('c')).toEqual([
      { kind: 'value', previous: 15, delta: 5 },
    ]);
    expect(result.current.newEntityIds).toEqual(new Set(['n']));
  });

  it('falls back to the latest baseline when the pinned id is not in the list', () => {
    const client = mockClient({ s2: snapshot('s2', []) }, []);
    const result = renderBaselineDiff(client, {
      templateNodesData: templateData([{ id: 's2' }]),
      selectedBaselineId: 'gone',
    });
    expect(result.current.activeBaselineId).toBe('s2');
  });

  it('suspends the diff against a snapshot for another period', () => {
    const client = mockClient(
      { s1: snapshot('s1', [], { fromDate: '2025-01-01' as TimelessDateString }) },
      [],
    );
    const result = renderBaselineDiff(client, {
      templateNodesData: templateData([{ id: 's1', fromDate: '2025-01-01' as TimelessDateString }]),
    });
    // No comparable snapshot, so the head stands in and is read, but not compared against.
    expect(result.current.activeBaselineId).toBe('s1');
    expect(result.current.baselineSnapshot?.id).toBe('s1');
    expect(result.current.isBaselineComparable).toBe(false);
    expect(result.current.baseline).toBeNull();
    expect(result.current.reportDiff).toBeNull();
    expect(result.current.newEntityIds).toBeUndefined();
  });

  it('queries nothing without a template', () => {
    const asked: string[] = [];
    const result = renderBaselineDiff(mockClient({}, asked), {});
    expect(result.current.snapshots).toEqual([]);
    expect(result.current.activeBaselineId).toBeNull();
    expect(asked).toEqual([]);
  });
});

// ── useApprovalLayer ────────────────────────────────────────────────────────────

type Probed = { layer: ApprovalLayer; overrides: ApprovalOverrides };

/**
 * Runs useBaselineDiff and useApprovalLayer together, wired as DynamicReport wires them, with the
 * overrides state held by the probe.
 */
function renderApprovalLayer(
  client: Client,
  {
    templateNodesData,
    selectedBaselineId = null,
    ...input
  }: Partial<ApprovalLayerInput> & {
    templateNodesData?: DynamicReportTemplateQuery;
    selectedBaselineId?: string | null;
  },
): { current: Probed } {
  const result = {} as { current: Probed };
  function Probe(): ReactElement | null {
    const [approvalOverrides, setApprovalOverrides] = useState<ApprovalOverrides>(() => new Map());
    const diff = useBaselineDiff({
      templateNodesData,
      fromDate: FROM,
      toDate: TO,
      scopeOwnerId: OWNER,
      selectedBaselineId,
      reportTree,
      businessSums: [],
    });
    const layer = useApprovalLayer({
      reportTree,
      approvalOverrides,
      setApprovalOverrides,
      baseline: diff.baseline,
      baselineSnapshot: diff.baselineSnapshot,
      latestBaselineId: diff.latestBaselineId,
      activeBaselineId: diff.activeBaselineId,
      snapshotFetching: diff.snapshotFetching,
      fromDate: FROM,
      toDate: TO,
      scopeOwnerId: OWNER,
      hasTemplate: true,
      reviewOnly: false,
      templateNodesFetching: false,
      businessSumsFetching: false,
      loadedTemplateName: 'T',
      selectedTemplateName: 'T',
      hasBusinessSums: true,
      ...input,
    });
    result.current = { layer, overrides: approvalOverrides };
    return null;
  }
  act(() =>
    root.render(
      <Provider value={client}>
        <Probe />
      </Provider>,
    ),
  );
  return result;
}

describe('useApprovalLayer', () => {
  const snapshots = {
    old: snapshot('old', [{ entityId: 'a', status: AccountantStatus.Pending }]),
    new: snapshot('new', [
      { entityId: 'a', status: AccountantStatus.Approved },
      { entityId: 'c', status: AccountantStatus.Pending },
    ]),
  };
  const bothSaves = templateData([{ id: 'new' }, { id: 'old' }]);

  it('derives statuses from the baseline and rolls them up', () => {
    const result = renderApprovalLayer(mockClient(snapshots, []), { templateNodesData: bothSaves });
    const { layer } = result.current;
    expect(layer.isApprovalDataLoading).toBe(false);
    expect(layer.approvalsDisabledReason).toBeNull();
    expect(layer.effectiveStatuses.get('a')?.status).toBe(AccountantStatus.Approved);
    expect(layer.effectiveStatuses.get('c')?.status).toBe(AccountantStatus.Pending);
    expect(layer.approvalStats.get('b')).toEqual({ approved: 1, pending: 1, unapproved: 0 });
    expect(layer.approvalSummary).toEqual({ approved: 1, pending: 1, unapproved: 0, total: 2 });
  });

  it('stages leaf and branch changes into the overrides', () => {
    const result = renderApprovalLayer(mockClient(snapshots, []), { templateNodesData: bothSaves });
    act(() => result.current.layer.handleLeafApprovalChange('c', AccountantStatus.Approved));
    expect(result.current.overrides).toEqual(new Map([['c', AccountantStatus.Approved]]));
    expect(result.current.layer.effectiveStatuses.get('c')).toEqual({
      status: AccountantStatus.Approved,
      isStaged: true,
    });

    act(() => result.current.layer.handleBranchApprovalChange('b', AccountantStatus.Unapproved));
    expect(result.current.overrides).toEqual(
      new Map([
        ['a', AccountantStatus.Unapproved],
        ['c', AccountantStatus.Unapproved],
      ]),
    );
  });

  it('refuses to resolve save statuses while the report is loading', async () => {
    const result = renderApprovalLayer(mockClient(snapshots, []), {
      templateNodesData: bothSaves,
      businessSumsFetching: true,
    });
    expect(result.current.layer.approvalsDisabledReason).toBe('Loading…');
    await expect(result.current.layer.resolveSaveApprovals()).resolves.toBeNull();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('reads as loading until the selected template’s data is the one loaded', () => {
    const result = renderApprovalLayer(mockClient(snapshots, []), {
      templateNodesData: bothSaves,
      loadedTemplateName: undefined,
      selectedTemplateName: null,
    });
    expect(result.current.layer.isApprovalDataLoading).toBe(true);
  });

  it('sends the statuses on screen, staged ones included, when the latest baseline is shown', async () => {
    const asked: string[] = [];
    const result = renderApprovalLayer(mockClient(snapshots, asked), {
      templateNodesData: bothSaves,
    });
    act(() => result.current.layer.handleLeafApprovalChange('c', AccountantStatus.Approved));
    await expect(result.current.layer.resolveSaveApprovals()).resolves.toEqual([
      { entityId: 'a', status: AccountantStatus.Approved },
      { entityId: 'c', status: AccountantStatus.Approved },
    ]);
    expect(asked).toEqual(['new']);
  });

  it('sends the latest save’s statuses, not the pinned one’s, while an older baseline is pinned', async () => {
    const asked: string[] = [];
    const result = renderApprovalLayer(mockClient(snapshots, asked), {
      templateNodesData: bothSaves,
      selectedBaselineId: 'old',
    });
    const { layer } = result.current;
    expect(layer.effectiveStatuses.get('a')?.status).toBe(AccountantStatus.Pending);
    expect(layer.approvalsDisabledReason).toBe(
      'Viewing an older baseline — switch to Last save to review',
    );
    await expect(layer.resolveSaveApprovals()).resolves.toEqual([
      { entityId: 'a', status: AccountantStatus.Approved },
      { entityId: 'c', status: AccountantStatus.Pending },
    ]);
    expect(asked).toEqual(['old', 'new']);
  });

  it('applies the Needs review filter only with a template loaded', () => {
    const client = mockClient(snapshots, []);
    const on = renderApprovalLayer(client, { templateNodesData: bothSaves, reviewOnly: true });
    expect(on.current.layer.reviewVisibility?.visibleIds).toEqual(new Set(['c', 'b']));

    const noTemplate = renderApprovalLayer(client, {
      templateNodesData: bothSaves,
      reviewOnly: true,
      hasTemplate: false,
    });
    expect(noTemplate.current.layer.reviewVisibility).toBeNull();
    expect(noTemplate.current.layer.approvalsDisabledReason).toBe('Load a saved template');
  });
});
