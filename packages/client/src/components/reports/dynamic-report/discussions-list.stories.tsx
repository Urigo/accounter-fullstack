import type { Meta, StoryObj } from '@storybook/react-vite';
import { DiscussionsList } from './discussions-list.js';
import type { CommentMessage, CommentThread, DiscussionGroups } from './utils/comments.js';

const VIEW = { fromDate: '2026-01-01', toDate: '2026-12-31', scopeOwnerId: 'owner-1' };

function message(id: string, extra: Partial<CommentMessage> = {}): CommentMessage {
  return {
    id,
    content: 'Revenue from Acme dropped by a third against last year. Missing invoices?',
    createdAt: '2026-09-01T10:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    author: 'Dana Levi',
    isMine: false,
    ...VIEW,
    ...extra,
  };
}

function thread(
  nodeId: string,
  nodeLabel: string,
  messages: CommentMessage[],
  extra: Partial<CommentThread> = {},
): CommentThread {
  return {
    id: `t-${nodeId}`,
    nodeId,
    nodeKind: 'LEAF',
    nodeLabel,
    createdAt: '2026-09-01T10:00:00.000Z',
    resolvedAt: null,
    resolvedBy: null,
    messages,
    ...extra,
  };
}

const PATHS: Record<string, string[]> = {
  'fe-acme': ['Revenue', 'Services'],
  'branch-expenses': [],
  'fe-vercel': ['Expenses', 'Software'],
};

const GROUPS: DiscussionGroups = {
  open: [
    thread('fe-acme', 'Acme Ltd', [
      message('m1'),
      message('m2', {
        author: 'Noa Cohen',
        content: 'Two invoices were issued in January instead of December.',
        createdAt: '2026-09-01T11:30:00.000Z',
      }),
    ]),
    thread(
      'branch-expenses',
      'Expenses',
      [message('m3', { content: 'Why did total expenses grow 40% this quarter?' })],
      { nodeKind: 'BRANCH' },
    ),
  ],
  resolved: [
    thread(
      'fe-vercel',
      'Vercel',
      [message('m4', { content: 'Is this sort code right for software subscriptions?' })],
      { resolvedAt: '2026-09-02T08:00:00.000Z', resolvedBy: 'Dana Levi' },
    ),
  ],
  detached: [
    {
      thread: thread('fe-globex', 'Globex Corp', [
        message('m5', { content: 'No activity since March — was the contract ended?' }),
      ]),
      reason: 'hidden-in-period',
      isGhost: false,
    },
    {
      thread: thread('fe-initech', 'Initech', [
        message('m6', { content: null, deletedAt: '2026-09-03T00:00:00.000Z' }),
      ]),
      reason: 'not-in-report',
      isGhost: true,
    },
    {
      thread: thread(
        'branch-old',
        'Old grouping',
        [message('m7', { content: 'Folded into Services.' })],
        { resolvedAt: '2026-09-03T00:00:00.000Z', nodeKind: 'BRANCH' },
      ),
      reason: 'not-in-report',
      isGhost: false,
    },
  ],
};

/**
 * Every discussion of a template, opened from the toolbar's Discussions button. Picking one
 * reveals its row in the report (opening the branches above it) and opens its thread.
 */
const meta = {
  title: 'Reports/DynamicReport/DiscussionsList',
  component: DiscussionsList,
  parameters: { layout: 'centered' },
  decorators: [
    Story => (
      <div className="flex h-160 w-md flex-col border bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    groups: GROUPS,
    onSelect: () => void 0,
    pathOf: t => PATHS[t.nodeId] ?? [],
  },
} satisfies Meta<typeof DiscussionsList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All three groups: Open, Resolved, and Not in report with each reason. */
export const AllGroups: Story = {};

/** No thread on this template yet. */
export const Empty: Story = { args: { groups: { open: [], resolved: [], detached: [] } } };

/** The first load. */
export const Loading: Story = {
  args: { groups: { open: [], resolved: [], detached: [] }, isLoading: true },
};

/** The threads couldn't be loaded. */
export const LoadFailed: Story = { args: { error: 'The discussions couldn’t be loaded.' } };
