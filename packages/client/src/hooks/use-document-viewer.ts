import { create } from 'zustand';
import {
  getViewportWidth,
  resolveViewerPlacement,
  type DocumentViewerPlacement,
} from '../components/common/document-viewer/placement.js';
import type { DocumentViewerEntry } from '../components/common/document-viewer/types.js';
import { SIDEBAR_WIDTH_PX, useSidebar } from './use-sidebar.js';

export type { DocumentViewerPlacement };

export interface OpenDocumentViewerOptions {
  /**
   * The element that opened the viewer. Its DOM decides the placement (inside a dialog, the viewer
   * can't dock), and it gets focus back when the viewer closes with ✕ or Esc.
   */
  trigger?: HTMLElement | null;
}

interface DocumentViewerState {
  current: DocumentViewerEntry | null;
  placement: DocumentViewerPlacement | null;
  expanded: boolean;
  /** Shows `entry`, swapping it in place if a document is already open. Re-resolves placement. */
  open(entry: DocumentViewerEntry, options?: OpenDocumentViewerOptions): void;
  /** Like `open`, but closes the viewer when `entry` is the document already shown. */
  toggle(entry: DocumentViewerEntry, options?: OpenDocumentViewerOptions): void;
  /** Refreshes the open document's URLs and labels (after an edit). Ignores any other id. */
  update(entry: DocumentViewerEntry): void;
  close(): void;
  setExpanded(expanded: boolean): void;
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
  expanded: false,
} satisfies Pick<DocumentViewerState, 'current' | 'placement' | 'expanded'>;

/**
 * The one document viewer of the dashboard. Call sites need no provider, so tables inside dialogs
 * and portals reach it too.
 *
 * Zustand v5 has no default equality check: a selector that builds a new object or array re-renders
 * forever. Select primitives (`s => s.current?.id === id`), single fields, or use `useShallow`.
 */
export const useDocumentViewer = create<DocumentViewerState>()((set, get) => ({
  ...INITIAL_STATE,
  open: (entry, options): void => {
    const trigger = options?.trigger ?? null;
    const placement = resolveViewerPlacement({
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
      set({ current: entry });
    }
  },
  close: (): void => {
    setTrigger(null);
    if (get().current) {
      set(INITIAL_STATE);
    }
  },
  setExpanded: (expanded): void => set({ expanded }),
}));

/** Back to closed, trigger forgotten. For tests and stories. */
export function resetDocumentViewerStore(): void {
  setTrigger(null);
  useDocumentViewer.setState(INITIAL_STATE);
}
