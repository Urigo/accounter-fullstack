import type { ReactElement } from 'react';
import { MessageSquare, MessageSquarePlus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.js';
import { cn } from '@/lib/utils.js';
import { openBelowLabel, type ThreadSummary } from './utils/comments.js';

/** What a report row shows in its comments slot. */
export type RowComments = {
  /** The row's own thread, if it has one. */
  own?: ThreadSummary;
  /** Open threads anywhere below this row (branches only). */
  openBelow: number;
  /** The side sheet is showing this row's thread. */
  isActive: boolean;
  /** A ghost row: its thread can be read, but nothing can be started on it. */
  readOnly?: boolean;
  /** The row text, for accessible labels. */
  label: string;
  /** Opens this row's thread in the side sheet. */
  onOpen: () => void;
};

function messagesLabel(count: number): string {
  return `${count} ${count === 1 ? 'message' : 'messages'}`;
}

function ownLabel(comments: RowComments, own: ThreadSummary): string {
  const state = own.isOpen ? 'Open' : 'Resolved';
  const readOnly = comments.readOnly ? ', read-only' : '';
  return `${state} discussion on ${comments.label}, ${messagesLabel(own.messageCount)}${readOnly}`;
}

function WithTooltip({ tip, children }: { tip: string; children: ReactElement }): ReactElement {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * The comments slot of a report row:
 * - a row with its own thread shows a speech bubble and its message count, emphasised while open
 *   and muted once resolved;
 * - a branch with no thread of its own but open threads below shows a small dot;
 * - any other row shows an "add comment" button on hover or focus, so every node can start one.
 * Ghost rows show their thread read-only and offer nothing to start.
 */
export function CommentIndicator({ comments }: { comments: RowComments }): ReactElement | null {
  const { own, openBelow, isActive, readOnly, onOpen } = comments;

  if (own) {
    const tip = own.isOpen
      ? `Open discussion · ${messagesLabel(own.messageCount)}`
      : `Resolved discussion · ${messagesLabel(own.messageCount)}`;
    return (
      <WithTooltip tip={readOnly ? `${tip} (read-only)` : tip}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={ownLabel(comments, own)}
          aria-pressed={isActive}
          data-comment-indicator={own.isOpen ? 'open' : 'resolved'}
          className={cn(
            'flex h-6 items-center gap-0.5 rounded px-1 text-xs tabular-nums transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            own.isOpen
              ? 'font-medium text-sky-700 hover:bg-sky-100'
              : 'text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100',
            isActive && 'bg-sky-100 ring-1 ring-sky-400',
          )}
        >
          <MessageSquare className="size-3.5" aria-hidden />
          {own.messageCount > 0 && <span>{own.messageCount}</span>}
        </button>
      </WithTooltip>
    );
  }

  if (readOnly) return null;

  if (openBelow > 0) {
    const tip = openBelowLabel(openBelow);
    return (
      <WithTooltip tip={tip}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${tip}. Start a discussion on ${comments.label}`}
          aria-pressed={isActive}
          data-comment-indicator="below"
          className={cn(
            'flex size-6 items-center justify-center rounded hover:bg-sky-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isActive && 'bg-sky-100 ring-1 ring-sky-400',
          )}
        >
          <span className="size-2 rounded-full bg-sky-500" aria-hidden />
        </button>
      </WithTooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Add a comment on ${comments.label}`}
      aria-pressed={isActive}
      title="Add a comment"
      data-comment-indicator="add"
      className={cn(
        'flex size-6 items-center justify-center rounded text-muted-foreground transition-opacity',
        'hover:bg-muted hover:text-foreground',
        'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        // Stays visible while its (empty) thread is open, so the sheet points back at its row.
        isActive ? 'bg-sky-100 text-sky-700 opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}
    >
      <MessageSquarePlus className="size-3.5" aria-hidden />
    </button>
  );
}
