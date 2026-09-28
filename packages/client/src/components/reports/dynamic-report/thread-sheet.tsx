import type { ReactElement } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet.js';
import { DiscussionsList } from './discussions-list.js';
import type { CommentsLayer } from './hooks/use-comments-layer.js';
import { ThreadView } from './thread-view.js';

/**
 * The comments side sheet: one node's thread, or every discussion of the template. A thin
 * container over the presentational ThreadView and DiscussionsList, fed by useCommentsLayer.
 */
export function ThreadSheet({ layer }: { layer: CommentsLayer }): ReactElement {
  const { sheet, activeNode } = layer;

  return (
    <Sheet
      open={!!sheet}
      onOpenChange={open => {
        if (!open) layer.closeSheet();
      }}
    >
      {/* No SheetDescription: the title says what the sheet holds, and its contents speak for
          themselves. */}
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md" aria-describedby={undefined}>
        {sheet?.mode === 'all' ? (
          <DiscussionsList
            groups={layer.groups}
            onSelect={layer.selectThread}
            labelOf={layer.threadLabel}
            pathOf={layer.threadPath}
            isLoading={layer.threadsFetching}
            error={layer.threadsError ? 'The discussions couldn’t be loaded.' : null}
            Title={SheetTitle}
          />
        ) : activeNode ? (
          <ThreadView
            // A fresh view per node: its edit state and period filter belong to that thread.
            key={activeNode.nodeId}
            label={activeNode.label}
            path={activeNode.path}
            thread={activeNode.thread}
            detachedReason={activeNode.detachedReason}
            readOnlyReason={activeNode.readOnlyReason}
            view={layer.view}
            ownerName={layer.ownerName}
            draft={layer.draft}
            onDraftChange={layer.setDraft}
            onSend={() => void layer.postComment()}
            isSending={layer.isSending}
            sendError={layer.sendError}
            onEdit={layer.editComment}
            onDelete={layer.deleteComment}
            onResolvedChange={resolved => void layer.setResolved(resolved)}
            isResolving={layer.isResolving}
            onShowAll={layer.openDiscussions}
            autoFocusComposer
            Title={SheetTitle}
          />
        ) : (
          // Radix needs a title even for the instant the sheet closes on a template switch.
          <SheetTitle className="sr-only">Discussion</SheetTitle>
        )}
      </SheetContent>
    </Sheet>
  );
}
