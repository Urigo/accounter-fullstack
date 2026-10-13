import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { getViewerTrigger, useDocumentViewer } from '@/hooks/use-document-viewer.js';
import { cn } from '@/lib/utils.js';
import { DocumentImageDrawer } from '../document-image-drawer.js';
import { DocumentViewer } from './document-viewer.js';
import { clampDockedRatio, DOCKED_RATIO_STEP, dockedWidthStyle } from './placement.js';
import type { DocumentViewerEntry } from './types.js';

/** The docked column's `id`, for anything that needs to point at it. */
export const DOCKED_VIEWER_ID = 'document-viewer';

/** Holds the docked column's `clamp()` width expression. */
export const DOCKED_WIDTH_VAR = '--docked-width';

export interface DockedViewerPanelProps {
  entry: DocumentViewerEntry;
  expanded: boolean;
  onToggleExpand: () => void;
  onClose: () => void;
}

/** Whether an Esc keydown was already handled by something inside the viewer or above it. */
function isEscapeHandledElsewhere(event: KeyboardEvent): boolean {
  if (event.defaultPrevented) {
    // A Radix layer (a tooltip, a menu) dismissed itself on this Esc.
    return true;
  }
  // An input that handles Esc itself, like the zoom readout cancelling an edit.
  return event.target instanceof Element && !!event.target.closest('[data-local-escape]');
}

/**
 * The resize handle's value: the docked column's width as a whole percentage of the work area,
 * with the bounds the pixel minimums allow. A chosen ratio is reported at once, already clamped;
 * the default width comes from layout. Unmeasured, it reports 50% of 0–100.
 */
export function separatorAria(
  ratio: number | null,
  layout: { area: number; width: number } | null,
): { now: number; min: number; max: number } {
  const area = layout?.area ?? 0;
  const width = layout?.width ?? 0;
  const percent = (value: number): number => Math.round(value * 100);
  if (area <= 0) {
    return { now: percent(ratio ?? 0.5), min: 0, max: 100 };
  }
  const min = clampDockedRatio(0, area);
  const max = clampDockedRatio(1, area);
  const now = clampDockedRatio(ratio ?? width / area, area);
  return { now: percent(now), min: percent(min), max: percent(max) };
}

/**
 * The docked column: a labelled region beside the page column, resizable from its left edge.
 *
 * Its width is a CSS `clamp(420px, …, 100% - 480px)` of the work area (the flex row it sits in),
 * so a window that shrinks after docking never pushes it off-screen: the column holds its minimum
 * and the page column scrolls. Expanded, the viewer covers the page column while the section stays
 * in the flow as a spacer, so the page neither reflows nor loses its scroll position.
 *
 * Presentational: it owns only the live width. The host below connects it to the store.
 */
export function DockedViewerPanel({
  entry,
  expanded,
  onToggleExpand,
  onClose,
}: DockedViewerPanelProps): ReactElement {
  const sectionRef = useRef<HTMLElement>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  /** The width as a ratio of the work area; `null` is the default width. Not persisted until PR 5. */
  const [ratio, setRatio] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Esc closes only when it comes from inside the viewer. A native listener, because the section is
  // a landmark, not a widget, and it must see the event's `defaultPrevented` as Radix left it.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || isEscapeHandledElsewhere(event)) {
        return;
      }
      event.preventDefault();
      onClose();
    };
    section.addEventListener('keydown', onKeyDown);
    return () => section.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // A drag still in progress when the panel unmounts must not leave window listeners behind.
  useEffect(() => () => endDragRef.current?.(), []);

  // The rendered widths, for the separator's ARIA value: the default width and the CSS clamp are
  // only known once laid out. Updated whenever the column or the work area resizes.
  const [layout, setLayout] = useState<{ area: number; width: number } | null>(null);
  useEffect(() => {
    const section = sectionRef.current;
    const area = section?.parentElement;
    if (!section || !area || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() =>
      setLayout({
        area: area.getBoundingClientRect().width,
        width: section.getBoundingClientRect().width,
      }),
    );
    observer.observe(section);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const separatorValue = separatorAria(ratio, layout);

  const measure = (): { area: number; ratio: number } => {
    const section = sectionRef.current;
    const area = section?.parentElement?.getBoundingClientRect().width ?? 0;
    // The rendered width, not the chosen ratio: after a window resize the CSS clamp may hold the
    // column at a minimum, and a key press must step from what is on screen.
    const width = section?.getBoundingClientRect().width ?? 0;
    if (area > 0 && width > 0) {
      return { area, ratio: width / area };
    }
    return { area, ratio: ratio ?? 0.5 };
  };

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return;
    }
    // No text selection or image drag while resizing.
    event.preventDefault();
    const { pointerId } = event;
    event.currentTarget.setPointerCapture?.(pointerId);

    const onMove = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) {
        return;
      }
      const rect = sectionRef.current?.parentElement?.getBoundingClientRect();
      if (!rect || rect.width <= 0) {
        return;
      }
      setRatio(clampDockedRatio((rect.right - e.clientX) / rect.width, rect.width));
    };
    const onEnd = (e: PointerEvent): void => {
      if (e.pointerId === pointerId) {
        endDrag();
      }
    };
    const endDrag = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      endDragRef.current = null;
      setDragging(false);
    };

    endDragRef.current?.();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    endDragRef.current = endDrag;
    setDragging(true);
  };

  const onHandleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const { area, ratio: base } = measure();
      // The handle is the column's left edge: moving it left widens the column.
      const delta = event.key === 'ArrowLeft' ? DOCKED_RATIO_STEP : -DOCKED_RATIO_STEP;
      setRatio(clampDockedRatio(base + delta, area));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      setRatio(null);
    }
  };

  return (
    <section
      ref={sectionRef}
      id={DOCKED_VIEWER_ID}
      aria-label={`Document viewer: ${entry.title}`}
      className={cn(
        'my-14 flex w-(--docked-width) shrink-0 flex-col border-l bg-white dark:bg-gray-950',
        // Expanded, the viewer is positioned against the work area, not this spacer.
        !expanded && 'relative',
      )}
      // A custom property, so the whole `clamp()` reaches the browser as written.
      style={{ [DOCKED_WIDTH_VAR]: dockedWidthStyle(ratio) } as CSSProperties}
    >
      {!expanded && (
        // A focusable separator is an ARIA widget (a window splitter), which jsx-a11y doesn't model.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize document viewer"
          aria-controls={DOCKED_VIEWER_ID}
          aria-valuenow={separatorValue.now}
          aria-valuemin={separatorValue.min}
          aria-valuemax={separatorValue.max}
          aria-valuetext={`Document viewer ${separatorValue.now}% wide`}
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see above
          tabIndex={0}
          data-dragging={dragging || undefined}
          className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none hover:bg-blue-500/20 focus-visible:bg-blue-500/30 focus-visible:outline-none data-dragging:bg-blue-500/30"
          onPointerDown={onHandlePointerDown}
          onKeyDown={onHandleKeyDown}
          onDoubleClick={() => setRatio(null)}
        />
      )}
      <DocumentViewer
        source={entry}
        // A new image URL (an edit saved in the sheet) restarts the canvas, as a new document does.
        documentKey={`${entry.id}:${entry.imageUrl ?? ''}`}
        onClose={onClose}
        onToggleExpand={onToggleExpand}
        expanded={expanded}
        // No z-index: the page column is a `z-0` stacking context earlier in the tree, so the
        // positioned viewer already paints over it, and a `z-10` would also cover the sidebar's
        // collapse chevron, which overhangs into the work area.
        className={cn(expanded && 'absolute inset-y-14 right-0 left-0 h-auto border-l shadow-xl')}
      />
    </section>
  );
}

/**
 * The dashboard's single document viewer, connected to `useDocumentViewer`. Docks as a column when
 * the placement allows and otherwise falls back to the PR 1 drawer, which the Overlay replaces in
 * PR 4.
 */
export function DockedDocumentViewer(): ReactElement {
  const current = useDocumentViewer(s => s.current);
  const placement = useDocumentViewer(s => s.placement);
  const expanded = useDocumentViewer(s => s.expanded);
  const close = useDocumentViewer(s => s.close);
  const setExpanded = useDocumentViewer(s => s.setExpanded);

  // ✕ and Esc hand focus back to the trigger. Opening never moves focus.
  const requestClose = useCallback((): void => {
    const trigger = getViewerTrigger();
    close();
    if (trigger?.isConnected) {
      trigger.focus({ preventScroll: true });
    }
  }, [close]);

  const toggleExpand = useCallback(
    (): void => setExpanded(!useDocumentViewer.getState().expanded),
    [setExpanded],
  );

  return (
    <>
      {current && placement === 'docked' && (
        <DockedViewerPanel
          entry={current}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          onClose={requestClose}
        />
      )}
      <DocumentImageDrawer source={current} opened={placement === 'fallback'} onClose={close} />
    </>
  );
}
