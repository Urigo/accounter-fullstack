import { useEffect } from 'react';
import { create } from 'zustand';
import {
  getViewportWidth,
  resolveViewerPlacement,
  type DocumentViewerPlacement,
  type OverlayMode,
} from '../components/common/document-viewer/placement.js';
import type { DocumentViewerEntry } from '../components/common/document-viewer/types.js';
import { SIDEBAR_WIDTH_PX, useSidebar } from './use-sidebar.js';

export type { DocumentViewerPlacement, OverlayMode };

export interface OpenDocumentViewerOptions {
  /**
   * The element that opened the viewer. Its DOM decides the placement (inside a dialog, the viewer
   * can't dock), and it gets focus back when the viewer closes with ✕ or Esc.
   */
  trigger?: HTMLElement | null;
  /**
   * The documents the viewer can step through, in the order the source table shows when the
   * viewer opens. A snapshot (spec decision 14): a later re-sort or filter change doesn't reorder
   * it. Leave it out to show no stepper.
   */
  siblings?: readonly DocumentViewerEntry[] | null;
}

/** Keyboard owner ranks: the topmost kind of viewer wins the shortcuts. */
export const KEYBOARD_RANK = { docked: 0, embedded: 1, overlay: 2 } as const;
export type KeyboardRank = (typeof KEYBOARD_RANK)[keyof typeof KEYBOARD_RANK];

export interface KeyboardOwner {
  id: string;
  rank: KeyboardRank;
}

interface DocumentViewerState {
  current: DocumentViewerEntry | null;
  placement: DocumentViewerPlacement | null;
  /** The overlay's shape while `placement` is `overlay`; `null` otherwise. */
  overlayMode: OverlayMode | null;
  expanded: boolean;
  /**
   * The documents `step` moves through, snapshotted at open time; `null` when the viewer was opened
   * without any, or once a refetch dropped the current document from its table.
   */
  siblings: DocumentViewerEntry[] | null;
  /**
   * Every mounted viewer that wants the keyboard shortcuts, in registration order. Only the top one
   * (highest rank, latest on a tie) listens; see {@link getTopKeyboardOwnerId}.
   */
  keyboardOwners: KeyboardOwner[];
  /**
   * How many surfaces are hiding the docked viewer right now (the edit sheet shows the same scan
   * in its own split). While it is above 0 the docked column renders nothing but keeps `current`,
   * so it comes back when the last one resumes.
   */
  suspendCount: number;
  /** Shows `entry`, swapping it in place if a document is already open. Re-resolves placement. */
  open(entry: DocumentViewerEntry, options?: OpenDocumentViewerOptions): void;
  /** Like `open`, but closes the viewer when `entry` is the document already shown. */
  toggle(entry: DocumentViewerEntry, options?: OpenDocumentViewerOptions): void;
  /** Refreshes the open document's URLs and labels (after an edit). Ignores any other id. */
  update(entry: DocumentViewerEntry): void;
  close(): void;
  setExpanded(expanded: boolean): void;
  /** Hides the docked viewer until the returned resume function runs. Resuming twice is a no-op. */
  suspend(): () => void;
  /**
   * Shows the previous (-1) or next (1) sibling. No wrap-around, and no-op without siblings or at
   * either end. It never re-resolves the placement and never touches history.
   */
  step(delta: 1 | -1): void;
  /**
   * Called by a documents table whose row ids changed. The sibling snapshot keeps the order shown
   * when the viewer opened; it is never re-sorted to follow the table. If the current document was
   * among `prev` but is gone from `next` (deleted, filtered out, paged away), the snapshot no
   * longer matches the table, so it is dropped and the stepper hides instead of guessing.
   */
  reconcileRowIds(prev: readonly string[], next: readonly string[]): void;
  /** Adds a keyboard owner; the returned function removes it again (idempotent). */
  registerKeyboardOwner(id: string, rank: KeyboardRank): () => void;
}

/** The owner that gets the shortcuts: the highest rank, and the latest registered on a tie. */
export function getTopKeyboardOwnerId(owners: readonly KeyboardOwner[]): string | null {
  let top: KeyboardOwner | null = null;
  for (const owner of owners) {
    if (!top || owner.rank >= top.rank) {
      top = owner;
    }
  }
  return top?.id ?? null;
}

/**
 * The element that opened the viewer. Kept out of store state on purpose: a DOM node in reactive
 * state would be compared and devtools-serialised for nothing, and a `WeakRef` doesn't keep a row
 * that has since unmounted alive.
 */
let triggerRef: WeakRef<HTMLElement> | null = null;

function setTrigger(trigger: HTMLElement | null | undefined): void {
  triggerRef = trigger ? new WeakRef(trigger) : null;
}

/** The element that opened the viewer, if it is still around. Check `isConnected` before focusing. */
export function getViewerTrigger(): HTMLElement | null {
  return triggerRef?.deref() ?? null;
}

function sameEntry(a: DocumentViewerEntry, b: DocumentViewerEntry): boolean {
  return (
    a.id === b.id &&
    a.imageUrl === b.imageUrl &&
    a.fileUrl === b.fileUrl &&
    a.title === b.title &&
    a.subtitle === b.subtitle
  );
}

const INITIAL_STATE = {
  current: null,
  placement: null,
  overlayMode: null,
  expanded: false,
  siblings: null,
} satisfies Pick<
  DocumentViewerState,
  'current' | 'placement' | 'overlayMode' | 'expanded' | 'siblings'
>;

/**
 * Kept apart from `INITIAL_STATE` so `close()` leaves them alone: suspension belongs to the sheet,
 * and keyboard owners to the mounted viewers.
 */
const INITIAL_MOUNTED = { suspendCount: 0, keyboardOwners: [] } satisfies Pick<
  DocumentViewerState,
  'suspendCount' | 'keyboardOwners'
>;

/**
 * The one document viewer of the dashboard. Call sites need no provider, so tables inside dialogs
 * and portals reach it too.
 *
 * Zustand v5 has no default equality check: a selector that builds a new object or array re-renders
 * forever. Select primitives (`s => s.current?.id === id`), single fields, or use `useShallow`.
 */
export const useDocumentViewer = create<DocumentViewerState>()((set, get) => ({
  ...INITIAL_STATE,
  ...INITIAL_MOUNTED,
  open: (entry, options): void => {
    const trigger = options?.trigger ?? null;
    const { placement, overlayMode } = resolveViewerPlacement({
      trigger,
      viewportWidth: getViewportWidth(),
      sidebarWidth: useSidebar.getState().isMinimized
        ? SIDEBAR_WIDTH_PX.minimized
        : SIDEBAR_WIDTH_PX.expanded,
    });
    setTrigger(trigger);
    set(state => ({
      current: entry,
      placement,
      overlayMode,
      siblings: options?.siblings ? [...options.siblings] : null,
      // A swap inside the docked column keeps it expanded; anything else starts collapsed.
      expanded: state.placement === 'docked' && placement === 'docked' && state.expanded,
    }));
  },
  toggle: (entry, options): void => {
    if (get().current?.id === entry.id) {
      get().close();
    } else {
      get().open(entry, options);
    }
  },
  update: (entry): void => {
    const { current } = get();
    if (current && current.id === entry.id && !sameEntry(current, entry)) {
      // The snapshot's copy too, so stepping away and back shows the fresh entry.
      set(state => ({
        current: entry,
        siblings: state.siblings?.map(s => (s.id === entry.id ? entry : s)) ?? null,
      }));
    }
  },
  close: (): void => {
    setTrigger(null);
    if (get().current) {
      set(INITIAL_STATE);
    }
  },
  setExpanded: (expanded): void => set({ expanded }),
  suspend: (): (() => void) => {
    set(state => ({ suspendCount: state.suspendCount + 1 }));
    let resumed = false;
    return (): void => {
      if (resumed) {
        return;
      }
      resumed = true;
      set(state => ({ suspendCount: Math.max(0, state.suspendCount - 1) }));
    };
  },
  step: (delta): void => {
    const { current, siblings } = get();
    if (!current || !siblings) {
      return;
    }
    const index = siblings.findIndex(entry => entry.id === current.id);
    const next = index === -1 ? undefined : siblings[index + delta];
    if (next) {
      set({ current: next });
    }
  },
  reconcileRowIds: (prev, next): void => {
    const { current, siblings } = get();
    if (!current || !siblings) {
      return;
    }
    if (prev.includes(current.id) && !next.includes(current.id)) {
      set({ siblings: null });
    }
  },
  registerKeyboardOwner: (id, rank): (() => void) => {
    const owner: KeyboardOwner = { id, rank };
    set(state => ({ keyboardOwners: [...state.keyboardOwners, owner] }));
    return (): void => {
      // By identity, so an unregister never removes a later registration under the same id.
      set(state =>
        state.keyboardOwners.includes(owner)
          ? { keyboardOwners: state.keyboardOwners.filter(o => o !== owner) }
          : state,
      );
    };
  },
}));

/**
 * Hides the docked viewer while `active` is true, for a surface that shows the document itself (the
 * edit sheet). Takes `active` instead of being called conditionally, so a component can call it
 * before an early return. Symmetric under StrictMode: the double mount ends at one suspension.
 */
export function useSuspendDockedViewer(active: boolean): void {
  const suspend = useDocumentViewer(s => s.suspend);
  useEffect(() => {
    if (!active) {
      return;
    }
    return suspend();
  }, [active, suspend]);
}

/** Back to closed, trigger forgotten. For tests and stories. */
export function resetDocumentViewerStore(): void {
  setTrigger(null);
  useDocumentViewer.setState({ ...INITIAL_STATE, ...INITIAL_MOUNTED });
}
