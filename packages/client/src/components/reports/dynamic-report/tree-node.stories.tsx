import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccountantStatus } from '../../../gql/graphql.js';
import type { RowComments } from './comment-indicator.js';
import type { RowAnnotations } from './row-trailing.js';
import { TreeNodeRow } from './tree-node.js';
import { buildNodeStats, type CustomData, type FlatNode } from './utils/types.js';

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const BRANCH: FlatNode<CustomData> = {
  id: 'branch-revenue',
  parent: 'report',
  text: 'Revenue',
  droppable: true,
  data: { nodeType: 'synthetic-branch', isOpen: false },
};

const SORT_CODE_BRANCH: FlatNode<CustomData> = {
  id: 'owner-1|800',
  parent: 'bank',
  text: '800 — Software subscriptions',
  droppable: true,
  data: { nodeType: 'sort-code-branch', sortCode: 800, isOpen: false },
};

const LEAF: FlatNode<CustomData> = {
  id: 'fe-1',
  parent: 'branch-revenue',
  text: 'Acme Ltd',
  droppable: false,
  data: { nodeType: 'financial-entity', isOpen: false, value: 18_200 },
};

const BANK_LEAF: FlatNode<CustomData> = {
  ...LEAF,
  id: 'fe-2',
  parent: SORT_CODE_BRANCH.id,
  text: 'Vercel',
  data: { ...LEAF.data, value: -4250 },
};

const GHOST: FlatNode<CustomData> = {
  ...LEAF,
  id: 'fe-3',
  text: 'Globex Corp',
  data: { ...LEAF.data, value: 3100 },
};

const NODE_STATS = buildNodeStats([BRANCH, LEAF, SORT_CODE_BRANCH, BANK_LEAF, GHOST]);

const LEAF_ANNOTATIONS: RowAnnotations = {
  diff: { changes: [{ kind: 'value', previous: 16_000, delta: 2200 }], subtreeDelta: 2200 },
  approval: {
    kind: 'leaf',
    approval: {
      status: AccountantStatus.Approved,
      setBy: 'Dana Levi',
      setAt: '2026-09-01T10:00:00.000Z',
    },
    onChange: () => void 0,
    disabledReason: null,
  },
};

const BRANCH_ANNOTATIONS: RowAnnotations = {
  diff: { changes: [{ kind: 'renamed', previousText: 'Income' }], subtreeDelta: 5300 },
  approval: {
    kind: 'branch',
    counts: { approved: 1, pending: 1, unapproved: 0 },
    onChange: () => void 0,
    disabledReason: null,
  },
};

const COMMENTS: RowComments = {
  own: { threadId: 't1', isOpen: true, messageCount: 3, lastMessageAt: null },
  openBelow: 0,
  isActive: false,
  label: 'Acme Ltd',
  onOpen: () => void 0,
};

/* -------------------------------------------------------------------------- */
/*  Stories                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One row of the dynamic report's trees. Every row ends in the shared `RowTrailing`: diff markers,
 * the amount, the row's own controls, then — on report rows only — one fixed-width slot per layer
 * (comments, then the approval status), so each layer lines up as a column. Bank rows have no
 * slots. The comments slot appears once a saved template is loaded.
 */
const meta = {
  title: 'Reports/DynamicReport/TreeNodeRow',
  component: TreeNodeRow,
  decorators: [
    Story => (
      <div className="max-w-2xl border rounded-lg bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    node: LEAF,
    depth: 1,
    treeId: 'report',
    nodeStats: NODE_STATS,
    editMode: false,
    onToggleExpand: () => void 0,
  },
} satisfies Meta<typeof TreeNodeRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A report leaf whose value changed since the last save, with its approval status. */
export const ReportLeaf: Story = {
  args: { annotations: LEAF_ANNOTATIONS },
};

/** A renamed report branch with a mixed approval rollup; collapsed, so its leaf count shows. */
export const ReportBranch: Story = {
  args: { node: BRANCH, depth: 0, annotations: BRANCH_ANNOTATIONS },
};

/** A report row no layer has anything to say about still reserves its slots. */
export const ReportLeafWithoutAnnotations: Story = {};

/** A bank sort-code branch: no status slot, even when annotated. */
export const BankBranch: Story = {
  args: {
    node: SORT_CODE_BRANCH,
    depth: 0,
    treeId: 'bank',
    annotations: { diff: { changes: [{ kind: 'added' }] } },
  },
};

/** A bank leaf that is new since the baseline. */
export const BankLeaf: Story = {
  args: {
    node: BANK_LEAF,
    treeId: 'bank',
    annotations: { diff: { changes: [{ kind: 'added' }] } },
  },
};

/** A leaf removed since the last save: struck through, no controls, an empty status slot. */
export const GhostRow: Story = {
  args: {
    node: GHOST,
    annotations: {
      diff: { changes: [{ kind: 'removed', previousValue: 3100 }], isGhost: true },
    },
  },
};

/** A report leaf with an open discussion: the comments slot sits just before the status. */
export const ReportLeafWithComments: Story = {
  args: { annotations: { ...LEAF_ANNOTATIONS, comments: COMMENTS } },
};

/** A collapsed branch with no thread of its own but open threads inside: a dot. */
export const ReportBranchWithOpenThreadsInside: Story = {
  args: {
    node: BRANCH,
    depth: 0,
    annotations: {
      ...BRANCH_ANNOTATIONS,
      comments: { ...COMMENTS, own: undefined, openBelow: 2, label: 'Revenue' },
    },
  },
};

/** A report row without a thread: hover it for the "add comment" button. */
export const ReportLeafWithoutThread: Story = {
  args: { annotations: { ...LEAF_ANNOTATIONS, comments: { ...COMMENTS, own: undefined } } },
};

/** A ghost row shows its thread read-only. */
export const GhostRowWithThread: Story = {
  args: {
    node: GHOST,
    annotations: {
      diff: { changes: [{ kind: 'removed', previousValue: 3100 }], isGhost: true },
      comments: { ...COMMENTS, readOnly: true, label: 'Globex Corp' },
    },
  },
};
