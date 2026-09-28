import type { ReactElement, ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge.js';
import { cn } from '@/lib/utils.js';
import { formatCommentDate, type TitleComponent } from './thread-view.js';
import type { CommentThread, DetachedThread, DiscussionGroups } from './utils/comments.js';

function DefaultTitle({ className, children }: { className?: string; children?: ReactNode }) {
  return <h2 className={className}>{children}</h2>;
}

function detachedReasonText(entry: DetachedThread): string {
  if (entry.reason === 'hidden-in-period') return 'No activity in this period';
  return entry.isGhost ? 'Removed from the report since the last save' : 'Not in the report';
}

export type DiscussionsListProps = {
  groups: DiscussionGroups;
  /** Opens a thread, revealing its row when it has one. */
  onSelect: (nodeId: string) => void;
  /** The node's current row text; defaults to the label the thread last recorded. */
  labelOf?: (thread: CommentThread) => string;
  /** Row texts from the top of the tree down to the node's parent. */
  pathOf?: (thread: CommentThread) => readonly string[];
  isLoading?: boolean;
  /** Set when the threads couldn't be loaded. */
  error?: string | null;
  Title?: TitleComponent;
};

/**
 * Every discussion of the template, grouped as Open, Resolved and Not in report. Presentational:
 * selecting a thread goes out through `onSelect`.
 */
export function DiscussionsList({
  groups,
  onSelect,
  labelOf = thread => thread.nodeLabel,
  pathOf = () => [],
  isLoading = false,
  error = null,
  Title = DefaultTitle,
}: DiscussionsListProps): ReactElement {
  const total = groups.open.length + groups.resolved.length + groups.detached.length;

  const item = (thread: CommentThread, extra?: ReactNode): ReactElement => {
    const last = thread.messages.at(-1);
    const count = thread.messages.filter(message => !message.deletedAt).length;
    const path = pathOf(thread);
    const label = labelOf(thread);
    return (
      <li key={thread.id}>
        <button
          type="button"
          onClick={() => onSelect(thread.nodeId)}
          className={cn(
            'flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors',
            'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label={`Open the discussion on ${label}`}
          data-discussion={thread.nodeId}
        >
          {path.length > 0 && (
            <span className="truncate text-xs text-muted-foreground">{path.join(' / ')}</span>
          )}
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{label}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="size-3.5" aria-hidden />
              {count}
            </span>
          </span>
          {last && (
            <span className="line-clamp-2 text-xs text-muted-foreground">
              <span className="font-medium">{last.author ?? 'a former user'}</span>
              {' · '}
              {formatCommentDate(last.createdAt)}
              {' — '}
              {last.deletedAt ? <em>Message deleted</em> : last.content}
            </span>
          )}
          {extra}
        </button>
      </li>
    );
  };

  const section = (
    title: string,
    key: string,
    count: number,
    children: ReactElement[],
  ): ReactElement | null =>
    count === 0 ? null : (
      <section className="flex flex-col gap-2" aria-label={title} data-discussion-group={key}>
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title} · {count}
        </h3>
        <ul className="flex flex-col gap-2">{children}</ul>
      </section>
    );

  let body: ReactNode;
  if (error) {
    body = <p className="py-8 text-center text-sm text-destructive">{error}</p>;
  } else if (isLoading && total === 0) {
    body = <p className="py-8 text-center text-sm text-muted-foreground">Loading discussions…</p>;
  } else if (total === 0) {
    body = (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No discussions yet. Hover a report row and click its speech bubble to start one.
      </p>
    );
  } else {
    body = (
      <div className="flex flex-col gap-6">
        {section(
          'Open',
          'open',
          groups.open.length,
          groups.open.map(thread => item(thread)),
        )}
        {section(
          'Resolved',
          'resolved',
          groups.resolved.length,
          groups.resolved.map(thread => item(thread)),
        )}
        {section(
          'Not in report',
          'detached',
          groups.detached.length,
          groups.detached.map(entry =>
            item(
              entry.thread,
              <span className="flex flex-wrap items-center gap-1">
                <Badge variant="outline" className="text-xs" data-detached-reason={entry.reason}>
                  {detachedReasonText(entry)}
                </Badge>
                {entry.thread.resolvedAt && (
                  <Badge variant="secondary" className="text-xs">
                    Resolved
                  </Badge>
                )}
              </span>,
            ),
          ),
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-discussions-list>
      <div className="border-b p-4 pr-12">
        <Title className="text-base font-semibold">Discussions</Title>
        <p className="text-xs text-muted-foreground">
          Shared by every period of this template. Posting takes effect immediately.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{body}</div>
    </div>
  );
}
