import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThreadView, type ThreadViewProps } from './thread-view.js';
import type { CommentMessage, CommentThread } from './utils/comments.js';

/* -------------------------------------------------------------------------- */
/*  Fixtures                                                                  */
/* -------------------------------------------------------------------------- */

const VIEW = { fromDate: '2026-01-01', toDate: '2026-12-31', scopeOwnerId: 'owner-1' };

const OWNERS = new Map([
  ['owner-1', 'The Guild'],
  ['owner-2', 'Guild Holdings'],
]);

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

function thread(messages: CommentMessage[], extra: Partial<CommentThread> = {}): CommentThread {
  return {
    id: 'thread-1',
    nodeId: 'fe-1',
    nodeKind: 'LEAF',
    nodeLabel: 'Acme Ltd',
    createdAt: '2026-03-02T09:00:00.000Z',
    resolvedAt: null,
    resolvedBy: null,
    messages,
    ...extra,
  };
}

const LONG_CONVERSATION = thread([
  message('m1', {
    content: 'Revenue from Acme dropped by a third against last year. Missing invoices?',
    createdAt: '2026-03-02T09:00:00.000Z',
    fromDate: '2025-01-01',
    toDate: '2025-12-31',
  }),
  message('m2', {
    author: 'Noa Cohen',
    isMine: true,
    content:
      'Two invoices were issued in January instead of December.\nI moved them in the ledger — should reconcile now.',
    createdAt: '2026-03-02T11:30:00.000Z',
    fromDate: '2025-01-01',
    toDate: '2025-12-31',
  }),
  message('m3', {
    content: 'Confirmed for 2025. Keeping the thread open for the H1 review.',
    createdAt: '2026-03-03T08:15:00.000Z',
    fromDate: '2025-01-01',
    toDate: '2025-12-31',
  }),
  message('m4', {
    author: null,
    content: 'Checked the consolidated view too — same picture.',
    createdAt: '2026-04-10T14:00:00.000Z',
    scopeOwnerId: 'owner-2',
  }),
  message('m5', {
    content: 'H1 figures look right. Anything left before we sign off?',
    createdAt: '2026-07-05T09:40:00.000Z',
  }),
  message('m6', {
    author: 'Noa Cohen',
    isMine: true,
    content: 'Nothing on my side — the credit note from May is booked.',
    createdAt: '2026-07-05T10:05:00.000Z',
    editedAt: '2026-07-05T10:07:00.000Z',
  }),
]);

const EDITED_AND_DELETED = thread([
  message('m1', {
    content: 'The bank fees look doubled in March.',
    createdAt: '2026-09-01T10:00:00.000Z',
  }),
  message('m2', {
    author: 'Noa Cohen',
    isMine: true,
    content: 'They were: one charge was booked twice. Fixed, see the ledger.',
    createdAt: '2026-09-01T12:00:00.000Z',
    editedAt: '2026-09-01T12:10:00.000Z',
  }),
  message('m3', {
    author: 'Noa Cohen',
    isMine: true,
    content: null,
    createdAt: '2026-09-01T12:20:00.000Z',
    deletedAt: '2026-09-01T12:25:00.000Z',
  }),
  message('m4', {
    content: null,
    createdAt: '2026-09-02T08:00:00.000Z',
    deletedAt: '2026-09-02T08:01:00.000Z',
  }),
]);

const RESOLVED = thread(
  [
    message('m1', { content: 'Is this sort code right for software subscriptions?' }),
    message('m2', {
      author: 'Noa Cohen',
      isMine: true,
      content: 'Yes — 800 is the one the accountant asked for.',
      createdAt: '2026-09-01T11:00:00.000Z',
    }),
  ],
  { resolvedAt: '2026-09-01T11:05:00.000Z', resolvedBy: 'Dana Levi' },
);

/* -------------------------------------------------------------------------- */
/*  Harness                                                                   */
/* -------------------------------------------------------------------------- */

/** Holds the draft, as useCommentsLayer does, and resolves every change as accepted. */
function Harness(props: Partial<ThreadViewProps>): ReactElement {
  const [draft, setDraft] = useState(props.draft ?? '');
  return (
    <div className="flex h-160 w-md flex-col border bg-background">
      <ThreadView
        label="Acme Ltd"
        path={['Revenue', 'Services']}
        thread={null}
        view={VIEW}
        ownerName={id => OWNERS.get(id)}
        onSend={() => void 0}
        onEdit={async () => true}
        onDelete={async () => true}
        onResolvedChange={() => void 0}
        onShowAll={() => void 0}
        {...props}
        draft={draft}
        onDraftChange={setDraft}
      />
    </div>
  );
}

/**
 * One node's discussion, as the side sheet shows it: header with the node's path and Resolve /
 * Reopen, the messages oldest first, and the composer (⌘/Ctrl+Enter sends). The period on screen
 * is 2026; messages written for another period or owner carry a chip.
 */
const meta = {
  title: 'Reports/DynamicReport/ThreadView',
  component: Harness,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Harness>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A node nobody has posted on yet: an empty state and a composer to start one. */
export const EmptyThread: Story = {};

/** A long conversation across periods and owners; the "This period only" switch narrows it. */
export const LongConversation: Story = { args: { thread: LONG_CONVERSATION } };

/** Edited and deleted messages keep their markers; your own get edit and delete actions. */
export const EditedAndDeleted: Story = { args: { thread: EDITED_AND_DELETED } };

/** A resolved thread offers Reopen. Posting on it reopens it too. */
export const Resolved: Story = { args: { thread: RESOLVED } };

/** While a message is sending, the composer is disabled. */
export const Sending: Story = {
  args: { thread: RESOLVED, draft: 'Reopening: the May credit note is missing.', isSending: true },
};

/** A failed send keeps the draft and says so. */
export const SendFailed: Story = {
  args: {
    thread: RESOLVED,
    draft: 'Reopening: the May credit note is missing.',
    sendError: 'Your message wasn’t sent. It is kept here so you can try again.',
  },
};

/** Over the 10,000-character limit: the counter turns red and Send is blocked. */
export const OverLimit: Story = { args: { draft: 'x'.repeat(10_050) } };

/** A leaf with no activity in the period is hidden in the report, but its thread stays open. */
export const HiddenInPeriod: Story = {
  args: { thread: LONG_CONVERSATION, detachedReason: 'hidden-in-period' },
};

/** A node removed from the report (a ghost row): the thread reads, but can't be posted to. */
export const ReadOnly: Story = {
  args: {
    thread: RESOLVED,
    path: [],
    detachedReason: 'not-in-report',
    readOnlyReason:
      'This row was removed from the report since the last save. Add it back to continue the discussion.',
  },
};
