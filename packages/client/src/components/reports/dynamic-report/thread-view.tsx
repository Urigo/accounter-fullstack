import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { ArrowLeft, CheckCircle2, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Label } from '@/components/ui/label.js';
import { Switch } from '@/components/ui/switch.js';
import { Textarea } from '@/components/ui/textarea.js';
import { cn } from '@/lib/utils.js';
import {
  isSendable,
  MAX_COMMENT_LENGTH,
  messagePeriodChip,
  type CommentMessage,
  type CommentThread,
  type CommentView,
  type DetachedReason,
} from './utils/comments.js';

/** A heading element; the sheet passes its accessible SheetTitle, stories and tests a plain h2. */
export type TitleComponent = ComponentType<{ className?: string; children?: ReactNode }>;

function DefaultTitle({ className, children }: { className?: string; children?: ReactNode }) {
  return <h2 className={className}>{children}</h2>;
}

const numberFormatter = new Intl.NumberFormat();

export function formatCommentDate(value: Date | string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Cmd+Enter on macOS, Ctrl+Enter elsewhere. */
function isSendShortcut(event: KeyboardEvent<HTMLTextAreaElement>): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey);
}

export type ThreadViewProps = {
  /** The node's row text. */
  label: string;
  /** Row texts from the top of the tree down to the node's parent. */
  path: readonly string[];
  /** The node's thread, or null when nobody has posted on it yet. */
  thread: CommentThread | null;
  /** Set when the node has no visible row in the report. */
  detachedReason?: DetachedReason | null;
  /** Set when nothing can be posted; replaces the composer. */
  readOnlyReason?: string | null;
  /** The period and owner on screen, for period chips. */
  view: CommentView;
  ownerName?: (ownerId: string) => string | undefined;
  draft: string;
  onDraftChange: (content: string) => void;
  onSend: () => void;
  isSending?: boolean;
  /** The last send failed; the draft is kept. */
  sendError?: string | null;
  /** Each resolves to whether the change went through. */
  onEdit: (commentId: string, content: string) => Promise<boolean>;
  onDelete: (commentId: string) => Promise<boolean>;
  onResolvedChange: (resolved: boolean) => void;
  isResolving?: boolean;
  /** Back to every discussion of the template. */
  onShowAll?: () => void;
  /** Focus the composer when the view mounts, as it does when the sheet opens. */
  autoFocusComposer?: boolean;
  Title?: TitleComponent;
};

/**
 * One node's discussion: the header (label, path, Resolve / Reopen), the messages oldest first,
 * and the composer. Presentational — every change goes out through a callback.
 */
export function ThreadView({
  label,
  path,
  thread,
  detachedReason = null,
  readOnlyReason = null,
  view,
  ownerName,
  draft,
  onDraftChange,
  onSend,
  isSending = false,
  sendError = null,
  onEdit,
  onDelete,
  onResolvedChange,
  isResolving = false,
  onShowAll,
  autoFocusComposer = false,
  Title = DefaultTitle,
}: ThreadViewProps): ReactElement {
  const [periodOnly, setPeriodOnly] = useState(false);
  const periodSwitchId = useId();

  const messages = thread?.messages ?? [];
  const chips = new Map(
    messages.map(message => [message.id, messagePeriodChip(message, view, ownerName)]),
  );
  const shown = periodOnly ? messages.filter(message => chips.get(message.id) === null) : messages;
  const hiddenByPeriod = messages.length - shown.length;
  const isResolved = !!thread?.resolvedAt;

  // Keep the newest message in view as the conversation grows.
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [shown.length]);

  return (
    <div className="flex h-full min-h-0 flex-col" data-thread-view>
      <div className="flex flex-col gap-2 border-b p-4 pr-12">
        {onShowAll && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-muted-foreground"
            onClick={onShowAll}
          >
            <ArrowLeft className="size-4" />
            All discussions
          </Button>
        )}
        <div className="flex flex-col gap-0.5">
          {path.length > 0 && (
            <p className="truncate text-xs text-muted-foreground" data-thread-path>
              {path.join(' / ')}
            </p>
          )}
          <Title className="text-base font-semibold wrap-break-word">{label}</Title>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {thread &&
            (isResolved ? (
              <Badge variant="secondary" data-thread-status="resolved">
                Resolved{thread.resolvedBy ? ` by ${thread.resolvedBy}` : ''}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-sky-300 text-sky-800"
                data-thread-status="open"
              >
                Open
              </Badge>
            ))}
          {thread && (
            <Button
              variant="outline"
              size="sm"
              disabled={isResolving}
              onClick={() => onResolvedChange(!isResolved)}
            >
              {isResolved ? <RotateCcw className="size-4" /> : <CheckCircle2 className="size-4" />}
              {isResolved ? 'Reopen' : 'Resolve'}
            </Button>
          )}
          {messages.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <Switch
                id={periodSwitchId}
                checked={periodOnly}
                onCheckedChange={setPeriodOnly}
                aria-label="Show only messages from this period"
              />
              <Label htmlFor={periodSwitchId} className="cursor-pointer text-xs">
                This period only
              </Label>
            </div>
          )}
        </div>
        {detachedReason === 'hidden-in-period' && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            This row has no activity in the period on screen, so the report hides it.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {readOnlyReason ? 'No messages.' : 'No messages yet. Start the discussion below.'}
          </p>
        ) : (
          <>
            {hiddenByPeriod > 0 && (
              <p className="mb-3 text-center text-xs text-muted-foreground" data-hidden-by-period>
                {hiddenByPeriod} {hiddenByPeriod === 1 ? 'message' : 'messages'} from other periods
                hidden
              </p>
            )}
            <ol className="flex flex-col gap-4" aria-label="Messages">
              {shown.map(message => (
                <MessageItem
                  key={message.id}
                  message={message}
                  chip={chips.get(message.id) ?? null}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </ol>
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t p-4">
        {readOnlyReason ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" data-read-only>
            {readOnlyReason}
          </p>
        ) : (
          <Composer
            draft={draft}
            onDraftChange={onDraftChange}
            onSend={onSend}
            isSending={isSending}
            sendError={sendError}
            placeholder={thread ? 'Reply…' : 'Start the discussion…'}
            focusOnMount={autoFocusComposer}
          />
        )}
      </div>
    </div>
  );
}

function Composer({
  draft,
  onDraftChange,
  onSend,
  isSending,
  sendError,
  placeholder,
  focusOnMount,
}: {
  draft: string;
  onDraftChange: (content: string) => void;
  onSend: () => void;
  isSending: boolean;
  sendError: string | null;
  placeholder: string;
  focusOnMount: boolean;
}): ReactElement {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerId = useId();
  const { length } = draft.trim();
  const isOver = length > MAX_COMMENT_LENGTH;
  const canSend = !isSending && isSendable(draft);

  useEffect(() => {
    if (focusOnMount) textareaRef.current?.focus();
  }, [focusOnMount]);

  // The textarea is disabled while sending, which drops focus; hand it back once the send is done.
  const wasSending = useRef(false);
  useEffect(() => {
    if (wasSending.current && !isSending) textareaRef.current?.focus();
    wasSending.current = isSending;
  }, [isSending]);

  const send = (): void => {
    if (canSend) onSend();
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={event => {
        event.preventDefault();
        send();
      }}
    >
      <Label htmlFor={composerId} className="sr-only">
        Message
      </Label>
      <Textarea
        id={composerId}
        ref={textareaRef}
        value={draft}
        onChange={event => onDraftChange(event.target.value)}
        onKeyDown={event => {
          if (isSendShortcut(event)) {
            event.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        disabled={isSending}
        aria-invalid={isOver || undefined}
        aria-describedby={`${composerId}-hint`}
        className="max-h-48 min-h-20"
        data-composer
      />
      <div className="flex items-center gap-2">
        <span id={`${composerId}-hint`} className="text-xs text-muted-foreground">
          ⌘/Ctrl+Enter to send
        </span>
        <span
          className={cn(
            'ml-auto text-xs tabular-nums',
            isOver ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
          data-composer-counter
        >
          {numberFormatter.format(length)} / {numberFormatter.format(MAX_COMMENT_LENGTH)}
        </span>
        <Button type="submit" size="sm" disabled={!canSend}>
          {isSending ? 'Sending…' : 'Send'}
        </Button>
      </div>
      {sendError && (
        <p role="alert" className="text-xs text-destructive">
          {sendError}
        </p>
      )}
    </form>
  );
}

function MessageItem({
  message,
  chip,
  onEdit,
  onDelete,
}: {
  message: CommentMessage;
  chip: string | null;
  onEdit: (commentId: string, content: string) => Promise<boolean>;
  onDelete: (commentId: string) => Promise<boolean>;
}): ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const editId = useId();

  const isDeleted = !!message.deletedAt;
  const canChange = message.isMine && !isDeleted;
  const author = message.author ?? 'a former user';
  const canSave =
    !isSaving && isSendable(editText) && editText.trim() !== (message.content ?? '').trim();

  const startEditing = (): void => {
    setEditText(message.content ?? '');
    setIsEditing(true);
  };

  const save = async (): Promise<void> => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      if (await onEdit(message.id, editText)) setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <li className="group/message flex flex-col gap-1" data-comment-id={message.id}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span
          className={cn('font-medium', !message.author && 'italic text-muted-foreground')}
          data-comment-author
        >
          {author}
        </span>
        <time
          dateTime={new Date(message.createdAt).toISOString()}
          className="text-muted-foreground"
        >
          {formatCommentDate(message.createdAt)}
        </time>
        {chip && (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-800"
            title="Written while viewing another period or owner"
            data-period-chip
          >
            {chip}
          </Badge>
        )}
        {message.editedAt && !isDeleted && (
          <span className="text-muted-foreground" data-marker="edited">
            (edited)
          </span>
        )}
        {canChange && !isEditing && (
          <span className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground"
              aria-label="Edit message"
              onClick={startEditing}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-muted-foreground hover:text-destructive"
              aria-label="Delete message"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </span>
        )}
      </div>

      {isDeleted ? (
        <p className="text-sm italic text-muted-foreground" data-marker="deleted">
          Message deleted
        </p>
      ) : isEditing ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={editId} className="sr-only">
            Edit message
          </Label>
          <Textarea
            id={editId}
            value={editText}
            onChange={event => setEditText(event.target.value)}
            onKeyDown={event => {
              if (isSendShortcut(event)) {
                event.preventDefault();
                void save();
              }
            }}
            disabled={isSaving}
            aria-invalid={editText.trim().length > MAX_COMMENT_LENGTH || undefined}
            className="max-h-48 min-h-16"
            data-edit-composer
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={!canSave}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        // Plain text, never HTML: React escapes it, and the line breaks the author typed are kept.
        <p className="text-sm wrap-break-word whitespace-pre-wrap" data-comment-content>
          {message.content}
        </p>
      )}

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        {/* The shared AlertDialog sits at z-50, under the sheet (z-1001) it is opened from. */}
        <AlertDialogContent className="z-1002">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone will see “Message deleted” in its place. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-500/90"
              onClick={() => void onDelete(message.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
