import { useLayoutEffect, useRef, type ReactElement } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { getViewerTrigger, KEYBOARD_RANK, useDocumentViewer } from '@/hooks/use-document-viewer.js';
import { cn } from '@/lib/utils.js';
import { DocumentViewer, type DocumentViewerStepper } from './document-viewer.js';
import type { OverlayMode } from './placement.js';
import { useViewerStepper } from './siblings.js';
import type { DocumentViewerEntry } from './types.js';
import { useOverlayHistory } from './use-overlay-history.js';

/**
 * `z-1001`, not higher: the overlay beats an open modal at the same z-index because its portal
 * mounts later in the body. The viewer's own tooltips and `⋯` menu also portal to the body at
 * `z-1001`, after the overlay, so a `z-1002` overlay would hide them.
 */
const MODE_CLASSES: Record<OverlayMode, string> = {
  // There is no `Dialog.Overlay`, so no scroll lock. `touch-none` stops a drag on the header or
  // toolbar from scrolling the page behind (iOS); taps still click, and the canvas pans in JS.
  fullscreen: 'fixed inset-0 z-1001 touch-none overscroll-contain bg-white dark:bg-gray-950',
  sheet:
    'fixed inset-y-0 right-0 z-1001 w-1/2 min-w-105 border-l bg-white shadow-xl dark:bg-gray-950',
};

export interface OverlayViewerFrameProps {
  /** The document to show; `null` renders nothing. */
  entry: DocumentViewerEntry | null;
  open: boolean;
  mode: OverlayMode;
  /** ✕, Esc and an outside click. */
  onClose: () => void;
  /** Gets focus back when the overlay closes, if it is still in the document. */
  returnFocusTo?: () => HTMLElement | null;
  /** The `‹ 3/12 ›` stepper, when the viewer was opened from a table with siblings. */
  stepper?: DocumentViewerStepper;
}

/**
 * The document viewer as a modal layer: the whole screen on phones and tablets, or a full-height
 * right sheet above an open dialog, with no backdrop so the dialog stays visible on the left.
 *
 * A Radix Dialog, so it joins the open modal's layer stack: Radix's dismissable-layer and
 * focus-scope stacks are module-global, so this host needs no place in the modal's React tree. A
 * plain body-portaled element would be inert, because an open modal disables outside pointer events
 * and hides its siblings from assistive tech. It stays modal for the same reason: otherwise the
 * dialog below would take a click inside the overlay for an outside click and close. Esc closes
 * only the topmost layer.
 *
 * There is no `Dialog.Overlay`, so there is no Radix scroll lock either. The canvas's
 * `overscroll-contain` keeps a pan from scrolling the page behind, and full screen the frame is
 * `touch-none` too, for drags on the header and toolbar.
 *
 * Presentational: the host below connects it to the store and to history.
 */
export function OverlayViewerFrame({
  entry,
  open,
  mode,
  onClose,
  returnFocusTo,
  stepper,
}: OverlayViewerFrameProps): ReactElement {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <DialogPrimitive.Root
      open={open && !!entry}
      onOpenChange={next => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogPrimitive.Portal>
        {entry && (
          <DialogPrimitive.Content
            ref={contentRef}
            data-slot="document-viewer-overlay"
            data-mode={mode}
            aria-describedby={undefined}
            className={cn(MODE_CLASSES[mode], 'flex flex-col outline-none')}
            onOpenAutoFocus={event => {
              // Straight to the canvas, so arrow keys scroll the scan. Without one (no image),
              // Radix's default focuses the first control.
              const canvas = contentRef.current?.querySelector<HTMLElement>(
                '[data-slot="document-viewer-canvas"]',
              );
              if (canvas) {
                event.preventDefault();
                canvas.focus({ preventScroll: true });
              }
            }}
            onCloseAutoFocus={event => {
              // Radix only restores focus to a `Dialog.Trigger`, and there is none here.
              event.preventDefault();
              const trigger = returnFocusTo?.();
              if (trigger?.isConnected) {
                trigger.focus({ preventScroll: true });
              }
            }}
            onEscapeKeyDown={event => {
              // An input that handles Esc itself (the zoom readout cancelling an edit) keeps the
              // overlay open.
              if (event.target instanceof Element && event.target.closest('[data-local-escape]')) {
                event.preventDefault();
              }
            }}
          >
            <DialogPrimitive.Title className="sr-only">{entry.title}</DialogPrimitive.Title>
            <DocumentViewer
              source={entry}
              // A new image URL restarts the canvas, as a new document does.
              documentKey={`${entry.id}:${entry.imageUrl ?? ''}`}
              onClose={onClose}
              stepper={stepper}
              // Topmost: above the edit sheet's viewer and the docked one. The listener is on
              // `document`, so keys pressed inside this modal's focus trap still reach it.
              keyboardRank={KEYBOARD_RANK.overlay}
            />
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * The dashboard's overlay viewer, connected to `useDocumentViewer`: shown while the placement is
 * `overlay`. The full-screen overlay owns a history entry, so Back closes it (decision 13); the sheet
 * never touches history.
 *
 * Not affected by the docked viewer's suspension: the edit sheet suspends the docked column, and
 * its stacked Expand opens this overlay above itself.
 */
export function OverlayDocumentViewer(): ReactElement {
  const current = useDocumentViewer(s => s.current);
  const placement = useDocumentViewer(s => s.placement);
  const overlayMode = useDocumentViewer(s => s.overlayMode);
  const close = useDocumentViewer(s => s.close);
  const open = !!current && placement === 'overlay';
  const mode = overlayMode ?? 'fullscreen';
  // Stepping swaps `current` in place: no placement change and no history entry (decision 13).
  const stepper = useViewerStepper(open ? current?.id : null);

  const requestClose = useOverlayHistory({ active: open && mode === 'fullscreen', close });

  // `close()` forgets the trigger before Radix asks where focus goes, so it is kept here while the
  // overlay is open. A `WeakRef`, as in the store: an unmounted row isn't kept alive.
  const returnFocusRef = useRef<WeakRef<HTMLElement> | null>(null);
  useLayoutEffect(() => {
    if (open) {
      const trigger = getViewerTrigger();
      returnFocusRef.current = trigger ? new WeakRef(trigger) : null;
    }
  }, [open, current]);

  return (
    <OverlayViewerFrame
      entry={current}
      open={open}
      mode={mode}
      onClose={requestClose}
      returnFocusTo={() => returnFocusRef.current?.deref() ?? null}
      stepper={stepper}
    />
  );
}
