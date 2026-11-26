import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { PanelRightOpen } from 'lucide-react';
import { useDocumentViewer } from '@/hooks/use-document-viewer.js';
import { useMediaQuery } from '@/hooks/use-media-query.js';
import { cn } from '@/lib/utils.js';
import { Button } from '../../ui/button.js';
import { Tooltip } from '../tooltip.js';
import { EDIT_SPLIT_RATIO_KEY, usePersistedRatio } from './persisted-sizes.js';
import {
  clampEditSplitRatio,
  DEFAULT_EDIT_SPLIT_RATIO,
  EDIT_SPLIT_RATIO_STEP,
  editSplitFormWidthStyle,
  editSplitSeparatorAria,
} from './placement.js';
import type { DocumentViewerEntry } from './types.js';

/** Holds the form pane's `clamp()` width expression. */
export const EDIT_SPLIT_FORM_WIDTH_VAR = '--edit-split-form';

/**
 * Side by side from here up; stacked (viewer above the form) below. Tailwind's `lg` is `64rem`, so
 * this is in rem too: with a larger default font size, a pixel query would disagree with the
 * `lg:` classes and put the handle and Expand inside the stacked layout.
 */
export const SPLIT_MEDIA_QUERY = '(min-width: 64rem)';

/** What the split hands its viewer, to wire into `DocumentViewer`'s header actions. */
export interface EditSplitViewerControls {
  /** Collapses the viewer pane to a strip; pass as `onClose` with `closeVariant="hide"`. */
  onHide: () => void;
  /**
   * Side by side, widens the viewer over the form and back. Stacked, opens the document in the
   * full-screen overlay above the sheet, with the clicked button as the trigger. Absent when
   * stacked without an `entry`.
   */
  onToggleExpand?: (trigger: HTMLElement) => void;
  /** Whether the viewer covers the form. Always false when stacked. */
  expanded: boolean;
}

export interface DocumentEditSplitProps {
  form: ReactNode;
  /** The document in the viewer pane. Stacked, Expand opens it in the overlay. */
  entry?: DocumentViewerEntry;
  /** Renders the viewer pane's content, usually a `DocumentViewer`. */
  viewer: (controls: EditSplitViewerControls) => ReactElement;
  /** Whether the viewer pane is collapsed to a strip. Controlled: the form's grid follows it. */
  hidden: boolean;
  onHiddenChange: (hidden: boolean) => void;
  className?: string;
}

/**
 * The edit sheet's two panes: the form on the left and the document on the right, each scrolling on
 * its own, with a resize handle between them. Below `lg` they stack, with the document in a
 * fixed-height section above the form.
 *
 * Both panes carry `data-vaul-no-drag`, so neither a pan on the scan nor a text selection in a field
 * drags the surrounding bottom sheet. Dragging the sheet's header still does.
 *
 * Expand covers the form with the viewer, the same overlay pattern as the docked column: the viewer
 * pane stays in the flow as a spacer, so the form keeps its scroll position. Stacked, Expand opens
 * the full-screen overlay above the sheet instead.
 */
export function DocumentEditSplit({
  form,
  entry,
  viewer,
  hidden,
  onHiddenChange,
  className,
}: DocumentEditSplitProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const formPaneRef = useRef<HTMLDivElement>(null);
  const showButtonRef = useRef<HTMLButtonElement>(null);
  const viewerPaneRef = useRef<HTMLDivElement>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  /** Where focus goes once a Hide or Show has rendered; `null` on mount and for outside changes. */
  const focusAfterToggleRef = useRef<'show' | 'viewer' | null>(null);
  const formPaneId = useId();
  /** The form pane's share of the split; `null` is the default 50/50. Remembered per browser. */
  const {
    ratio,
    preview: previewRatio,
    commit: commitRatio,
    set: setRatio,
  } = usePersistedRatio(EDIT_SPLIT_RATIO_KEY);
  const [dragging, setDragging] = useState(false);
  const [wantsExpanded, setWantsExpanded] = useState(false);
  const sideBySide = useMediaQuery(SPLIT_MEDIA_QUERY);
  const openViewer = useDocumentViewer(s => s.open);
  // Stacked, Expand opens the overlay instead; a hidden pane has nothing to expand.
  const expanded = wantsExpanded && sideBySide && !hidden;

  // A drag still in progress when the split unmounts must not leave window listeners behind.
  useEffect(() => () => endDragRef.current?.(), []);

  // The button that was clicked disappears with the toggle, so focus moves to its counterpart.
  useEffect(() => {
    const target = focusAfterToggleRef.current;
    focusAfterToggleRef.current = null;
    if (target === 'show') {
      showButtonRef.current?.focus();
    } else if (target === 'viewer') {
      viewerPaneRef.current
        ?.querySelector<HTMLElement>('button[aria-label="Hide document"]')
        ?.focus();
    }
  }, [hidden]);

  const hide = (): void => {
    focusAfterToggleRef.current = 'show';
    setWantsExpanded(false);
    onHiddenChange(true);
  };

  let toggleExpand: EditSplitViewerControls['onToggleExpand'];
  if (sideBySide) {
    toggleExpand = (): void => setWantsExpanded(e => !e);
  } else if (entry) {
    // The trigger sits in the sheet's dialog, so this resolves to the overlay (full screen under
    // 1024px), which hands focus back to it on close.
    toggleExpand = (trigger): void => openViewer(entry, { trigger });
  }

  const show = (): void => {
    focusAfterToggleRef.current = 'viewer';
    onHiddenChange(false);
  };

  // The rendered widths, for the separator's ARIA value: the default split and the CSS clamp are
  // only known once laid out. Updated whenever the form pane or the split resizes.
  const [layout, setLayout] = useState<{ split: number; form: number } | null>(null);
  useEffect(() => {
    const split = rootRef.current;
    const formPane = formPaneRef.current;
    if (!split || !formPane || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() =>
      setLayout({
        split: split.getBoundingClientRect().width,
        form: formPane.getBoundingClientRect().width,
      }),
    );
    observer.observe(split);
    observer.observe(formPane);
    return () => observer.disconnect();
  }, []);

  const separatorValue = editSplitSeparatorAria(ratio, layout);

  const measure = (): { split: number; ratio: number } => {
    const split = rootRef.current?.getBoundingClientRect().width ?? 0;
    // The rendered width, not the chosen ratio: the CSS clamp may hold the form at its minimum,
    // and a key press must step from what is on screen.
    const form = formPaneRef.current?.getBoundingClientRect().width ?? 0;
    if (split > 0 && form > 0) {
      return { split, ratio: form / split };
    }
    return { split, ratio: ratio ?? DEFAULT_EDIT_SPLIT_RATIO };
  };

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) {
      return;
    }
    // No text selection or image drag while resizing.
    event.preventDefault();
    // `preventDefault` also stops the handle taking focus; focus it so the arrow keys work next.
    event.currentTarget.focus({ preventScroll: true });
    const { pointerId } = event;
    event.currentTarget.setPointerCapture?.(pointerId);

    const onMove = (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) {
        return;
      }
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) {
        return;
      }
      previewRatio(clampEditSplitRatio((e.clientX - rect.left) / rect.width, rect.width));
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
      // Stored once, on release: storage is written on every state change.
      commitRatio();
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
      // The handle is the form pane's right edge: moving it left narrows the form.
      const delta = event.key === 'ArrowLeft' ? -EDIT_SPLIT_RATIO_STEP : EDIT_SPLIT_RATIO_STEP;
      const { split, ratio: base } = measure();
      setRatio(clampEditSplitRatio(base + delta, split));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      setRatio(null);
    }
  };

  return (
    <div
      ref={rootRef}
      data-slot="edit-split"
      // The viewer comes first in the DOM, as it does on screen when stacked; side by side,
      // `row-reverse` puts it on the right, so the visual and tab orders match in both layouts.
      className={cn('relative flex min-h-0 flex-1 flex-col lg:flex-row-reverse', className)}
      // A custom property, so the whole `clamp()` reaches the browser as written.
      style={{ [EDIT_SPLIT_FORM_WIDTH_VAR]: editSplitFormWidthStyle(ratio) } as CSSProperties}
    >
      <div
        ref={viewerPaneRef}
        data-vaul-no-drag
        data-slot="edit-split-viewer"
        data-hidden={hidden ? '' : undefined}
        className={cn(
          'flex shrink-0 border-b lg:border-b-0 lg:border-l',
          hidden
            ? 'h-10 items-center px-2 lg:h-auto lg:w-10 lg:flex-col lg:px-0 lg:py-2'
            : 'h-[45vh] flex-col lg:h-auto lg:min-w-80 lg:flex-1 lg:shrink',
          // Expanded, the viewer is positioned against the split, not this spacer.
          !hidden && !expanded && 'relative',
        )}
      >
        {hidden && (
          <Tooltip content="Show document" asChild>
            <Button ref={showButtonRef} variant="ghost" size="sm" onClick={show}>
              <PanelRightOpen className="size-4" />
              <span className="lg:sr-only">Show document</span>
            </Button>
          </Tooltip>
        )}
        {sideBySide && !hidden && !expanded && (
          // A focusable separator is an ARIA widget (a window splitter), which jsx-a11y doesn't
          // model.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize document pane"
            aria-controls={formPaneId}
            aria-valuenow={separatorValue.now}
            aria-valuemin={separatorValue.min}
            aria-valuemax={separatorValue.max}
            aria-valuetext={`Form ${separatorValue.now}% wide`}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- see above
            tabIndex={0}
            data-dragging={dragging || undefined}
            className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none hover:bg-blue-500/20 focus-visible:bg-blue-500/30 focus-visible:outline-none data-dragging:bg-blue-500/30"
            onPointerDown={onHandlePointerDown}
            onKeyDown={onHandleKeyDown}
            onDoubleClick={() => setRatio(null)}
          />
        )}
        {/* Stays mounted while hidden, so Show brings back the same zoom and scroll without
            reloading the image. */}
        <div
          data-slot="edit-split-viewer-content"
          hidden={hidden}
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            expanded && 'absolute inset-0 z-10 border-l bg-white shadow-xl dark:bg-gray-950',
          )}
        >
          <ViewerSlot
            render={viewer}
            onHide={hide}
            onToggleExpand={toggleExpand}
            expanded={expanded}
          />
        </div>
      </div>

      <div
        ref={formPaneRef}
        id={formPaneId}
        data-vaul-no-drag
        data-slot="edit-split-form"
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain',
          !hidden && 'lg:w-(--edit-split-form) lg:min-w-80 lg:flex-none',
        )}
      >
        {form}
      </div>
    </div>
  );
}

/**
 * Calls the `viewer` render prop from its own component, so the split's handlers (which note where
 * focus goes next) reach it as props rather than through a call made while the split renders.
 */
function ViewerSlot({
  render,
  ...controls
}: EditSplitViewerControls & {
  render: DocumentEditSplitProps['viewer'];
}): ReactElement {
  return render(controls);
}
