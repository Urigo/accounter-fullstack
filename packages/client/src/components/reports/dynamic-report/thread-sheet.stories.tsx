import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button.js';
import type { CommentsLayer, SheetState } from './hooks/use-comments-layer.js';
import { ThreadSheet } from './thread-sheet.js';
import { groupDiscussions, type CommentMessage, type CommentThread } from './utils/comments.js';

const VIEW = { fromDate: '2026-01-01', toDate: '2026-12-31', scopeOwnerId: 'owner-1' };

function message(id: string, extra: Partial<CommentMessage>): CommentMessage {
  return {
    id,
    content: '',
    createdAt: '2026-09-01T10:00:00.000Z',
    editedAt: null,
    deletedAt: null,
    author: 'Dana Levi',
    isMine: false,
    ...VIEW,
    ...extra,
  };
}

const THREAD: CommentThread = {
  id: 't-acme',
  nodeId: 'fe-acme',
  nodeKind: 'LEAF',
  nodeLabel: 'Acme Ltd',
  createdAt: '2026-09-01T10:00:00.000Z',
  resolvedAt: null,
  resolvedBy: null,
  messages: [
    message('m1', {
      content: 'Revenue from Acme dropped by a third against last year. Missing invoices?',
      fromDate: '2025-01-01',
      toDate: '2025-12-31',
    }),
    message('m2', {
      author: 'Noa Cohen',
      isMine: true,
      content: 'Two invoices were issued in January instead of December. Moved them.',
      createdAt: '2026-09-01T11:30:00.000Z',
    }),
  ],
};

const OTHER: CommentThread = {
  ...THREAD,
  id: 't-vercel',
  nodeId: 'fe-vercel',
  nodeLabel: 'Vercel',
  resolvedAt: '2026-09-02T00:00:00.000Z',
  messages: [message('m3', { content: 'Sort code checked.' })],
};

const accepted = async (): Promise<boolean> => true;

/**
 * Stands in for useCommentsLayer, so the sheet renders without a server: its sheet state and the
 * composer draft are real, everything else is fixed.
 */
function Harness({ initial }: { initial: SheetState }): ReactElement {
  const [sheet, setSheet] = useState<SheetState | null>(initial);
  const [draft, setDraft] = useState('');
  const threads = [THREAD, OTHER];
  const nodeId = sheet?.mode === 'node' ? sheet.nodeId : null;
  const thread = threads.find(t => t.nodeId === nodeId) ?? null;

  const layer: CommentsLayer = {
    threads,
    threadsFetching: false,
    threadsError: undefined,
    openCount: 1,
    disabledReason: null,
    commentStats: new Map(),
    detached: [],
    groups: groupDiscussions(threads, []),
    rowComments: () => undefined,
    visibility: null,
    revealNodeId: null,
    lockedOpenIds: new Set(),
    clearReveal: () => void 0,
    toggleExpand: (id, toggle) => toggle(id),
    sheet,
    activeNode: nodeId
      ? {
          nodeId,
          label: thread?.nodeLabel ?? nodeId,
          path: ['Revenue', 'Services'],
          thread,
          detachedReason: null,
          readOnlyReason: null,
        }
      : null,
    openThread: id => setSheet({ mode: 'node', nodeId: id }),
    openDiscussions: () => setSheet({ mode: 'all' }),
    closeSheet: () => setSheet(null),
    selectThread: id => setSheet({ mode: 'node', nodeId: id }),
    draft,
    setDraft,
    isSending: false,
    sendError: null,
    isResolving: false,
    postComment: accepted,
    editComment: accepted,
    deleteComment: accepted,
    setResolved: accepted,
    view: VIEW,
    ownerName: () => undefined,
    threadLabel: t => t.nodeLabel,
    threadPath: () => ['Revenue', 'Services'],
  };

  return (
    <div className="p-6">
      <div className="flex gap-2">
        <Button variant="outline" onClick={layer.openDiscussions}>
          Discussions · {layer.openCount} open
        </Button>
        <Button variant="outline" onClick={() => layer.openThread('fe-acme')}>
          Acme Ltd thread
        </Button>
      </div>
      <ThreadSheet layer={layer} />
    </div>
  );
}

/**
 * The discussion side sheet as the report opens it: one node's thread, or every discussion of the
 * template. Focus lands in the composer when a thread opens; Escape closes the sheet.
 */
const meta = {
  title: 'Reports/DynamicReport/ThreadSheet',
  component: Harness,
  parameters: { layout: 'fullscreen' },
  args: { initial: { mode: 'node', nodeId: 'fe-acme' } },
  render: ({ initial }) => <Harness initial={initial} />,
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A node's thread. */
export const NodeThread: Story = {};

/** Every discussion, from the toolbar button; picking one opens its thread. */
export const AllDiscussions: Story = { args: { initial: { mode: 'all' } } };

/** A node with no thread yet. */
export const NewThread: Story = { args: { initial: { mode: 'node', nodeId: 'fe-new' } } };
