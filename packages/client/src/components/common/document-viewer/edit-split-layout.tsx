import {
  useEffect,
  useId,
  useReducer,
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

/** Below this rendered width (px), the form pane counts as narrow. */
export const NARROW_FORM_WIDTH = 480;

/** What the split tells its form about the space it has. */
export interface EditSplitFormLayout {
  /**
   * Whether the form pane is rendered under `NARROW_FORM_WIDTH`, e.g. dragged to its 320px minimum.
   * The form's grid breakpoints follow the viewport, not the pane, so it needs to be told.
   */
  narrow: boolean;
}

export interface DocumentEditSplitProps {
  /** The form pane's content, or a function of the pane's layout. */
  form: ReactNode | ((layout: EditSplitFormLayout) => ReactNode);
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
  /**
   * Where focus goes once a Hide or Show has rendered, and the `hidden` value that render must
   * have; `null` on mount and for outside changes.
   */
  const focusAfterToggleRef = useRef<{ target: 'show' | 'viewer'; hidden: boolean } | null>(null);
  /** Forces the render after a Hide or Show, so its focus request is settled there either way. */
  const [, settleToggle] = useReducer((n: number) => n + 1, 0);
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
  // Narrowing to the stacked layout drops a pending Expand, so widening again starts collapsed
  // instead of suddenly covering the form. Adjusted while rendering, so no frame shows it.
  if (!sideBySide && wantsExpanded) {
    setWantsExpanded(false);
  }
  // Stacked, Expand opens the overlay instead; a hidden pane has nothing to expand.
  const expanded = wantsExpanded && sideBySide && !hidden;

  // A drag still in progress when the split unmounts must not leave window listeners behind.
  useEffect(() => () => endDragRef.current?.(), []);

  // The button that was clicked disappears with the toggle, so focus moves to its counterpart.
  // Runs after every render, and the click forces one: a request the parent didn't apply (so
  // `hidden` didn't change) is dropped there instead of firing on some later, unrelated change.
  useEffect(() => {
    const request = focusAfterToggleRef.current;
    if (!request) {
      return;
    }
    focusAfterToggleRef.current = null;
    if (request.hidden !== hidden) {
      return;
    }
    if (request.target === 'show') {
      showButtonRef.current?.focus();
    } else {
      viewerPaneRef.current
        ?.querySelector<HTMLElement>('button[aria-label="Hide document"]')
        ?.focus();
    }
  });

  // Esc while expanded collapses the viewer instead of closing the whole sheet, which would drop
  // unsaved edits. Radix hears Esc in the document's capture phase, ahead of any React handler, so
  // this listens on `window` (whose capture phase runs first) and marks the key handled; the sheet
  // ignores a handled Esc.
  //
  // Keys from inside the split count, and so do keys with no focused control: Safari and Firefox
  // on macOS don't focus a button on click, and `inert` drops focus from the form, so the target is
  // often the body or the sheet's dialog content, an ancestor of the split. An overlay or a menu
  // portaled elsewhere keeps its own Esc (its target neither is inside the split nor contains it),
  // and so does a field that cancels an edit on Esc.
  useEffect(() => {
    if (!expanded) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      const { target } = event;
      const split = rootRef.current;
      if (
        event.key !== 'Escape' ||
        event.defaultPrevented ||
        !split ||
        !(target instanceof Node) ||
        !(split.contains(target) || target === document.body || target.contains(split)) ||
        (target instanceof Element && target.closest('[data-local-escape]'))
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setWantsExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [expanded]);

  const hide = (): void => {
    focusAfterToggleRef.current = { target: 'show', hidden: true };
    settleToggle();
    setWantsExpanded(false);
    onHiddenChange(true);
  };

  let toggleExpand: EditSplitViewerControls['onToggleExpand'];
  if (sideBySide) {
    toggleExpand = (): void => setWantsExpanded(e => !e);
  } else if (entry) {
    // The trigger sits in the sheet's dialog, so this resolves to the overlay (full screen under
    // 1024px), which hands focus back to it on close.
    //
    // Known trade-off: the store holds one `current`, so this replaces a docked document that the
    // sheet had suspended. Closing the overlay and then the sheet leaves no docked viewer behind;
    // the user reopens it from its row.
    toggleExpand = (trigger): void => openViewer(entry, { trigger });
  }

  const show = (): void => {
    focusAfterToggleRef.current = { target: 'viewer', hidden: false };
    settleToggle();
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
  const formLayout: EditSplitFormLayout = {
    narrow: layout != null && layout.form > 0 && layout.form < NARROW_FORM_WIDTH,
  };

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
            // Inside the viewer pane (`left-0`), so it never covers the form pane's scrollbar.
            // Focus is a solid bar, as on the docked column's handle.
            className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize touch-none hover:bg-blue-500/20 focus-visible:bg-blue-600 focus-visible:outline-none data-dragging:bg-blue-500/30 dark:focus-visible:bg-blue-400"
            onPointerDown={onHandlePointerDown}
            onKeyDown={onHandleKeyDown}
            onDoubleClick={() => setRatio(null)}
          />
        )}
        {/* Stays mounted while hidden, so Show keeps the zoom without reloading the image; the
            viewer puts back the scroll position the browser drops under `display: none`. */}
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
        // Covered by the expanded viewer: out of the tab order and the accessibility tree.
        inert={expanded}
        aria-hidden={expanded || undefined}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain',
          !hidden && 'lg:w-(--edit-split-form) lg:min-w-80 lg:flex-none',
        )}
      >
        {typeof form === 'function' ? form(formLayout) : form}
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
