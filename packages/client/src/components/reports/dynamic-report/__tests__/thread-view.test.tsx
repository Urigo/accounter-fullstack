import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { DiscussionsList } from '../discussions-list.js';
import { ThreadView, type ThreadViewProps } from '../thread-view.js';
import {
  detachedThreads,
  groupDiscussions,
  MAX_COMMENT_LENGTH,
  type CommentMessage,
  type CommentThread,
} from '../utils/comments.js';
import type { CustomData, FlatNode } from '../utils/types.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const VIEW = { fromDate: '2026-01-01', toDate: '2026-12-31', scopeOwnerId: 'owner-1' };

function message(id: string, extra: Partial<CommentMessage> = {}): CommentMessage {
  return {
    id,
    content: `Message ${id}`,
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
  messages: CommentMessage[],
  extra: Partial<CommentThread> = {},
): CommentThread {
  return {
    id: `t-${nodeId}`,
    nodeId,
    nodeKind: 'LEAF',
    nodeLabel: `Label ${nodeId}`,
    createdAt: '2026-09-01T10:00:00.000Z',
    resolvedAt: null,
    resolvedBy: null,
    messages,
    ...extra,
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────────

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  // React tracks the value itself, so go through the native setter for onChange to fire.
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function keyDown(element: Element, init: KeyboardEventInit): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

const composer = (): HTMLTextAreaElement =>
  container.querySelector<HTMLTextAreaElement>('[data-composer]')!;

const buttonNamed = (name: string): HTMLButtonElement | undefined =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    button => button.textContent?.trim() === name || button.getAttribute('aria-label') === name,
  );

function renderThread(props: Partial<ThreadViewProps> = {}): ThreadViewProps {
  const full: ThreadViewProps = {
    label: 'Acme Ltd',
    path: ['Revenue', 'Services'],
    thread: null,
    view: VIEW,
    draft: '',
    onDraftChange: vi.fn<(content: string) => void>(),
    onSend: vi.fn<() => void>(),
    onEdit: vi.fn<(id: string, content: string) => Promise<boolean>>(async () => true),
    onDelete: vi.fn<(id: string) => Promise<boolean>>(async () => true),
    onResolvedChange: vi.fn<(resolved: boolean) => void>(),
    ...props,
  };
  act(() => root.render(<ThreadView {...full} />));
  return full;
}

/** Re-renders with a controlled draft that follows onDraftChange, as the layer does. */
function renderWithDraft(props: Partial<ThreadViewProps> = {}): { onSend: Mock<() => void> } {
  const onSend = vi.fn<() => void>();
  let draft = props.draft ?? '';
  const render = (): void => {
    renderThread({
      ...props,
      draft,
      onSend,
      onDraftChange: next => {
        draft = next;
        render();
      },
    });
  };
  render();
  return { onSend };
}

// ── ThreadView ──────────────────────────────────────────────────────────────────

describe('ThreadView header', () => {
  it('shows the node label and its path', () => {
    renderThread();
    expect(container.querySelector('h2')?.textContent).toBe('Acme Ltd');
    expect(container.querySelector('[data-thread-path]')?.textContent).toBe('Revenue / Services');
  });

  it('offers Resolve on an open thread and Reopen on a resolved one', () => {
    const props = renderThread({ thread: thread('a', [message('m1')]) });
    expect(container.querySelector('[data-thread-status]')?.textContent).toBe('Open');
    act(() => buttonNamed('Resolve')?.click());
    expect(props.onResolvedChange).toHaveBeenCalledWith(true);

    const resolved = renderThread({
      thread: thread('a', [message('m1')], {
        resolvedAt: '2026-09-02T00:00:00.000Z',
        resolvedBy: 'Noa',
      }),
    });
    expect(container.querySelector('[data-thread-status]')?.textContent).toBe('Resolved by Noa');
    act(() => buttonNamed('Reopen')?.click());
    expect(resolved.onResolvedChange).toHaveBeenCalledWith(false);
  });

  it('disables Resolve while a change is in flight', () => {
    renderThread({ thread: thread('a', [message('m1')]), isResolving: true });
    expect(buttonNamed('Resolve')?.disabled).toBe(true);
  });

  it('offers no Resolve before anyone has posted, and an empty state instead', () => {
    renderThread();
    expect(buttonNamed('Resolve')).toBeUndefined();
    expect(container.textContent).toContain('No messages yet. Start the discussion below.');
  });

  it('goes back to every discussion', () => {
    const onShowAll = vi.fn<() => void>();
    renderThread({ onShowAll });
    act(() => buttonNamed('All discussions')?.click());
    expect(onShowAll).toHaveBeenCalledTimes(1);
  });

  it('explains a row hidden in the period', () => {
    renderThread({ detachedReason: 'hidden-in-period' });
    expect(container.textContent).toContain('no activity in the period on screen');
  });
});

describe('ThreadView messages', () => {
  it('renders the messages in the order given (oldest first)', () => {
    renderThread({
      thread: thread('a', [message('m1'), message('m2'), message('m3')]),
    });
    const ids = [...container.querySelectorAll('[data-comment-id]')].map(li =>
      li.getAttribute('data-comment-id'),
    );
    expect(ids).toEqual(['m1', 'm2', 'm3']);
  });

  it('names the author, or "a former user" when they are gone', () => {
    renderThread({ thread: thread('a', [message('m1'), message('m2', { author: null })]) });
    const authors = [...container.querySelectorAll('[data-comment-author]')].map(
      el => el.textContent,
    );
    expect(authors).toEqual(['Dana Levi', 'a former user']);
  });

  it('shows the date as a machine-readable time', () => {
    renderThread({ thread: thread('a', [message('m1')]) });
    expect(container.querySelector('time')?.getAttribute('dateTime')).toBe(
      '2026-09-01T10:00:00.000Z',
    );
  });

  it('marks edited and deleted messages', () => {
    renderThread({
      thread: thread('a', [
        message('m1', { editedAt: '2026-09-02T00:00:00.000Z' }),
        message('m2', { content: null, deletedAt: '2026-09-03T00:00:00.000Z', isMine: true }),
      ]),
    });
    const [edited, deleted] = [...container.querySelectorAll('[data-comment-id]')];
    expect(edited?.querySelector('[data-marker="edited"]')?.textContent).toBe('(edited)');
    expect(deleted?.querySelector('[data-marker="deleted"]')?.textContent).toBe('Message deleted');
    // A deleted message has no content, and even its author can't edit or delete it any more.
    expect(deleted?.querySelector('[data-comment-content]')).toBeNull();
    expect(deleted?.querySelector('[aria-label="Edit message"]')).toBeNull();
  });

  it('renders content as plain text, keeping line breaks', () => {
    renderThread({
      thread: thread('a', [message('m1', { content: '<b>bold</b>\nsecond line' })]),
    });
    const content = container.querySelector('[data-comment-content]');
    expect(content?.textContent).toBe('<b>bold</b>\nsecond line');
    expect(content?.querySelector('b')).toBeNull();
    expect(content?.className).toContain('whitespace-pre-wrap');
  });

  it('shows a period chip only on messages from another period or owner', () => {
    renderThread({
      thread: thread('a', [
        message('same'),
        message('other-period', { fromDate: '2025-01-01', toDate: '2025-12-31' }),
        message('other-owner', { scopeOwnerId: 'owner-2' }),
      ]),
      ownerName: id => (id === 'owner-2' ? 'Acme Holdings' : undefined),
    });
    const chips = Object.fromEntries(
      [...container.querySelectorAll('[data-comment-id]')].map(li => [
        li.getAttribute('data-comment-id'),
        li.querySelector('[data-period-chip]')?.textContent ?? null,
      ]),
    );
    expect(chips).toEqual({
      same: null,
      'other-period': '2025-01-01 – 2025-12-31',
      'other-owner': 'Acme Holdings',
    });
  });

  it('narrows to this period’s messages with "This period only"', () => {
    renderThread({
      thread: thread('a', [
        message('same'),
        message('other', { fromDate: '2025-01-01', toDate: '2025-12-31' }),
      ]),
    });
    const toggle = container.querySelector<HTMLButtonElement>('[role="switch"]');
    act(() => toggle?.click());
    expect(
      [...container.querySelectorAll('[data-comment-id]')].map(li =>
        li.getAttribute('data-comment-id'),
      ),
    ).toEqual(['same']);
    expect(container.querySelector('[data-hidden-by-period]')?.textContent).toBe(
      '1 message from other periods hidden',
    );
  });
});

describe('ThreadView own-message actions', () => {
  it('offers edit and delete on your own messages only', () => {
    renderThread({ thread: thread('a', [message('mine', { isMine: true }), message('theirs')]) });
    const [mine, theirs] = [...container.querySelectorAll('[data-comment-id]')];
    expect(mine?.querySelector('[aria-label="Edit message"]')).not.toBeNull();
    expect(mine?.querySelector('[aria-label="Delete message"]')).not.toBeNull();
    expect(theirs?.querySelector('[aria-label="Edit message"]')).toBeNull();
    expect(theirs?.querySelector('[aria-label="Delete message"]')).toBeNull();
  });

  it('edits inline and saves the new text', async () => {
    const props = renderThread({
      thread: thread('a', [message('mine', { isMine: true, content: 'first' })]),
    });
    act(() => buttonNamed('Edit message')?.click());
    const editor = container.querySelector<HTMLTextAreaElement>('[data-edit-composer]')!;
    expect(editor.value).toBe('first');
    // Unchanged text can't be saved.
    expect(buttonNamed('Save')?.disabled).toBe(true);
    act(() => setTextareaValue(editor, 'second'));
    await act(async () => buttonNamed('Save')?.click());
    expect(props.onEdit).toHaveBeenCalledWith('mine', 'second');
    expect(container.querySelector('[data-edit-composer]')).toBeNull();
  });

  it('keeps the editor open when the edit fails', async () => {
    renderThread({
      thread: thread('a', [message('mine', { isMine: true, content: 'first' })]),
      onEdit: async () => false,
    });
    act(() => buttonNamed('Edit message')?.click());
    act(() => setTextareaValue(container.querySelector('[data-edit-composer]')!, 'second'));
    await act(async () => buttonNamed('Save')?.click());
    expect(container.querySelector('[data-edit-composer]')).not.toBeNull();
  });

  it('asks before deleting', async () => {
    const props = renderThread({ thread: thread('a', [message('mine', { isMine: true })]) });
    act(() => buttonNamed('Delete message')?.click());
    expect(document.body.textContent).toContain('Delete this message?');
    expect(props.onDelete).not.toHaveBeenCalled();
    await act(async () => buttonNamed('Delete')?.click());
    expect(props.onDelete).toHaveBeenCalledWith('mine');
  });
});

describe('ThreadView composer', () => {
  it('sends with the Send button', () => {
    const { onSend } = renderWithDraft({ draft: 'Hello' });
    act(() => buttonNamed('Send')?.click());
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('sends on Cmd+Enter and Ctrl+Enter, but not on a plain Enter', () => {
    const { onSend } = renderWithDraft({ draft: 'Hello' });
    act(() => keyDown(composer(), { key: 'Enter' }));
    expect(onSend).not.toHaveBeenCalled();
    act(() => keyDown(composer(), { key: 'Enter', metaKey: true }));
    act(() => keyDown(composer(), { key: 'Enter', ctrlKey: true }));
    expect(onSend).toHaveBeenCalledTimes(2);
  });

  it('blocks an empty or whitespace-only message', () => {
    const { onSend } = renderWithDraft();
    expect(buttonNamed('Send')?.disabled).toBe(true);
    act(() => setTextareaValue(composer(), '   \n  '));
    expect(buttonNamed('Send')?.disabled).toBe(true);
    act(() => keyDown(composer(), { key: 'Enter', metaKey: true }));
    expect(onSend).not.toHaveBeenCalled();
    act(() => setTextareaValue(composer(), 'ok'));
    expect(buttonNamed('Send')?.disabled).toBe(false);
  });

  it('counts characters and blocks a message over the limit', () => {
    const { onSend } = renderWithDraft({ draft: 'x'.repeat(MAX_COMMENT_LENGTH + 1) });
    const counter = container.querySelector('[data-composer-counter]');
    expect(counter?.textContent).toBe(
      `${new Intl.NumberFormat().format(MAX_COMMENT_LENGTH + 1)} / ${new Intl.NumberFormat().format(MAX_COMMENT_LENGTH)}`,
    );
    expect(counter?.className).toContain('text-destructive');
    expect(composer().getAttribute('aria-invalid')).toBe('true');
    expect(buttonNamed('Send')?.disabled).toBe(true);
    act(() => keyDown(composer(), { key: 'Enter', ctrlKey: true }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('is disabled while sending', () => {
    const { onSend } = renderWithDraft({ draft: 'Hello', isSending: true });
    expect(composer().disabled).toBe(true);
    expect(buttonNamed('Sending…')?.disabled).toBe(true);
    act(() => keyDown(composer(), { key: 'Enter', metaKey: true }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows a failed send, keeping the draft', () => {
    renderThread({ draft: 'Hello', sendError: 'Your message wasn’t sent.' });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'Your message wasn’t sent.',
    );
    expect(composer().value).toBe('Hello');
  });

  it('focuses the composer when asked to, as the sheet does on open', () => {
    renderThread({ autoFocusComposer: true });
    expect(document.activeElement).toBe(composer());
  });

  it('replaces the composer with the reason on a read-only thread', () => {
    renderThread({
      thread: thread('a', [message('m1')]),
      readOnlyReason: 'This row is no longer in the report.',
    });
    expect(container.querySelector('[data-composer]')).toBeNull();
    expect(container.querySelector('[data-read-only]')?.textContent).toBe(
      'This row is no longer in the report.',
    );
  });
});

// ── DiscussionsList ─────────────────────────────────────────────────────────────

function leaf(id: string, parent: string, extra: Partial<CustomData> = {}): FlatNode<CustomData> {
  return {
    id,
    parent,
    text: `Entity ${id}`,
    droppable: false,
    data: { nodeType: 'financial-entity', isOpen: false, value: 1, ...extra },
  };
}

describe('DiscussionsList', () => {
  const tree = [leaf('a', 'report'), leaf('b', 'report'), leaf('h', 'report', { isHidden: true })];
  const threads = [
    thread('a', [message('m1')]),
    thread('b', [message('m2')], { resolvedAt: '2026-09-02T00:00:00.000Z' }),
    thread('h', [message('m3')]),
    thread('gone', [message('m4', { content: null, deletedAt: '2026-09-03T00:00:00.000Z' })]),
    thread('ghost', [message('m5')], { resolvedAt: '2026-09-02T00:00:00.000Z' }),
  ];
  const groups = groupDiscussions(threads, detachedThreads(threads, tree, new Set(['ghost'])));

  const groupContents = (): Record<string, string[]> =>
    Object.fromEntries(
      [...container.querySelectorAll('[data-discussion-group]')].map(section => [
        section.getAttribute('data-discussion-group'),
        [...section.querySelectorAll('[data-discussion]')].map(
          button => button.getAttribute('data-discussion') ?? '',
        ),
      ]),
    );

  it('groups threads as Open, Resolved and Not in report', () => {
    act(() => root.render(<DiscussionsList groups={groups} onSelect={vi.fn()} />));
    expect(groupContents()).toEqual({
      open: ['a'],
      resolved: ['b'],
      detached: ['h', 'gone', 'ghost'],
    });
    const headings = [...container.querySelectorAll('h3')].map(h => h.textContent);
    expect(headings).toEqual(['Open · 1', 'Resolved · 1', 'Not in report · 3']);
  });

  it('gives each detached thread its reason', () => {
    act(() => root.render(<DiscussionsList groups={groups} onSelect={vi.fn()} />));
    const reasons = [...container.querySelectorAll('[data-detached-reason]')].map(badge => [
      badge.getAttribute('data-detached-reason'),
      badge.textContent,
    ]);
    expect(reasons).toEqual([
      ['hidden-in-period', 'No activity in this period'],
      ['not-in-report', 'Not in the report'],
      ['not-in-report', 'Removed from the report since the last save'],
    ]);
    expect(container.querySelector('[data-discussion="gone"]')?.textContent).toContain(
      'Message deleted',
    );
  });

  it('reveals a thread’s node when it is clicked', () => {
    const onSelect = vi.fn<(nodeId: string) => void>();
    act(() => root.render(<DiscussionsList groups={groups} onSelect={onSelect} />));
    act(() => container.querySelector<HTMLButtonElement>('[data-discussion="a"]')?.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-discussion="h"]')?.click());
    expect(onSelect.mock.calls).toEqual([['a'], ['h']]);
  });

  it('labels threads by their current row text and path when given', () => {
    act(() =>
      root.render(
        <DiscussionsList
          groups={groups}
          onSelect={vi.fn()}
          labelOf={t => `Row ${t.nodeId}`}
          pathOf={t => (t.nodeId === 'a' ? ['Revenue'] : [])}
        />,
      ),
    );
    const a = container.querySelector('[data-discussion="a"]');
    expect(a?.getAttribute('aria-label')).toBe('Open the discussion on Row a');
    expect(a?.textContent).toContain('Revenue');
  });

  it('has an empty state, a loading state and an error state', () => {
    const empty = { open: [], resolved: [], detached: [] };
    act(() => root.render(<DiscussionsList groups={empty} onSelect={vi.fn()} />));
    expect(container.textContent).toContain('No discussions yet');
    act(() => root.render(<DiscussionsList groups={empty} onSelect={vi.fn()} isLoading />));
    expect(container.textContent).toContain('Loading discussions');
    act(() => root.render(<DiscussionsList groups={groups} onSelect={vi.fn()} error="Nope" />));
    expect(container.textContent).toContain('Nope');
    expect(container.querySelector('[data-discussion]')).toBeNull();
  });
});
