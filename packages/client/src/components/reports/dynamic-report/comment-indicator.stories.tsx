import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CommentIndicator, type RowComments } from './comment-indicator.js';

const OPEN = {
  threadId: 't1',
  isOpen: true,
  messageCount: 3,
  lastMessageAt: new Date('2026-09-01T10:00:00Z'),
};
const RESOLVED = { ...OPEN, isOpen: false };

const base: RowComments = {
  openBelow: 0,
  isActive: false,
  label: 'Acme Ltd',
  onOpen: () => void 0,
};

/**
 * The comments slot of a report row. The row's `group` class drives the hover-only "add comment"
 * button, so every story sits in a stand-in row: hover it to see that state.
 */
const meta = {
  title: 'Reports/DynamicReport/CommentIndicator',
  component: CommentIndicator,
  render: args => (
    <div className="group flex h-10 w-64 items-center justify-between rounded border px-3">
      <span className="text-sm">Hover this row</span>
      <div className="flex w-7 shrink-0 items-center justify-center">
        <CommentIndicator {...args} />
      </div>
    </div>
  ),
  args: { comments: base },
} satisfies Meta<typeof CommentIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A row with an open thread: emphasised, with its message count. */
export const OpenThread: Story = { args: { comments: { ...base, own: OPEN } } };

/** A resolved thread is muted. */
export const ResolvedThread: Story = { args: { comments: { ...base, own: RESOLVED } } };

/** The thread showing in the side sheet is ringed. */
export const ActiveThread: Story = { args: { comments: { ...base, own: OPEN, isActive: true } } };

/** A branch with no thread of its own but open threads below it: a dot, "2 open threads inside". */
export const OpenThreadsInside: Story = { args: { comments: { ...base, openBelow: 2 } } };

/** A row without a thread: the "add comment" button shows on hover or keyboard focus. */
export const AddComment: Story = {};

/** The add button stays visible while its (still empty) thread is open in the sheet. */
export const AddCommentActive: Story = { args: { comments: { ...base, isActive: true } } };

/** A ghost row shows its thread read-only; one without a thread shows nothing. */
export const GhostReadOnly: Story = {
  args: { comments: { ...base, own: OPEN, readOnly: true } },
};

function Gallery(): ReactElement {
  const states: [string, RowComments][] = [
    ['Open thread', { ...base, own: OPEN }],
    ['Resolved thread', { ...base, own: RESOLVED }],
    ['Open in the sheet', { ...base, own: OPEN, isActive: true }],
    ['Open threads inside', { ...base, openBelow: 2 }],
    ['No thread (hover)', base],
    ['Ghost, read-only', { ...base, own: OPEN, readOnly: true }],
  ];
  return (
    <div className="flex flex-col">
      {states.map(([name, comments]) => (
        <div
          key={name}
          className="group flex h-10 items-center justify-between border-b px-3 hover:bg-muted/50"
        >
          <span className="text-sm">{name}</span>
          <div className="flex w-7 shrink-0 items-center justify-center">
            <CommentIndicator comments={comments} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Every state side by side, as a column of report rows. */
export const AllStates: Story = {
  decorators: [
    Story => (
      <div className="w-72 rounded border">
        <Story />
      </div>
    ),
  ],
  render: () => <Gallery />,
};
